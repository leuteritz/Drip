"""Purchase execution: analysis -> amount -> order (or dry run) -> DB + Discord."""
import logging
from datetime import date, datetime

from sqlmodel import Session

from . import notifier, strategy
from .coinbase_client import CoinbaseError, place_market_buy
from .database import engine, load_settings
from .models import Purchase

logger = logging.getLogger(__name__)


def is_paused(paused_until: date | None) -> bool:
    return paused_until is not None and paused_until >= date.today()


def run_purchase(dry_run_override: bool | None = None,
                 triggered_by: str = "manual",
                 amount_eur_override: float | None = None) -> dict:
    """Runs one full bot cycle.

    dry_run_override: None = use the stored setting,
    otherwise force/lift dry run explicitly (only useful for manual runs).
    amount_eur_override: fixed amount for a manual buy instead of
    base_amount * multiplier; recorded with multiplier=1.0 so manual buys
    stay neutral in the bot-vs-DCA comparison (analytics derives the DCA
    baseline as amount_eur / multiplier).
    """
    with Session(engine) as session:
        settings = load_settings(session)

        if triggered_by == "schedule" and is_paused(settings.paused_until):
            logger.info("Bot paused until %s - skipping scheduled buy", settings.paused_until)
            notifier.send_notification(
                title="Drip paused",
                description=f"Scheduled buy skipped - paused until {settings.paused_until}",
                color=0x454545,
                enabled=settings.discord_enabled,
            )
            return {"skipped": True, "reason": f"Paused until {settings.paused_until}"}

        dry_run = settings.dry_run if dry_run_override is None else dry_run_override
        analysis = strategy.analyze(session)
        manual_amount = amount_eur_override is not None
        if manual_amount:
            amount_eur = round(amount_eur_override, 2)
        else:
            amount_eur = round(settings.base_amount_eur * analysis.multiplier, 2)
        btc_amount = amount_eur / analysis.current_price
        timestamp = datetime.now()

        order_id = "DRY_RUN"
        status = "Test"
        error: str | None = None

        if not dry_run:
            try:
                order_id, status = place_market_buy(amount_eur)
            except CoinbaseError as exc:
                order_id = "ERROR"
                status = f"Error: {exc}"
                error = str(exc)
                logger.error("Buy failed: %s", exc)

        purchase = Purchase(
            timestamp=timestamp,
            price_eur=analysis.current_price,
            amount_eur=amount_eur,
            btc_amount=btc_amount,
            fear_greed=analysis.fear_greed,
            rsi=analysis.rsi,
            ma_350=analysis.ma_350,
            score=analysis.score,
            multiplier=1.0 if manual_amount else analysis.multiplier,
            order_id=order_id,
            status=status,
            dry_run=dry_run,
        )
        session.add(purchase)
        session.commit()
        session.refresh(purchase)

        _notify(analysis, purchase, settings.discord_enabled, error, manual_amount)

        return {
            "skipped": False,
            "purchase": purchase.model_dump(),
            "analysis": analysis.as_dict(),
            "error": error,
        }


def _notify(analysis: strategy.Analysis, purchase: Purchase,
            discord_enabled: bool, error: str | None,
            manual: bool = False) -> None:
    fields = [
        {"name": "BTC price", "value": f"€{analysis.current_price:,.2f}", "inline": True},
        {"name": "Amount", "value": f"€{purchase.amount_eur:.2f}", "inline": True},
        {"name": "Bitcoin", "value": f"{purchase.btc_amount:.8f} BTC", "inline": True},
        {"name": "Score", "value": f"{analysis.score}/{strategy.SCORE_MAX} - {analysis.signal}", "inline": False},
        {"name": "Fear & Greed", "value": f"{analysis.fear_greed} ({analysis.fng_classification})", "inline": True},
        {"name": "RSI", "value": f"{analysis.rsi:.1f}", "inline": True},
        {"name": "350d MA", "value": f"€{analysis.ma_350:,.0f}", "inline": True},
    ]

    if error:
        title = "Drip - buy FAILED"
        description = f"**{purchase.timestamp:%Y-%m-%d %H:%M}**\n{error}"
        color = 0x785964
    elif purchase.dry_run:
        title = "Drip - manual dry run" if manual else "Drip - dry run"
        description = f"**{purchase.timestamp:%Y-%m-%d %H:%M}**\nTest cycle (no real order placed)"
        color = analysis.color
    else:
        title = "Drip - manual buy" if manual else "Drip - bitcoin bought"
        description = f"**{purchase.timestamp:%Y-%m-%d %H:%M}**\nOrder `{purchase.order_id}`"
        color = analysis.color

    notifier.send_notification(title, description, color, fields, discord_enabled)

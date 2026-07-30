"""Purchase execution: analysis -> amount -> order (or dry run) -> DB + Discord."""
import logging
from datetime import date, datetime

from sqlmodel import Session

from . import notifier, strategy
from .constants import ORDER_ID_DRY_RUN, ORDER_ID_ERROR, STATUS_TEST
from .database import engine, load_settings
from .models import Purchase
from .trading import CoinbaseError, place_market_buy

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
            notifier.send_paused_notification(
                settings.paused_until, settings.discord_enabled
            )
            return {"skipped": True, "reason": f"Paused until {settings.paused_until}"}

        dry_run = settings.dry_run if dry_run_override is None else dry_run_override
        analysis = strategy.analyze(session)
        manual_amount = amount_eur_override is not None
        if manual_amount:
            amount_eur = round(amount_eur_override, 2)
        else:
            amount_eur = round(settings.base_amount_eur * analysis.multiplier, 2)

        order_id = ORDER_ID_DRY_RUN
        status = STATUS_TEST
        error: str | None = None

        if not dry_run:
            try:
                order_id, status = place_market_buy(amount_eur)
            except CoinbaseError as exc:
                order_id = ORDER_ID_ERROR
                status = f"Error: {exc}"
                error = str(exc)
                logger.error("Buy failed: %s", exc)

        purchase = Purchase(
            timestamp=datetime.now(),
            price_eur=analysis.current_price,
            amount_eur=amount_eur,
            btc_amount=amount_eur / analysis.current_price,
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

        notifier.send_purchase_notification(
            analysis, purchase, settings.discord_enabled, error, manual_amount
        )

        return {
            "skipped": False,
            "purchase": purchase.model_dump(),
            "analysis": analysis.as_dict(),
            "error": error,
        }

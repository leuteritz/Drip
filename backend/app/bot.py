"""Kauf-Ausfuehrung: Analyse -> Betrag -> Order (oder Dry-Run) -> DB + Discord"""
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
                 triggered_by: str = "manual") -> dict:
    """Fuehrt einen kompletten Bot-Durchlauf aus.

    dry_run_override: None = Einstellung aus DB verwenden,
    sonst explizit Dry-Run erzwingen/aufheben (nur manuell sinnvoll).
    """
    with Session(engine) as session:
        settings = load_settings(session)

        if triggered_by == "schedule" and is_paused(settings.paused_until):
            logger.info("Bot pausiert bis %s - Kauf uebersprungen", settings.paused_until)
            notifier.send_notification(
                title="⏸️ Bitcoin Bot pausiert",
                description=f"Geplanter Kauf uebersprungen - pausiert bis {settings.paused_until}",
                color=0x808080,
                enabled=settings.discord_enabled,
            )
            return {"skipped": True, "reason": f"Pausiert bis {settings.paused_until}"}

        dry_run = settings.dry_run if dry_run_override is None else dry_run_override
        analysis = strategy.analyze(session)
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
                status = f"Fehler: {exc}"
                error = str(exc)
                logger.error("Kauf fehlgeschlagen: %s", exc)

        purchase = Purchase(
            timestamp=timestamp,
            price_eur=analysis.current_price,
            amount_eur=amount_eur,
            btc_amount=btc_amount,
            fear_greed=analysis.fear_greed,
            rsi=analysis.rsi,
            ma_350=analysis.ma_350,
            score=analysis.score,
            multiplier=analysis.multiplier,
            order_id=order_id,
            status=status,
            dry_run=dry_run,
        )
        session.add(purchase)
        session.commit()
        session.refresh(purchase)

        _notify(analysis, purchase, settings.discord_enabled, error)

        return {
            "skipped": False,
            "purchase": purchase.model_dump(),
            "analysis": analysis.as_dict(),
            "error": error,
        }


def _notify(analysis: strategy.Analysis, purchase: Purchase,
            discord_enabled: bool, error: str | None) -> None:
    fields = [
        {"name": "💰 BTC-Preis", "value": f"€{analysis.current_price:,.2f}", "inline": True},
        {"name": "💶 Betrag", "value": f"€{purchase.amount_eur:.2f}", "inline": True},
        {"name": "₿ Bitcoin", "value": f"{purchase.btc_amount:.8f} BTC", "inline": True},
        {"name": "🏆 Score", "value": f"{analysis.score}/{strategy.SCORE_MAX} - {analysis.signal}", "inline": False},
        {"name": "😱 Fear & Greed", "value": f"{analysis.fear_greed} ({analysis.fng_classification})", "inline": True},
        {"name": "📈 RSI", "value": f"{analysis.rsi:.1f}", "inline": True},
        {"name": "📉 350d-MA", "value": f"€{analysis.ma_350:,.0f}", "inline": True},
    ]

    if error:
        title = "❌ Bitcoin Kauf FEHLGESCHLAGEN!"
        description = f"**{purchase.timestamp:%Y-%m-%d %H:%M}**\n{error}"
        color = 0xFF0000
    elif purchase.dry_run:
        title = f"{analysis.emoji} Bitcoin Bot - Dry Run"
        description = f"**{purchase.timestamp:%Y-%m-%d %H:%M}**\n🧪 Test-Durchlauf (kein echter Kauf)"
        color = analysis.color
    else:
        title = f"{analysis.emoji} Bitcoin erfolgreich gekauft!"
        description = f"**{purchase.timestamp:%Y-%m-%d %H:%M}**\n✅ Order `{purchase.order_id}`"
        color = analysis.color

    notifier.send_notification(title, description, color, fields, discord_enabled)

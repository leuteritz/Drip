"""Purchase execution: analysis -> amount -> order (or dry run) -> DB + Discord.

The one thing worth knowing here is where a row's bitcoin comes from. A buy is
*ordered* in euros and *filled* in bitcoin, and only the exchange knows how much
of the amount became coins and how much became its fee — so a real buy is read
back off the filled order rather than divided out by the market price. The
division is still here, as the estimate a dry run gets and the fallback a real
buy falls to when its fill cannot be read in time; `Purchase.filled` is which of
the two happened.
"""
import logging
from datetime import date, datetime

from sqlmodel import Session

from . import notifier, strategy
from .constants import (
    ORDER_ID_DRY_RUN,
    ORDER_ID_ERROR,
    ORIGIN_UNKNOWN,
    ORIGINS,
    STATUS_TEST,
)
from .database import engine, load_settings
from .models import Purchase
from .trading import CoinbaseError, place_market_buy

logger = logging.getLogger(__name__)


def is_paused(paused_until: date | None) -> bool:
    return paused_until is not None and paused_until >= date.today()


def run_purchase(dry_run_override: bool | None = None,
                 triggered_by: str = "manual",
                 amount_eur_override: float | None = None,
                 late_slot: datetime | None = None) -> dict:
    """Runs one full bot cycle.

    dry_run_override: None = use the stored setting,
    otherwise force/lift dry run explicitly (only useful for manual runs).
    triggered_by: what asked for this run — "schedule", "manual" or "catchup".
    It decides whether the pause applies and what Discord is told, and it is
    kept on the row as `Purchase.origin` so the history can still say months
    later which of the three a buy was.
    amount_eur_override: fixed amount for a manual buy instead of
    base_amount * multiplier; recorded with multiplier=1.0 so manual buys
    stay neutral in the bot-vs-DCA comparison (analytics derives the DCA
    baseline as amount_eur / multiplier).
    late_slot: the scheduled moment this run is making up for, set only by the
    catch-up job. It changes nothing about the buy — the same score, the same
    multiplier, today's price, because a week that was missed cannot be bought
    at last Monday's price — and is carried purely so the Discord message can
    say the buy is late rather than quietly appearing days off schedule.
    """
    with Session(engine) as session:
        settings = load_settings(session)

        # A catch-up is a scheduled buy that arrived late, so it obeys the same
        # pause: `missed_slot` already refuses a paused bot, and this is the
        # second lock on the one path that can spend money unattended.
        if triggered_by in ("schedule", "catchup") and is_paused(settings.paused_until):
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

        # What the buy is worth before the exchange has said otherwise: the
        # amount at the market price, no fee. That is an estimate, and it is
        # the only answer available for a dry run, for a failed order, and for
        # a real one whose fill could not be read.
        price_eur = analysis.current_price
        btc_amount = amount_eur / analysis.current_price
        fee_eur = 0.0
        filled = False

        if not dry_run:
            try:
                fill = place_market_buy(amount_eur)
                order_id, status = fill.order_id, fill.status
                if fill.read:
                    # The exchange's own numbers replace the estimate wholesale.
                    # `amount_eur` is untouched on purpose: it is what the buy
                    # was ordered for, and the DCA baseline is derived from it.
                    price_eur = fill.price_eur
                    btc_amount = fill.btc
                    fee_eur = fill.fee_eur
                    filled = True
            except CoinbaseError as exc:
                order_id = ORDER_ID_ERROR
                status = f"Error: {exc}"
                error = str(exc)
                logger.error("Buy failed: %s", exc)

        purchase = Purchase(
            timestamp=datetime.now(),
            price_eur=price_eur,
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
            fee_eur=fee_eur,
            filled=filled,
            # What asked for this buy, written down rather than left to be
            # guessed from the row later. Anything unrecognised is recorded as
            # unknown: a wrong origin would be worse than none, since the
            # history is read as a record of what the bot did on its own.
            origin=triggered_by if triggered_by in ORIGINS else ORIGIN_UNKNOWN,
        )
        session.add(purchase)
        session.commit()
        session.refresh(purchase)

        notifier.send_purchase_notification(
            analysis, purchase, settings.discord_enabled, error, manual_amount,
            late_slot,
        )

        return {
            "skipped": False,
            "purchase": purchase.model_dump(),
            "analysis": analysis.as_dict(),
            "error": error,
        }

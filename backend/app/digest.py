"""The weekly digest: the state of the drip, once a week, in one message.

The purchase embed reports a single buy and cannot answer whether the saving is
going anywhere. This gathers the numbers that only make sense over time — what
was stacked this week, how the stack stands against plain DCA and against the
market's own average price, and what the score is saying now.

Assembling the numbers happens here; laying them out as an embed happens in
`notifier.py`, the same split the purchase flow uses. Nothing here writes to the
database.
"""
import logging
from datetime import datetime, timedelta

from sqlmodel import Session

from . import analytics, holdings, scheduler, strategy
from .database import load_settings
from .models import Purchase

logger = logging.getLogger(__name__)

DIGEST_DAYS = 7
SATS_PER_BTC = 100_000_000


def _week(purchases: list[Purchase]) -> dict:
    since = datetime.now() - timedelta(days=DIGEST_DAYS)
    recent = [p for p in purchases if p.timestamp >= since]
    return {
        "buys": len(recent),
        "spent_eur": sum(p.amount_eur for p in recent),
        "sats": sum(p.btc_amount for p in recent) * SATS_PER_BTC,
    }


def build(session: Session) -> dict:
    """Everything the digest reports.

    Dry runs are included, matching what the dashboard shows by default — in
    dry-run mode, which is the default, excluding them would send an empty
    message every week.
    """
    settings = load_settings(session)
    purchases = analytics.relevant_purchases(session, include_dry_run=True)
    performance = analytics.performance_summary(session, include_dry_run=True)
    stack = holdings.summary(session, include_dry_run=True)
    analysis = strategy.analyze(session)

    dca = performance["dca"]
    return {
        "dry_run": settings.dry_run,
        "week": _week(purchases),
        "total": {
            "buys": performance["purchase_count"],
            "invested_eur": performance["invested_eur"],
            "value_eur": performance["value_eur"],
            "profit_eur": performance["profit_eur"],
            "profit_pct": performance["profit_pct"],
            "sats": performance["btc_total"] * SATS_PER_BTC,
        },
        "vs_dca": {
            "eur": performance["profit_eur"] - dca["profit_eur"],
            "pp": performance["profit_pct"] - dca["profit_pct"],
        },
        "cost_basis": stack["cost_basis"],
        "next_free_date": stack["next_free_date"],
        "excluded": stack["excluded"],
        "analysis": analysis,
        "next_run": scheduler.next_run_time(),
    }


def send(session: Session) -> bool:
    """Builds the digest and hands it to the notifier. Never raises."""
    from . import notifier

    settings = load_settings(session)
    try:
        return notifier.send_digest_notification(build(session), settings.discord_enabled)
    except Exception:
        logger.exception("Weekly digest failed")
        return False

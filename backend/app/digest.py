"""The weekly digest: the state of the drip, once a week, in one message.

The purchase embed reports a single buy and cannot answer whether the saving is
going anywhere. This gathers the numbers that only make sense over time — what
was stacked this week, how the stack stands against plain DCA and against the
market's own average price, and what the score is saying now.

Assembling the numbers happens here; laying them out as an embed happens in
`notifier.py`, the same split the purchase flow uses. Nothing here writes to the
database.

`build` always computes every block, whether or not it is switched on. That is
deliberate: the preview in the frontend renders the whole report once and hides
what is unselected, so toggling a block is instant and the layout it previews is
the one `notifier.build_digest_embed` would actually send.
"""
import json
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlmodel import Session

from . import analytics, holdings, outlook, scheduler, strategy
from .database import load_digest_settings, load_settings
from .market_data import ensure_candles
from .models import DigestSettings, Purchase

logger = logging.getLogger(__name__)

DIGEST_DAYS = 7
# The milestone ladder, the weekly rate and the streak moved to `outlook.py`
# when the dashboard grew a card about the same thing: the report says the next
# round number out loud on Discord, and the two must not disagree about it.
SATS_PER_BTC = outlook.SATS_PER_BTC


@dataclass(frozen=True)
class Block:
    """One switchable section of the report.

    `default` decides what happens to a database row written before the block
    existed: the stored selection only lists the keys it knew about, so anything
    missing falls back to here.
    """

    key: str
    label: str
    description: str
    default: bool = True


# Order matters: this is the order of the fields in the embed and of the rows in
# the frontend's block list, so what you tick reads top to bottom like the message.
BLOCKS: list[Block] = [
    Block("week", "This week", "Sats stacked and euros spent since last week"),
    Block("market", "Bitcoin this week", "How the price moved, with the week's high and low"),
    Block("stack", "Your stack", "Total sats, euros invested and what it is worth now"),
    Block("dca", "vs. plain DCA", "What the score multiplier earned over buying a flat amount"),
    Block("basis", "Entry vs. market", "Your average price against the market's own average"),
    Block("timing", "This week's timing", "What you paid against the week's average price"),
    Block("signal", "Signal right now", "Score, signal and the multiplier it produces"),
    Block("next", "Next buy", "When the next drip lands and roughly how big it is"),
    Block("milestone", "Next milestone", "The next round number of sats, and how far off it is"),
    Block("streak", "Streak", "Weeks in a row with at least one buy"),
    Block("tax", "One-year rule", "Which lots are past the German holding period (§23 EStG)"),
    Block("failed", "Failed buys", "Buys recorded as errors, which every other figure leaves out"),
]

BLOCK_KEYS = [block.key for block in BLOCKS]


# --- Block selection --------------------------------------------------------

def selection(settings: DigestSettings) -> dict[str, bool]:
    """The stored selection, resolved against the defaults. Never raises: a
    corrupted JSON blob simply means every block falls back to its default."""
    try:
        stored = json.loads(settings.blocks)
    except (TypeError, ValueError):
        stored = {}
    if not isinstance(stored, dict):
        stored = {}
    return {b.key: bool(stored.get(b.key, b.default)) for b in BLOCKS}


def merge_selection(settings: DigestSettings, update: dict[str, bool]) -> str:
    """The JSON blob to store after applying `update`. Unknown keys are dropped,
    so a typo in a request cannot silently accumulate in the database."""
    merged = selection(settings)
    merged.update({k: bool(v) for k, v in update.items() if k in merged})
    return json.dumps(merged)


def enabled_keys(settings: DigestSettings) -> set[str]:
    return {key for key, on in selection(settings).items() if on}


# --- The numbers ------------------------------------------------------------

def _week(purchases: list[Purchase]) -> dict:
    since = datetime.now() - timedelta(days=DIGEST_DAYS)
    recent = [p for p in purchases if p.timestamp >= since]
    spent = sum(p.amount_eur for p in recent)
    btc = sum(p.btc_amount for p in recent)
    return {
        "buys": len(recent),
        "spent_eur": spent,
        "sats": btc * SATS_PER_BTC,
        "avg_price_eur": spent / btc if btc else 0.0,
    }


def _market(session: Session) -> dict:
    """What bitcoin itself did over the week, from the candle cache alone.

    The window is one day longer than the week so the change can be measured
    against a close that sits *before* it.
    """
    candles = ensure_candles(session, days=DIGEST_DAYS + 3)
    window = [c for c in candles if c.close > 0][-(DIGEST_DAYS + 1):]
    if len(window) < 2:
        return {"available": False}

    closes = [c.close for c in window]
    week = window[1:]
    return {
        "available": True,
        "change_pct": (closes[-1] - closes[0]) / closes[0] * 100,
        "close_eur": closes[-1],
        "high_eur": max(c.high for c in week),
        "low_eur": min(c.low for c in week),
        # The yardstick for `_timing`: what an evenly spread week would have paid.
        "avg_close_eur": sum(c.close for c in week) / len(week),
    }


def _timing(week: dict, market: dict) -> dict:
    """Whether this week's buying landed below the week's own average price.

    The same idea as the cost basis in `holdings.py`, over seven days instead of
    the whole history — it is the only honest way to judge a single week, since
    the price going up is not the same as having bought well.
    """
    paid = week["avg_price_eur"]
    average = market.get("avg_close_eur", 0.0) if market.get("available") else 0.0
    if not week["buys"] or paid <= 0 or average <= 0:
        return {"available": False}
    return {
        "available": True,
        "paid_eur": paid,
        "avg_close_eur": average,
        "advantage_pct": (average - paid) / average * 100,
    }


def build(session: Session) -> dict:
    """Everything the digest can report, whether or not a block is switched on.

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
    week = _week(purchases)
    market = _market(session)
    total_sats = performance["btc_total"] * SATS_PER_BTC

    today = date.today()
    return {
        "dry_run": settings.dry_run,
        "span": {
            "from": (today - timedelta(days=DIGEST_DAYS - 1)).isoformat(),
            "to": today.isoformat(),
        },
        "week": week,
        "market": market,
        "timing": _timing(week, market),
        "total": {
            "buys": performance["purchase_count"],
            "invested_eur": performance["invested_eur"],
            "value_eur": performance["value_eur"],
            "profit_eur": performance["profit_eur"],
            "profit_pct": performance["profit_pct"],
            "sats": total_sats,
        },
        "vs_dca": {
            "eur": performance["profit_eur"] - dca["profit_eur"],
            "pp": performance["profit_pct"] - dca["profit_pct"],
        },
        "cost_basis": stack["cost_basis"],
        "milestone": outlook.next_milestone(
            total_sats, outlook.rate_per_week(purchases)["sats"]
        ),
        "streak": outlook.streak(purchases),
        "holdings": {
            "free_sats": stack["free"]["btc"] * SATS_PER_BTC,
            "locked_sats": stack["locked"]["btc"] * SATS_PER_BTC,
            "next_free_date": stack["next_free_date"],
            "next_free_in_days": stack["next_free_in_days"],
        },
        "excluded": stack["excluded"],
        "analysis": analysis,
        "next_run": scheduler.next_run_time(),
        "next_amount_eur": settings.base_amount_eur * analysis.multiplier,
    }


def send(session: Session, force: bool = False) -> bool:
    """Builds the digest and hands it to the notifier. Never raises.

    `force` is what the frontend's "send now" uses: a report asked for by hand
    goes out even while the weekly schedule is switched off.
    """
    from . import notifier

    settings = load_settings(session)
    digest_settings = load_digest_settings(session)
    if not (force or digest_settings.enabled):
        logger.info("Weekly digest is switched off - not sending")
        return False

    try:
        return notifier.send_digest_notification(
            build(session), enabled_keys(digest_settings), settings.discord_enabled
        )
    except Exception:
        logger.exception("Weekly digest failed")
        return False

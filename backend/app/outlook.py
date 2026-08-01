"""Where the drip is going, rather than where it has been.

Every other figure on the dashboard looks backwards. This one answers the
question a saver actually asks after the first year — *if I leave it alone,
what does that get me?* — from the only honest evidence available: the rate the
bot has actually been stacking at recently, carried forward.

The milestone ladder and the weekly rate live here rather than in `digest.py`,
which was where they started: the weekly report and this card have to agree
about how far off the next round number is, and one of them reads it out loud
on Discord. Nothing here writes to the database.

The euro side of the projection is arithmetic on the schedule and is about as
solid as anything here gets. The sats side is not: it prices future buys at
today's price, which is the one number nobody has. It is reported as such, and
the frontend says so under the card.
"""
import math
from datetime import date, datetime, timedelta

from sqlmodel import Session

from . import analytics
from .models import Purchase

SATS_PER_BTC = 100_000_000

WEEK_DAYS = 7
WEEKS_PER_YEAR = 52

# How far back the "per week" rate looks. Eight weeks is long enough to average
# over the multiplier swinging between 0.5x and 1.5x, and short enough to follow
# a base amount the owner changed last month.
RATE_WEEKS = 8

# Round numbers a saver actually aims at, in sats. The middle rungs are the BTC
# fractions people think in (0.05, 0.1, 0.5, 0.75, a whole coin) plus 21M, the
# number bitcoiners count by; above a coin it carries on in whole ones. Kept
# close enough together that the next one is always in sight — a ladder that
# jumps from half a coin to a whole one reports "4% there" for years, which is
# true and useless — and it has to run past any stack it might meet, or the
# report and the card both go quiet on the savers who got furthest.
MILESTONES = [
    100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
    21_000_000, 35_000_000, 50_000_000, 75_000_000, 100_000_000,
    150_000_000, 200_000_000, 300_000_000, 500_000_000, 750_000_000,
    1_000_000_000, 2_100_000_000,
]


def rate_per_week(purchases: list[Purchase]) -> dict:
    """What the drip has actually been putting in per week, lately.

    Averaged over `RATE_WEEKS` whole weeks rather than read off the settings,
    so a paused fortnight or a run of 0.5x weeks shows up instead of being
    projected away.
    """
    since = datetime.now() - timedelta(days=WEEK_DAYS * RATE_WEEKS)
    recent = [p for p in purchases if p.timestamp >= since]
    if not recent:
        return {"eur": 0.0, "sats": 0.0, "buys": 0}
    return {
        "eur": sum(p.amount_eur for p in recent) / RATE_WEEKS,
        "sats": sum(p.btc_amount for p in recent) * SATS_PER_BTC / RATE_WEEKS,
        "buys": len(recent),
    }


def next_milestone(sats: float, sats_per_week: float) -> dict:
    """The next round number of sats and how far the drip still is from it."""
    target = next((m for m in MILESTONES if m > sats), None)
    if target is None or sats <= 0:
        return {"available": False}

    previous = max((m for m in MILESTONES if m <= sats), default=0)
    weeks = math.ceil((target - sats) / sats_per_week) if sats_per_week > 0 else None
    return {
        "available": True,
        "target_sats": target,
        "remaining_sats": target - sats,
        "progress_pct": (sats - previous) / (target - previous) * 100,
        "weeks_away": weeks,
    }


def _week_key(day: date) -> tuple[int, int]:
    year, week, _ = day.isocalendar()
    return year, week


def streak(purchases: list[Purchase]) -> dict:
    """Consecutive calendar weeks with at least one buy.

    Counting starts at last week when this week has no buy yet, so a dashboard
    opened on a Sunday does not report a broken streak just because the next
    drip is still a day or two out.
    """
    weeks = {_week_key(p.timestamp.date()) for p in purchases}
    if not weeks:
        return {"weeks": 0, "total_weeks": 0}

    cursor = date.today()
    if _week_key(cursor) not in weeks:
        cursor -= timedelta(days=WEEK_DAYS)

    count = 0
    while _week_key(cursor) in weeks:
        count += 1
        cursor -= timedelta(days=WEEK_DAYS)
    return {"weeks": count, "total_weeks": len(weeks)}


def summary(session: Session, include_dry_run: bool = True) -> dict:
    """The whole forward-looking card in one call."""
    purchases = analytics.relevant_purchases(session, include_dry_run)
    performance = analytics.performance_summary(session, include_dry_run)

    sats = performance["btc_total"] * SATS_PER_BTC
    rate = rate_per_week(purchases)
    milestone = next_milestone(sats, rate["sats"])

    if milestone["available"] and milestone["weeks_away"] is not None:
        eta = (date.today() + timedelta(days=WEEK_DAYS * milestone["weeks_away"])).isoformat()
    else:
        eta = None

    price = performance["current_price"]
    year_eur = rate["eur"] * WEEKS_PER_YEAR
    return {
        "sats": sats,
        "invested_eur": performance["invested_eur"],
        "current_price": price,
        "rate_weeks": RATE_WEEKS,
        "per_week_eur": rate["eur"],
        "per_week_sats": rate["sats"],
        # A year of the same schedule: euros are arithmetic, sats are today's
        # price held flat for a year and are only ever an order of magnitude.
        "year_eur": year_eur,
        "year_sats": (year_eur / price * SATS_PER_BTC) if price > 0 else 0.0,
        "milestone": {**milestone, "eta": eta},
        "streak": streak(purchases),
    }

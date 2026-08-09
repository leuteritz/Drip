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

from . import analytics, cadence
from .models import Purchase

SATS_PER_BTC = 100_000_000

WEEK_DAYS = 7
WEEKS_PER_YEAR = 52

# How far back the "per week" rate looks. Eight weeks is long enough to average
# over the multiplier swinging between 0.5x and 1.5x, and short enough to follow
# a base amount the owner changed last month.
RATE_WEEKS = 8
# ...but never fewer than this many of the drip's own periods, whatever they
# are. Eight weeks holds two monthly buys, and a rate averaged over two samples
# follows the multiplier rather than the schedule — one 0.5x month would halve
# the projection. Four periods is the floor; for anything up to fortnightly the
# eight weeks above is already the longer of the two and nothing changes.
RATE_PERIODS = 4

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


def rate_days(key: str) -> float:
    """How long a window the rate is averaged over, for one cadence."""
    return max(WEEK_DAYS * RATE_WEEKS, cadence.get(key).days * RATE_PERIODS)


def rate_per_week(purchases: list[Purchase], key: str = cadence.DEFAULT) -> dict:
    """What the drip has actually been putting in per week, lately.

    Measured from the rows rather than read off the settings, so a paused
    fortnight or a run of 0.5x buys shows up instead of being projected away.

    **Per week whatever the cadence is**, and deliberately so: it is the unit the
    card and the report both speak, and a figure that changed its meaning with a
    setting would make two installs incomparable and one install incomparable
    with its own past. What the cadence changes is the *window* — see
    `RATE_PERIODS` — and the division is by however many weeks that came to.
    """
    days = rate_days(key)
    since = datetime.now() - timedelta(days=days)
    recent = [p for p in purchases if p.timestamp >= since]
    if not recent:
        return {"eur": 0.0, "sats": 0.0, "buys": 0}

    weeks = days / WEEK_DAYS
    return {
        "eur": sum(p.amount_eur for p in recent) / weeks,
        "sats": sum(p.btc_amount for p in recent) * SATS_PER_BTC / weeks,
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


def streak(purchases: list[Purchase], key: str = cadence.DEFAULT) -> dict:
    """Consecutive periods of the drip's own cadence with at least one buy.

    Counted in periods rather than in weeks, which was the same thing right up
    until the cadence became a setting: a monthly saver who has never missed one
    was reporting a streak of 1, because three weeks in four hold no buy and
    never were meant to.

    Counting starts at the previous period when the current one has no buy yet,
    so a dashboard opened the day before the drip does not report a broken
    streak just because the next one is still out.
    """
    starts = {cadence.period_start(p.timestamp.date(), key) for p in purchases}
    if not starts:
        return {"periods": 0, "total_periods": 0, "cadence": key}

    cursor = cadence.period_start(date.today(), key)
    if cursor not in starts:
        cursor = cadence.advance(cursor, key, -1)

    count = 0
    while cursor in starts:
        count += 1
        cursor = cadence.advance(cursor, key, -1)
    return {"periods": count, "total_periods": len(starts), "cadence": key}


def summary(session: Session, include_dry_run: bool = True) -> dict:
    """The whole forward-looking card in one call."""
    from .database import load_settings

    purchases = analytics.relevant_purchases(session, include_dry_run)
    performance = analytics.performance_summary(session, include_dry_run)
    key = cadence.get(load_settings(session).cadence).key

    sats = performance["btc_total"] * SATS_PER_BTC
    rate = rate_per_week(purchases, key)
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
        "cadence": key,
        # Reported rather than the constant, because the window follows the
        # cadence now — the card says "over the last N weeks" and has to mean it.
        "rate_weeks": round(rate_days(key) / WEEK_DAYS),
        "per_week_eur": rate["eur"],
        "per_week_sats": rate["sats"],
        # A year of the same schedule: euros are arithmetic, sats are today's
        # price held flat for a year and are only ever an order of magnitude.
        "year_eur": year_eur,
        "year_sats": (year_eur / price * SATS_PER_BTC) if price > 0 else 0.0,
        "milestone": {**milestone, "eta": eta},
        "streak": streak(purchases, key),
    }

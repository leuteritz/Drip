"""Whether the drip actually dripped.

Every other figure here is about buys that happened. This one is about the weeks
nothing did — the single thing a savings bot can get wrong that its own history
cannot show, because a missed week leaves no row behind. A Pi loses power, an SD
card fills up, a container is left stopped after an update, the network is down
at nine on Monday morning: APScheduler's misfire grace is an hour, and past that
the week is simply gone. Silently. Meanwhile the stack above carries on
reporting a healthy average made only of the buys that did land.

Three things this is careful about.

*Every run counts, test or live.* The question is whether the machine woke up,
not whether it spent money — so unlike the rest of the dashboard this ignores
the dry-run filter entirely, and a week whose only row is a failed order gets a
third state of its own rather than being counted as silence.

*A pause is not a gap, and cannot always be told apart from one.* Drip stores
`paused_until` and no history of it, so a fortnight paused last winter looks
exactly like a fortnight switched off at the wall. The card says so rather than
pretending otherwise. The one pause that *is* knowable — the current one —
suppresses the overdue warning, because a bot deliberately paused has not
failed.

*What a gap cost is priced, not guessed.* A missed week is worth one buy at
today's base amount and that day's close, read out of the candle cache — no new
API and no new failure mode — and the candles are only touched when there is a
gap to price at all.

Read-only, like `holdings`, `outlook` and `research`. Nothing here writes — the
one thing that acts on any of it is `scheduler`, which asks `missed_slot` once a
day whether the last slot went by unanswered and hands the buy to `bot`.
"""
from datetime import date, datetime, time, timedelta

from sqlmodel import Session, select

from .bot import is_paused
from .constants import ORDER_ID_ERROR
from .database import load_settings
from .market_data import ensure_candles
from .models import Purchase

SATS_PER_BTC = 100_000_000

# How far back the card looks. A year is long enough that a run of dead weeks
# last autumn is still visible, and short enough to stay one glance wide.
WEEKS = 52
# The weekly report asks the same question over a much shorter window: what it
# has to say is "did the last three months hold up", not "plot me a year".
DIGEST_WEEKS = 12

# How far either side of a missed week's own day a closing price is accepted
# from, before the gap is reported without one.
PRICE_SEARCH_DAYS = 4

LANDED = "landed"
FAILED = "failed"
MISSED = "missed"


def _week_start(day: date) -> date:
    """The Monday of that day's week. Weeks are the bot's own unit."""
    return day - timedelta(days=day.weekday())


def _last_slot(weekday: int, schedule_time: str, now: datetime) -> datetime:
    """The most recent moment the schedule said to buy, at or before `now`.

    This is what makes the current week judgable at all: a week whose slot is
    still ahead has not missed anything, and counting it as a gap would report a
    failure every Sunday evening.
    """
    hour, minute = (int(x) for x in schedule_time.split(":"))
    days_back = (now.weekday() - weekday) % 7
    slot = datetime.combine(now.date() - timedelta(days=days_back), time(hour, minute))
    return slot - timedelta(days=7) if slot > now else slot


def _close_near(prices: dict[date, float], day: date) -> float:
    """That day's close, or the nearest one within a few days either side.

    Coinbase has a candle for every day, but the cache is only guaranteed back
    to what something else has already asked for — and a gap being priced a day
    late is worth far more than a gap reported without a number.
    """
    for offset in range(PRICE_SEARCH_DAYS + 1):
        for candidate in (day - timedelta(days=offset), day + timedelta(days=offset)):
            if prices.get(candidate):
                return prices[candidate]
    return 0.0


def _empty(weeks: int, as_of: date, base_amount: float) -> dict:
    return {
        "as_of": as_of.isoformat(),
        "window_weeks": weeks,
        "weeks_checked": 0,
        "landed": 0,
        "failed": 0,
        "missed": 0,
        "coverage_pct": 0.0,
        "base_amount_eur": base_amount,
        "first_buy": None,
        "weeks": [],
        "gaps": [],
        "gap_cost": {"eur": 0.0, "sats": 0.0},
        "overdue": {"overdue": False, "since": None, "days": 0, "paused": False},
    }


def missed_slot(session: Session) -> datetime | None:
    """The last scheduled moment that came and went without the bot waking up.

    `_overdue` asks this so the card can say it; this answers it for the
    scheduler, which is the only thing that can still do something about it. It
    returns the slot itself rather than a flag, so the buy it triggers can say
    how late it is instead of pretending to be this week's.

    Three ways there is nothing to catch up, and each is a way of not buying at
    a moment nobody chose:

    * **Paused.** A bot told to skip the week has not missed it.
    * **No history at all.** Drip cannot have missed a week it did not exist
      for — the same rule the window uses — and a fresh install must never spend
      money on its first boot.
    * **Something already ran at or after the slot.** A landed buy, a dry run
      and a failed order all count: the machine woke up. A refused order is the
      exchange's answer and not a gap, and asking it again tomorrow would be a
      bot arguing with a decision it has already been given.

    Only ever the *last* slot, which is at most a week old. A Pi that was off
    for two months comes back to one buy, not to eight at once.
    """
    settings = load_settings(session)
    if is_paused(settings.paused_until):
        return None

    if session.exec(select(Purchase).limit(1)).first() is None:
        return None

    slot = _last_slot(settings.schedule_weekday, settings.schedule_time, datetime.now())
    ran = session.exec(select(Purchase).where(Purchase.timestamp >= slot).limit(1))
    return None if ran.first() else slot


def summary(session: Session, weeks: int = WEEKS) -> dict:
    """Every week since the first buy, up to `weeks` of them, and what landed.

    The window ends at the week holding the last scheduled slot and begins at
    the first buy — Drip cannot have missed a week it did not exist for.
    """
    settings = load_settings(session)
    now = datetime.now()
    today = now.date()

    rows = list(session.exec(select(Purchase).order_by(Purchase.timestamp)).all())
    if not rows:
        return _empty(weeks, today, settings.base_amount_eur)

    slot = _last_slot(settings.schedule_weekday, settings.schedule_time, now)
    last_week = _week_start(slot.date())
    first_week = _week_start(rows[0].timestamp.date())
    if first_week > last_week:
        # The whole history is inside the week that has not had its slot yet.
        return _empty(weeks, today, settings.base_amount_eur)

    start = max(first_week, last_week - timedelta(days=7 * (weeks - 1)))
    span = (last_week - start).days // 7 + 1

    by_week: dict[date, list[Purchase]] = {}
    for row in rows:
        by_week.setdefault(_week_start(row.timestamp.date()), []).append(row)

    window: list[dict] = []
    for index in range(span):
        week_start = start + timedelta(days=7 * index)
        found = by_week.get(week_start, [])
        real = [p for p in found if p.order_id != ORDER_ID_ERROR]
        window.append({
            "start": week_start.isoformat(),
            # The day the schedule would have bought on. Only ever read for a
            # missed week: what a week that landed is worth is on its own rows.
            "expected": (week_start + timedelta(days=settings.schedule_weekday)).isoformat(),
            "state": LANDED if real else FAILED if found else MISSED,
            "buys": len(real),
            "eur": sum(p.amount_eur for p in real),
            "sats": sum(p.btc_amount for p in real) * SATS_PER_BTC,
        })

    gaps = _price_gaps(session, window, settings.base_amount_eur, today)
    landed = sum(1 for w in window if w["state"] == LANDED)
    failed = sum(1 for w in window if w["state"] == FAILED)

    return {
        "as_of": today.isoformat(),
        "window_weeks": weeks,
        "weeks_checked": len(window),
        "landed": landed,
        "failed": failed,
        "missed": len(gaps),
        "coverage_pct": landed / len(window) * 100 if window else 0.0,
        "base_amount_eur": settings.base_amount_eur,
        "first_buy": rows[0].timestamp.date().isoformat(),
        "weeks": window,
        # Most recent first: the gap you can still do something about is the
        # one at the top.
        "gaps": list(reversed(gaps)),
        "gap_cost": {
            "eur": sum(g["eur"] for g in gaps),
            "sats": sum(g["sats"] for g in gaps),
        },
        "overdue": _overdue(rows, settings, slot, now),
    }


def _price_gaps(session: Session, window: list[dict], base: float,
                today: date) -> list[dict]:
    """What each missed week would have bought, oldest first.

    Priced at one base-amount buy — the multiplier that week is not knowable
    without re-scoring the day, and a gap reported as "about a base buy" is
    honest in a way a reconstructed 1.25x would not be.
    """
    missed = [w for w in window if w["state"] == MISSED]
    if not missed:
        return []

    earliest = date.fromisoformat(missed[0]["expected"])
    needed = (today - earliest).days + PRICE_SEARCH_DAYS + 2
    prices = {
        c.day: c.close
        for c in ensure_candles(session, days=max(needed, 7))
        if c.close > 0
    }

    gaps: list[dict] = []
    for week in missed:
        day = date.fromisoformat(week["expected"])
        price = _close_near(prices, day)
        gaps.append({
            "week_start": week["start"],
            "expected": week["expected"],
            "price_eur": price,
            "eur": base,
            "sats": (base / price * SATS_PER_BTC) if price else 0.0,
        })
    return gaps


def _overdue(rows: list[Purchase], settings, slot: datetime, now: datetime) -> dict:
    """Whether the last scheduled buy simply never arrived.

    The one figure here that is about right now rather than about the record,
    and the only one worth a warning: everything else on this card is history.
    A paused bot is never overdue — it is doing what it was told.
    """
    paused = is_paused(settings.paused_until)
    landed = any(row.timestamp >= slot for row in rows)
    return {
        "overdue": not paused and not landed,
        "since": slot.isoformat(),
        "days": max((now - slot).days, 0),
        "paused": paused,
    }

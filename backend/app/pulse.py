"""Whether the drip actually dripped.

Every other figure here is about buys that happened. This one is about the
periods nothing did — the single thing a savings bot can get wrong that its own
history cannot show, because a missed slot leaves no row behind. A Pi loses
power, an SD card fills up, a container is left stopped after an update, the
network is down at nine on Monday morning: APScheduler's misfire grace is an
hour, and past that the period is simply gone. Silently. Meanwhile the stack
above carries on reporting a healthy average made only of the buys that landed.

**A period is whatever the cadence says it is**, and that is the one thing this
module deliberately does not decide. It used to: every bucket here was an ISO
week, computed inline, back when weekly was not a setting but an assumption. The
day the cadence became a setting that assumption turned dangerous rather than
merely wrong — `missed_slot` hands a buy to the scheduler, so a monthly install
judged by the week would have caught up three phantom buys a month, with real
money. `cadence.py` answers what a period is; everything below asks it.

Three things this is careful about.

*Every run counts, test or live.* The question is whether the machine woke up,
not whether it spent money — so unlike the rest of the dashboard this ignores
the dry-run filter entirely, and a period whose only row is a failed order gets a
third state of its own rather than being counted as silence.

*A pause is not a gap.* A period nobody wanted is not one that went wrong, so it
gets a state of its own and leaves the coverage figure alone entirely — counted
neither as kept nor as lost, because a holiday is not a score. What makes that
possible is `pauses`, which records the stretches Drip was told to stand still
for; `paused_until` on its own is an instruction about today and remembers
nothing. The current pause also suppresses the overdue warning, for the same
reason it always did.

The record only reaches back to the first pause that was written down. Periods
before that stay silent rather than being guessed at — this module never infers
a pause from a gap, which is exactly the lie it exists to avoid.

*What a gap cost is priced, not guessed.* A missed period is worth one buy at
today's base amount and that day's close, read out of the candle cache — no new
API and no new failure mode — and the candles are only touched when there is a
gap to price at all.

Read-only, like `holdings`, `outlook` and `research`. Nothing here writes — the
one thing that acts on any of it is `scheduler`, which asks `missed_slot` once a
day whether the last slot went by unanswered and hands the buy to `bot`.
"""
from datetime import date, datetime, timedelta

from sqlmodel import Session, select

from . import cadence, pauses
from .bot import is_paused
from .constants import ORDER_ID_ERROR
from .database import load_settings
from .market_data import ensure_candles
from .models import Purchase

SATS_PER_BTC = 100_000_000

# How far back the card looks: a year of the drip, capped at what a strip of
# marks can still be read as. A year is long enough that a run of dead periods
# last autumn is still visible; the cap is what stops a daily install plotting
# 365 hairlines. Daily therefore shows a quarter, and the other three a year.
MAX_MARKS = 120
# The weekly report asks the same question over a much shorter window: what it
# has to say is "did the last few months hold up", not "plot me a year".
DIGEST_SHARE = 4

# How far either side of a missed period's own day a closing price is accepted
# from, before the gap is reported without one.
PRICE_SEARCH_DAYS = 4

LANDED = "landed"
FAILED = "failed"
MISSED = "missed"
# A period whose slot fell inside a recorded pause. Never a fault, never priced,
# and never in the coverage figure's denominator — see `_state`.
PAUSED = "paused"


def window_periods(key: str) -> int:
    """How many periods the card plots for a cadence — a year, within reason."""
    return min(int(cadence.get(key).per_year), MAX_MARKS)


def digest_periods(key: str) -> int:
    """The report's shorter window: a quarter of the card's, at least four."""
    return max(window_periods(key) // DIGEST_SHARE, 4)


def _state(found: list[Purchase], real: list[Purchase], slot: datetime,
           recorded: list) -> str:
    """What to call a period.

    A run of any kind outranks the pause record, because this card is about
    whether the machine woke up: a dry run inside a paused fortnight is still
    the Pi saying hello, and a failed order is still the exchange answering.
    Only a silent period is read against the record — and a silent one that was
    asked for is not a gap at all.
    """
    if real:
        return LANDED
    if found:
        return FAILED
    return PAUSED if pauses.covers(recorded, slot) else MISSED


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


def _empty(periods: int, key: str, as_of: date, base_amount: float) -> dict:
    return {
        "as_of": as_of.isoformat(),
        "cadence": key,
        "window_periods": periods,
        "periods_checked": 0,
        "landed": 0,
        "failed": 0,
        "missed": 0,
        "paused": 0,
        "periods_judged": 0,
        "coverage_pct": 0.0,
        "base_amount_eur": base_amount,
        "first_buy": None,
        "periods": [],
        "gaps": [],
        "gap_cost": {"eur": 0.0, "sats": 0.0},
        "overdue": {"overdue": False, "since": None, "days": 0, "paused": False},
    }


def missed_slot(session: Session) -> datetime | None:
    """The last scheduled moment that came and went without the bot waking up.

    `_overdue` asks this so the card can say it; this answers it for the
    scheduler, which is the only thing that can still do something about it. It
    returns the slot itself rather than a flag, so the buy it triggers can say
    how late it is instead of pretending to be this period's.

    Four ways there is nothing to catch up, and each is a way of not buying at
    a moment nobody chose:

    * **Paused.** A bot told to skip the period has not missed it.
    * **Paused *then*.** A pause that has since run out still covers the slot it
      ran over: a fortnight off used to end with Drip buying the week it had
      just been told to skip, because by the time it looked, `paused_until` said
      nothing had ever been asked for. The record in `pauses` is what closes
      that — the one place here where remembering a pause stops money moving
      rather than only relabelling a square on a card.
    * **No history at all.** Drip cannot have missed a period it did not exist
      for — the same rule the window uses — and a fresh install must never spend
      money on its first boot.
    * **Something already ran at or after the slot.** A landed buy, a dry run
      and a failed order all count: the machine woke up. A refused order is the
      exchange's answer and not a gap, and asking it again tomorrow would be a
      bot arguing with a decision it has already been given.

    Only ever the *last* slot, which is at most one period old. A Pi that was off
    for two months comes back to one buy, not to eight at once — and on a daily
    cadence that same rule means one buy, not sixty.
    """
    settings = load_settings(session)
    if is_paused(settings.paused_until):
        return None

    if session.exec(select(Purchase).limit(1)).first() is None:
        return None

    slot = cadence.last_slot(
        settings.cadence, settings.schedule_weekday, settings.schedule_time,
        datetime.now(),
    )
    if pauses.covers(pauses.windows(session, since=slot.date()), slot):
        return None

    ran = session.exec(select(Purchase).where(Purchase.timestamp >= slot).limit(1))
    return None if ran.first() else slot


def summary(session: Session, periods: int | None = None) -> dict:
    """Every period since the first buy, up to `periods` of them, and what landed.

    The window ends at the period holding the last scheduled slot and begins at
    the first buy — Drip cannot have missed a period it did not exist for.
    """
    settings = load_settings(session)
    key = cadence.get(settings.cadence).key
    span_wanted = periods or window_periods(key)
    now = datetime.now()
    today = now.date()

    rows = list(session.exec(select(Purchase).order_by(Purchase.timestamp)).all())
    if not rows:
        return _empty(span_wanted, key, today, settings.base_amount_eur)

    slot = cadence.last_slot(
        key, settings.schedule_weekday, settings.schedule_time, now)
    last_start = cadence.period_start(slot.date(), key)
    first_start = cadence.period_start(rows[0].timestamp.date(), key)
    if first_start > last_start:
        # The whole history is inside the period that has not had its slot yet.
        return _empty(span_wanted, key, today, settings.base_amount_eur)

    # Walk back from the last period rather than subtracting a length: a month
    # has none, and this is the one arithmetic the cadence has to own.
    earliest = cadence.advance(last_start, key, -(span_wanted - 1))
    start = max(first_start, earliest)
    span = cadence.periods_between(start, last_start, key)

    by_period: dict[date, list[Purchase]] = {}
    for row in rows:
        by_period.setdefault(
            cadence.period_start(row.timestamp.date(), key), []).append(row)

    # Only pauses that can still reach into the plotted span — one lifted before
    # the window opens has nothing here to explain.
    recorded = pauses.windows(session, since=start)

    window: list[dict] = []
    for index in range(span):
        period_start = cadence.advance(start, key, index)
        # The day the schedule would have bought on. Read for a missed period, to
        # price it, and for a silent one, to ask whether it was asked for.
        expected = cadence.slot_day(period_start, key, settings.schedule_weekday)
        found = by_period.get(period_start, [])
        real = [p for p in found if p.order_id != ORDER_ID_ERROR]
        window.append({
            "start": period_start.isoformat(),
            "expected": expected.isoformat(),
            "state": _state(
                found, real,
                cadence.slot_in(period_start, key, settings.schedule_weekday,
                                settings.schedule_time),
                recorded,
            ),
            "buys": len(real),
            "eur": sum(p.amount_eur for p in real),
            "sats": sum(p.btc_amount for p in real) * SATS_PER_BTC,
        })

    gaps = _price_gaps(session, window, settings.base_amount_eur, today)
    landed = sum(1 for w in window if w["state"] == LANDED)
    failed = sum(1 for w in window if w["state"] == FAILED)
    paused = sum(1 for w in window if w["state"] == PAUSED)
    # Periods nobody wanted are out of the denominator, not counted against it: a
    # fortnight off is not 96% of a year, it is a fortnight that was never a
    # question. Judging what is left is what keeps the figure worth reading.
    judged = len(window) - paused

    return {
        "as_of": today.isoformat(),
        "cadence": key,
        "window_periods": span_wanted,
        "periods_checked": len(window),
        "landed": landed,
        "failed": failed,
        "missed": len(gaps),
        "paused": paused,
        "periods_judged": judged,
        "coverage_pct": landed / judged * 100 if judged else 0.0,
        "base_amount_eur": settings.base_amount_eur,
        "first_buy": rows[0].timestamp.date().isoformat(),
        "periods": window,
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
    """What each missed period would have bought, oldest first.

    Priced at one base-amount buy — the multiplier that period is not knowable
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
    for period in missed:
        day = date.fromisoformat(period["expected"])
        price = _close_near(prices, day)
        gaps.append({
            "period_start": period["start"],
            "expected": period["expected"],
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

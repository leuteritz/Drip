"""How often the drip drips, and what "a slot" means once it is not weekly.

Drip was a weekly bot in the strongest sense: the week was not a setting, it was
an assumption baked into four modules at once. `scheduler` built a weekly cron,
`pulse` bucketed the history by ISO week and asked whether each one held a buy,
`outlook` counted a streak in weeks, and `digest` reported the last seven days.
Every one of those was right, and every one of them would have been wrong the
moment somebody bought monthly — most damagingly `pulse`, whose `missed_slot`
hands a buy to the scheduler: a monthly bot on a weekly notion of "missed" would
have caught up three phantom buys a month, with real money.

So the week became a *period*, and this module is the only place that knows what
one is. Everything else asks. Three ideas carry it:

- **A period is a stretch of calendar, and a slot is the one moment inside it the
  buy is due.** `period_start` says which stretch a day belongs to, `advance`
  steps to the next, and `slot_in` says when inside one the drip lands. That is
  the whole vocabulary `pulse` needs, and it replaces the `_week_start` /
  `+ weekday` pair it used to compute inline.
- **The existing settings still describe it.** `schedule_weekday` and
  `schedule_time` were already there and still mean what they meant; a cadence
  only changes how often that weekday comes round. Monthly is therefore *the
  first such weekday of the month* rather than a day number — it needs no new
  column, it never lands on a 31st that half the months do not have, and it
  reads the way people actually say it ("the first Monday"). Daily is the one
  that ignores the weekday, because every day is one.
- **Fortnightly is anchored to a fixed epoch, not to the install.** `_EPOCH` is a
  Monday, and a fortnight is whichever side of it the week index falls. Anchoring
  to the first purchase was the alternative and it is a trap: deleting the oldest
  row would silently shift every period boundary in the history, and the card
  above would redraw itself into a different past.

`per_year` is the other half of the module's job — the conversion the forward
figures need, so a monthly saver's "per week" rate and a daily one's are the same
kind of number. It is nominal (365 / 52 / 26 / 12) rather than measured, because
it describes the *schedule*; what actually happened is `outlook.rate_per_week`'s
business and is measured from the rows.

Pure and calendar-only: nothing here reads the database or the clock beyond what
it is handed.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

DAILY = "daily"
WEEKLY = "weekly"
BIWEEKLY = "biweekly"
MONTHLY = "monthly"

# A Monday, and an arbitrary one — what matters is only that it never moves. See
# the module docstring on why the fortnight is not anchored to the install.
_EPOCH = date(1970, 1, 5)


@dataclass(frozen=True)
class Cadence:
    """One rhythm, and everything the rest of the app asks about it.

    `days` is the nominal length of a period, used for window sizes and for
    turning a rate into another rate. `per_year` is the same fact from the other
    end and is kept separate because a month is not 30 days often enough to
    matter over a year.

    `unit` / `units` are the words the frontend and the digest put around a
    count, served from here for the same reason `digest.BLOCKS` is: a second copy
    of "fortnight" in a component is a second thing to keep true.
    """

    key: str
    label: str
    note: str
    days: float
    per_year: float
    unit: str
    units: str


CADENCES: tuple[Cadence, ...] = (
    Cadence(DAILY, "Every day", "A buy every day, at the same time.",
            1.0, 365.0, "day", "days"),
    Cadence(WEEKLY, "Every week", "One buy a week, on the day you pick.",
            7.0, 52.0, "week", "weeks"),
    Cadence(BIWEEKLY, "Every two weeks", "One buy a fortnight, on the day you pick.",
            14.0, 26.0, "fortnight", "fortnights"),
    Cadence(MONTHLY, "Every month", "One buy a month, on the first such weekday.",
            30.44, 12.0, "month", "months"),
)

KEYS = tuple(c.key for c in CADENCES)
BY_KEY = {c.key: c for c in CADENCES}
DEFAULT = WEEKLY


def get(key: str | None) -> Cadence:
    """The cadence for a stored value, falling back to weekly.

    Never raises on an unknown word. A column holding something this version
    does not recognise is a database from a later Drip or a hand edit, and the
    honest reading of it is the schedule every install had before cadences
    existed — not a crash on the page that would let you fix it.
    """
    return BY_KEY.get(key or "", BY_KEY[DEFAULT])


# --- Periods ----------------------------------------------------------------

def period_start(day: date, key: str) -> date:
    """The first day of the stretch of calendar `day` falls in.

    Weeks and fortnights start on a Monday whatever the buy's own weekday is —
    the period is a piece of calendar, not a window hung off the schedule, so
    moving the drip from Monday to Friday does not re-bucket the whole history.
    """
    cadence = get(key)
    if cadence.key == DAILY:
        return day
    if cadence.key == MONTHLY:
        return day.replace(day=1)

    monday = day - timedelta(days=day.weekday())
    if cadence.key == BIWEEKLY and ((monday - _EPOCH).days // 7) % 2:
        monday -= timedelta(days=7)
    return monday


def advance(start: date, key: str, periods: int = 1) -> date:
    """`periods` whole periods on from the start of one. Exact, not approximate."""
    cadence = get(key)
    if cadence.key == DAILY:
        return start + timedelta(days=periods)
    if cadence.key == MONTHLY:
        month = start.month - 1 + periods
        return date(start.year + month // 12, month % 12 + 1, 1)
    return start + timedelta(days=int(cadence.days) * periods)


def periods_between(start: date, end: date, key: str) -> int:
    """How many period boundaries lie between two period starts, `end` included.

    Counted by stepping rather than by dividing, because a month has no fixed
    length and the whole point of this module is not to pretend otherwise.
    """
    if end < start:
        return 0
    if get(key).key == MONTHLY:
        return (end.year - start.year) * 12 + end.month - start.month + 1
    return int((end - start).days // get(key).days) + 1


def slot_day(start: date, key: str, weekday: int) -> date:
    """The day inside a period the buy is due on.

    Daily has no weekday to honour — every day is the period — so it is the day
    itself. Everything else lands on the first matching weekday at or after the
    period's Monday, which for a month is exactly "the first Monday in it".
    """
    if get(key).key == DAILY:
        return start
    return start + timedelta(days=(weekday - start.weekday()) % 7)


def slot_in(start: date, key: str, weekday: int, schedule_time: str) -> datetime:
    """The exact moment a period's buy is due.

    A pause is compared against the moment and not the date, so this returns one:
    a pause asked for on Monday afternoon cannot excuse a buy that was due that
    morning.
    """
    hour, minute = (int(x) for x in schedule_time.split(":"))
    return datetime.combine(slot_day(start, key, weekday), time(hour, minute))


def last_slot(key: str, weekday: int, schedule_time: str, now: datetime) -> datetime:
    """The most recent moment the schedule said to buy, at or before `now`.

    This is what makes the current period judgable at all: one whose slot is
    still ahead has not missed anything, and counting it as a gap would report a
    failure every Sunday evening. Walks back a period at a time rather than
    subtracting a fixed number of days, since a month is not one.
    """
    start = period_start(now.date(), key)
    slot = slot_in(start, key, weekday, schedule_time)
    if slot <= now:
        return slot
    return slot_in(advance(start, key, -1), key, weekday, schedule_time)

"""What the bot was told to skip, and when.

`BotSettings.paused_until` is an instruction about right now: it answers "should
this week's buy happen" and forgets the moment it expires. That was the one
thing `pulse` could not see. Every week without a buy looked the same to it, so
a fortnight somebody deliberately skipped was reported as a fortnight the drip
failed to land in — the card's coverage figure counted a holiday as a fault, and
worse, `missed_slot` would buy that week the moment the pause ran out.

A `PauseWindow` row is the fact that was missing. It is written when a pause is
asked for and closed when one is lifted, so the record grows out of the same two
buttons that already existed rather than out of anything new to operate.

Two rules hold it together:

* **It remembers, it never decides.** `paused_until` still governs every buy;
  nothing here is consulted about whether to spend money *now*. What these rows
  change is what a week without a buy is called afterwards, and — through
  `pulse.missed_slot` — whether a week nobody wanted is bought once the pause is
  over. Both are readings of the past, which is why this can be added to a
  running install without touching a single scheduled run.
* **It only knows what it was there for.** An install that pauses for the first
  time after this arrived has one window; the weeks before it stay as honest as
  they were, which is to say silent. `pulse` says so rather than back-filling a
  history nobody recorded — the same reason it never inferred pauses from gaps.
"""
from datetime import date, datetime, time, timedelta

from sqlmodel import Session, desc, select

from .models import PauseWindow


def _open_window(session: Session) -> PauseWindow | None:
    """The pause that is still running, if there is one.

    Newest first, because that is the only one a resume can be about: pauses do
    not nest, since `paused_until` is a single date that the next pause
    overwrites.
    """
    return session.exec(
        select(PauseWindow)
        .where(PauseWindow.ended_at == None)  # noqa: E711 - SQL NULL, not `is`
        .order_by(desc(PauseWindow.started_at))
        .limit(1)
    ).first()


def record_pause(session: Session, until: date) -> PauseWindow:
    """Remember that Drip was told to stand still until `until`, inclusive.

    Pausing again while already paused **moves** the open window's end rather
    than opening a second one — `paused_until` is one date and the second
    instruction replaces the first, in either direction. A pause shortened from
    thirty days to seven is still one stretch of standing still.
    """
    window = _open_window(session)
    if window is None:
        window = PauseWindow(started_at=datetime.now(), until=until)
    else:
        window.until = until
    session.add(window)
    session.commit()
    session.refresh(window)
    return window


def record_resume(session: Session) -> PauseWindow | None:
    """Close the open window: the pause was lifted before it ran out.

    `ended_at` is what makes a window shorter than its `until` promised. A
    resume with nothing open is not an error — the pause may simply have expired
    on its own, which needs no row of its own since `until` already says when.
    """
    window = _open_window(session)
    if window is None:
        return None
    window.ended_at = datetime.now()
    session.add(window)
    session.commit()
    session.refresh(window)
    return window


def record(session: Session, paused_until: date | None) -> None:
    """Write whatever `paused_until` was just set to into the record.

    The one entry point every writer of that column goes through, so the memory
    cannot be skipped by setting the field a different way — the dashboard's
    pause button and a plain settings update are the same act, and only one of
    them was ever going to be remembered otherwise.
    """
    if paused_until is None:
        record_resume(session)
    else:
        record_pause(session, paused_until)


def windows(session: Session, since: date | None = None) -> list[PauseWindow]:
    """Every recorded pause, oldest first, optionally from `since` onwards.

    The filter is on the *end* of a window, not its start: a pause begun in
    March and lifted in May still covers a week in May.
    """
    query = select(PauseWindow).order_by(PauseWindow.started_at)
    if since is not None:
        query = query.where(PauseWindow.until >= since)
    return list(session.exec(query).all())


def covers(windows: list[PauseWindow], moment: datetime) -> bool:
    """Whether the bot had been told to stand still at that exact moment.

    A window runs from the instant the pause was asked for to the end of the day
    `until` names — or to `ended_at`, if somebody lifted it earlier. The start is
    an instant rather than a day on purpose: a pause set on Monday afternoon
    cannot excuse a buy that should have happened on Monday morning.
    """
    for window in windows:
        end = window.ended_at or datetime.combine(
            window.until + timedelta(days=1), time.min
        )
        if window.started_at <= moment < end:
            return True
    return False

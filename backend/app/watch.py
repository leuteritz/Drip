"""The one thing worth saying between buys — and nothing else.

Drip only ever spoke when it bought: a purchase embed, the weekly report, a test
message. Everything it knows in between it kept to itself. `preflight` can see
that the next buy is blocked and `pulse` can see that the last slot went by
unanswered, and both of them sat there waiting to be *read* — which for an
unattended weekly buyer means the news arrives when somebody happens to open the
dashboard, and otherwise arrives as a week that was not bought.

Read-only over the database, and it **never raises**: `well.py`'s discipline for
`preflight.py`'s reason. It runs unattended on a timer, so a check that fell over
would trade a quiet fault for a loud one and still not buy anything.

Two things are said, worst first, and at most one message goes out per run:

1. **The next buy is blocked** — `preflight` says `fail`. In dry run this cannot
   trigger at all and that is free: `preflight._soften` already turns money
   failures into warnings when no order is going to be placed, the same rule
   `header/PreflightPill.tsx` follows.
2. **The drip is overdue and nothing will pick it up** — there is a missed slot
   *and* catch-up is off. With catch-up on, that job is about to buy the slot, so
   a warning would be noise; and if that buy fails, `bot.run_purchase` and
   `scheduler._report_failure` already speak for themselves.

What is deliberately **not** said matters as much:

- **A merely low well.** `well.py` states that a weekly buy at `LOW_BUYS` = 2 is
  already two weeks of notice, "which is why this is not a job of its own", and
  that rule stands. What this adds is the other end of it: `preflight`'s `funds`
  check at **fail** — the balance no longer covers the next buy at all — which is
  the moment the notice has run out and the purchase embed can no longer carry
  the message, because there will not be a purchase.
- **Warnings and unknowns.** No webhook is a fair way to run a bot and a missing
  key on a dry-run install is not a fault; either would light up permanently, and
  a badge that is always on is one nobody reads by the week it means something.
- **An all-clear.** Recovering is silent. "Everything is fine again" is the same
  failure mode as a healthy balance restated on every buy.

Nothing here decides anything about a purchase. It reports, the way `pulse` does.
"""
import logging
from datetime import datetime

from sqlmodel import Session, select

from . import notifier, preflight, pulse
from .constants import PREFLIGHT_FAIL, WATCH_BLOCKED, WATCH_OVERDUE
from .database import load_settings
from .models import WatchAlert

logger = logging.getLogger(__name__)


def check(session: Session) -> dict | None:
    """The one thing worth saying right now, or nothing at all.

    Returns `{"kind", "detail", "report"}` — `detail` is the sentence itself, and
    it is what decides whether this is news or the same fault still standing.
    """
    settings = load_settings(session)

    report = preflight.summary(session)
    if report["status"] == PREFLIGHT_FAIL:
        return {
            "kind": WATCH_BLOCKED,
            "detail": notifier.preflight_line(report),
            "report": report,
        }

    # Only when nothing will pick it up on its own.
    if not settings.catch_up:
        slot = pulse.missed_slot(session)
        if slot is not None:
            return {
                "kind": WATCH_OVERDUE,
                "detail": slot.isoformat(),
                "report": {"slot": slot, "dry_run": settings.dry_run},
            }

    return None


def _open_alerts(session: Session) -> list[WatchAlert]:
    return list(
        session.exec(select(WatchAlert).where(WatchAlert.cleared_at.is_(None))).all()
    )


def run(session: Session) -> bool:
    """`check()`, then send it if it is news, then remember. Never raises.

    Returns whether a message actually went out, which is the only thing that
    writes a row: nothing may be recorded as said that was not said.
    """
    try:
        settings = load_settings(session)
        if not settings.watch:
            return False

        finding = check(session)
        now = datetime.now()
        open_rows = _open_alerts(session)

        if finding is None:
            # Recovered. Close the record quietly — an all-clear message is the
            # line nobody is still reading by the time it matters.
            for row in open_rows:
                row.cleared_at = now
                session.add(row)
            if open_rows:
                session.commit()
            return False

        # A fault that is simply still true stays open and silent. A different
        # kind, or the same kind now saying something else, is news again.
        same = [
            r
            for r in open_rows
            if r.kind == finding["kind"] and r.detail == finding["detail"]
        ]
        if same:
            return False

        sent = notifier.send_watch_notification(
            finding["kind"], finding["report"], settings.discord_enabled
        )
        if not sent:
            return False

        session.add(
            WatchAlert(kind=finding["kind"], detail=finding["detail"], sent_at=now)
        )
        session.commit()
        return True
    except Exception:  # noqa: BLE001 - unattended; a fallen check may not escape
        logger.exception("Watch check failed")
        return False

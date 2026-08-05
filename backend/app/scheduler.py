"""APScheduler: runs the buy at the configured weekday + time, the weekly digest
at its own, and — when it is switched on — a daily check for a slot that went by
while nothing was running. All three are rescheduled whenever their settings
change."""
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from . import bot
from .models import BotSettings, DigestSettings

logger = logging.getLogger(__name__)

JOB_ID = "weekly_purchase"
DIGEST_JOB_ID = "weekly_digest"
CATCH_UP_JOB_ID = "catch_up"

# The first missed-buy check runs a moment after start-up, because a Pi coming
# back on is the case it exists for; a short delay keeps it off the critical
# path while the app finishes coming up and the first candles are fetched.
CATCH_UP_DELAY_SECONDS = 45
# ...and then daily, so a week lost to something other than a reboot is still
# found while it can still be bought. Anything finer would just re-ask a
# question whose answer only changes once a week.
CATCH_UP_HOURS = 24

scheduler = BackgroundScheduler()

# APScheduler day_of_week: mon=0 ... sun=6 (matches our settings schema)
_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _run_scheduled() -> None:
    logger.info("Scheduled bot run starting...")
    try:
        result = bot.run_purchase(triggered_by="schedule")
        logger.info("Bot run finished: %s", result.get("reason", "OK"))
    except Exception as exc:
        logger.exception("Scheduled bot run failed")
        _report_failure(exc)


def _report_failure(exc: Exception) -> None:
    """Say on Discord that the week's run fell over before it could buy.

    A failed *order* already reports itself: `bot.run_purchase` catches it,
    writes an error row and notifies. Everything that goes wrong earlier — no
    network, the public price endpoints down, a broken candle fetch — used to
    end here in a log file on a Pi nobody reads the logs of, and the only trace
    was a week that quietly never happened. `pulse.py` finds those afterwards;
    this is the same news at the time it is still worth acting on.

    Never raises: a webhook that cannot be reached must not bury the original
    exception the caller has already logged.
    """
    from sqlmodel import Session

    from . import notifier
    from .database import engine, load_settings

    try:
        with Session(engine) as session:
            enabled = load_settings(session).discord_enabled
        notifier.send_run_failure_notification(str(exc), enabled)
    except Exception:
        logger.exception("Could not report the failed run to Discord")


def _run_digest() -> None:
    """The weekly summary. Imported lazily: `digest` pulls in most of the app,
    and the scheduler is imported during startup before all of it exists."""
    from sqlmodel import Session

    from . import digest
    from .database import engine

    logger.info("Weekly digest starting...")
    try:
        with Session(engine) as session:
            logger.info("Weekly digest sent: %s", digest.send(session))
    except Exception:
        logger.exception("Weekly digest failed")


def _run_catch_up() -> None:
    """Buy the slot that went by while Drip was not running.

    APScheduler's misfire grace is an hour; past that the week is simply gone,
    which is the silence `pulse` was written to make visible. This is the other
    half of it: the week that can still be bought gets bought, once, at today's
    price and today's score — a missed Monday cannot be bought at Monday's
    price, and pretending otherwise would put a made-up figure in the history.

    `pulse` decides whether there is anything to catch up at all; everything
    that could spend money twice is settled there. Imported lazily for the same
    reason `digest` is: it pulls in the market data and the models, and this
    module is imported during start-up before all of that exists.
    """
    from sqlmodel import Session

    from . import pulse
    from .database import engine

    try:
        with Session(engine) as session:
            slot = pulse.missed_slot(session)
        if slot is None:
            return
        logger.info("Catch-up: the buy due %s never landed - running it now", slot)
        result = bot.run_purchase(triggered_by="catchup", late_slot=slot)
        logger.info("Catch-up finished: %s", result.get("reason", "OK"))
    except Exception as exc:
        logger.exception("Catch-up run failed")
        _report_failure(exc)


def reschedule(settings: BotSettings) -> None:
    hour, minute = (int(x) for x in settings.schedule_time.split(":"))
    trigger = CronTrigger(
        day_of_week=_WEEKDAYS[settings.schedule_weekday],
        hour=hour,
        minute=minute,
    )
    scheduler.add_job(
        _run_scheduled,
        trigger=trigger,
        id=JOB_ID,
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info(
        "Buy job scheduled: %s %s", _WEEKDAYS[settings.schedule_weekday], settings.schedule_time
    )


def reschedule_digest(digest: DigestSettings) -> None:
    """Adds, moves or removes the weekly report's job.

    Switching the digest off removes the job rather than making it return early,
    so `next_digest_time` has nothing to report and the frontend cannot show a
    next send that will never happen.
    """
    if not digest.enabled:
        if scheduler.get_job(DIGEST_JOB_ID):
            scheduler.remove_job(DIGEST_JOB_ID)
        logger.info("Digest job switched off")
        return

    hour, minute = (int(x) for x in digest.send_time.split(":"))
    scheduler.add_job(
        _run_digest,
        trigger=CronTrigger(day_of_week=_WEEKDAYS[digest.weekday], hour=hour, minute=minute),
        id=DIGEST_JOB_ID,
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("Digest job scheduled: %s %s", _WEEKDAYS[digest.weekday], digest.send_time)


def reschedule_catch_up(settings: BotSettings) -> None:
    """Adds or removes the missed-buy check.

    Switched off the job is *removed* rather than left in place returning early,
    the same rule the digest follows: the setup dialog lists the jobs the
    scheduler is actually holding, and a bot that will never catch anything up
    must not be advertising a check for it.

    Its first run is a moment after start-up, which is the case it exists for —
    a Pi that was off through Monday morning and came back on Tuesday.
    """
    if not settings.catch_up:
        if scheduler.get_job(CATCH_UP_JOB_ID):
            scheduler.remove_job(CATCH_UP_JOB_ID)
        logger.info("Catch-up job switched off")
        return

    scheduler.add_job(
        _run_catch_up,
        trigger=IntervalTrigger(
            hours=CATCH_UP_HOURS,
            start_date=datetime.now() + timedelta(seconds=CATCH_UP_DELAY_SECONDS),
        ),
        id=CATCH_UP_JOB_ID,
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("Catch-up job scheduled: first run in %ss", CATCH_UP_DELAY_SECONDS)


def start(settings: BotSettings, digest: DigestSettings) -> None:
    reschedule(settings)
    reschedule_digest(digest)
    reschedule_catch_up(settings)
    if not scheduler.running:
        scheduler.start()


def shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


def _next_run(job_id: str) -> str | None:
    job = scheduler.get_job(job_id)
    if job and job.next_run_time:
        return job.next_run_time.isoformat()
    return None


JOB_LABELS = {
    JOB_ID: "Weekly buy",
    DIGEST_JOB_ID: "Weekly report",
    CATCH_UP_JOB_ID: "Missed-buy check",
}


def job_overview() -> list[dict]:
    """Every job the scheduler is actually holding, for the setup dialog.

    Read out of APScheduler rather than derived from the settings rows: a job
    that never got scheduled then shows up as missing, instead of being
    advertised from the setting that was meant to create it.
    """
    return [
        {
            "id": job.id,
            "label": JOB_LABELS.get(job.id, job.id),
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        }
        for job in scheduler.get_jobs()
    ]


def is_running() -> bool:
    return scheduler.running


def next_run_time() -> str | None:
    return _next_run(JOB_ID)


def next_digest_time() -> str | None:
    return _next_run(DIGEST_JOB_ID)

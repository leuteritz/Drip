"""APScheduler: runs the buy at the configured weekday + time.
Rescheduled whenever the settings change."""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from . import bot
from .models import BotSettings

logger = logging.getLogger(__name__)

JOB_ID = "weekly_purchase"
DIGEST_JOB_ID = "weekly_digest"

# The digest is a fixed weekly slot rather than a setting, because a setting
# would mean a new column on BotSettings and there are no migrations - see
# CLAUDE.md. Sunday evening, independent of when the buy runs.
DIGEST_DAY = "sun"
DIGEST_HOUR = 18

scheduler = BackgroundScheduler()

# APScheduler day_of_week: mon=0 ... sun=6 (matches our settings schema)
_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _run_scheduled() -> None:
    logger.info("Scheduled bot run starting...")
    try:
        result = bot.run_purchase(triggered_by="schedule")
        logger.info("Bot run finished: %s", result.get("reason", "OK"))
    except Exception:
        logger.exception("Scheduled bot run failed")


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


def start(settings: BotSettings) -> None:
    reschedule(settings)
    scheduler.add_job(
        _run_digest,
        trigger=CronTrigger(day_of_week=DIGEST_DAY, hour=DIGEST_HOUR, minute=0),
        id=DIGEST_JOB_ID,
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("Digest job scheduled: %s %02d:00", DIGEST_DAY, DIGEST_HOUR)
    if not scheduler.running:
        scheduler.start()


def shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


def next_run_time() -> str | None:
    job = scheduler.get_job(JOB_ID)
    if job and job.next_run_time:
        return job.next_run_time.isoformat()
    return None

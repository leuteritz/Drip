"""APScheduler: runs the buy at the configured weekday + time, and the weekly
digest at its own. Both are rescheduled whenever their settings change."""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from . import bot
from .models import BotSettings, DigestSettings

logger = logging.getLogger(__name__)

JOB_ID = "weekly_purchase"
DIGEST_JOB_ID = "weekly_digest"

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


def start(settings: BotSettings, digest: DigestSettings) -> None:
    reschedule(settings)
    reschedule_digest(digest)
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


def next_run_time() -> str | None:
    return _next_run(JOB_ID)


def next_digest_time() -> str | None:
    return _next_run(DIGEST_JOB_ID)

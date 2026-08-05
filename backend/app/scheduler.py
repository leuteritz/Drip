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


JOB_LABELS = {JOB_ID: "Weekly buy", DIGEST_JOB_ID: "Weekly report"}


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

"""APScheduler: fuehrt den Kauf zum konfigurierten Wochentag + Uhrzeit aus.
Reschedule bei jeder Settings-Aenderung."""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from . import bot
from .models import BotSettings

logger = logging.getLogger(__name__)

JOB_ID = "weekly_purchase"
scheduler = BackgroundScheduler()

# APScheduler day_of_week: mon=0 ... sun=6 (deckt sich mit unserem Schema)
_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _run_scheduled() -> None:
    logger.info("Geplanter Bot-Lauf startet...")
    try:
        result = bot.run_purchase(triggered_by="schedule")
        logger.info("Bot-Lauf abgeschlossen: %s", result.get("reason", "OK"))
    except Exception:
        logger.exception("Geplanter Bot-Lauf fehlgeschlagen")


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
        "Kauf-Job geplant: %s %s", _WEEKDAYS[settings.schedule_weekday], settings.schedule_time
    )


def start(settings: BotSettings) -> None:
    reschedule(settings)
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

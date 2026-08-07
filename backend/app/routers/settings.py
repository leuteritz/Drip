from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import Session

from .. import pauses, scheduler
from ..database import get_session, load_settings
from ..models import BotSettings
from ..schemas import PauseRequest, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _persist(session: Session, settings: BotSettings) -> BotSettings:
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings


@router.get("", response_model=BotSettings)
def get_settings(session: Session = Depends(get_session)):
    return load_settings(session)


@router.put("", response_model=BotSettings)
def update_settings(update: SettingsUpdate, session: Session = Depends(get_session)):
    settings = load_settings(session)
    data = update.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(settings, key, value)
    # Pausing is pausing however it was asked for: the dashboard uses the two
    # endpoints below, but this one can set the same column and the record may
    # not depend on which door somebody came through.
    if "paused_until" in data:
        pauses.record(session, settings.paused_until)
    settings = _persist(session, settings)

    # Schedule changes only take effect once the cron job is rebuilt
    if "schedule_weekday" in data or "schedule_time" in data:
        scheduler.reschedule(settings)
    # The missed-buy check is a job that exists or does not, so switching it on
    # has to create it — and switching it on is also when it should look, which
    # is what the job's own start-up delay gives for free.
    if "catch_up" in data:
        scheduler.reschedule_catch_up(settings)
    return settings


@router.post("/pause", response_model=BotSettings)
def pause(request: PauseRequest, session: Session = Depends(get_session)):
    settings = load_settings(session)
    settings.paused_until = date.today() + timedelta(days=request.days)
    # The instruction is `paused_until`; the row beside it is the memory of it,
    # and it is what stops these weeks being reported as failures once the date
    # has passed. See `pauses`.
    pauses.record(session, settings.paused_until)
    return _persist(session, settings)


@router.post("/resume", response_model=BotSettings)
def resume(session: Session = Depends(get_session)):
    settings = load_settings(session)
    settings.paused_until = None
    pauses.record(session, None)
    return _persist(session, settings)

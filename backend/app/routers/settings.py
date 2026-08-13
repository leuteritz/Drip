from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from .. import cadence, pauses, scheduler
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
    # The one field with a closed vocabulary. Refused here rather than coerced,
    # because `cadence.get` falls back to weekly by design — that fallback is for
    # reading a column somebody else wrote, not for accepting a typo as a change
    # of schedule and silently buying on a different rhythm than the one asked for.
    if data.get("cadence") is not None and data["cadence"] not in cadence.KEYS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown cadence - one of {', '.join(cadence.KEYS)}",
        )
    for key, value in data.items():
        setattr(settings, key, value)
    # Pausing is pausing however it was asked for: the dashboard uses the two
    # endpoints below, but this one can set the same column and the record may
    # not depend on which door somebody came through.
    if "paused_until" in data:
        pauses.record(session, settings.paused_until)
    settings = _persist(session, settings)

    # Schedule changes only take effect once the job is rebuilt — and the
    # cadence is a schedule change in the strongest sense: it decides which
    # *kind* of trigger the scheduler is holding, not only when it fires.
    if {"schedule_weekday", "schedule_time", "cadence"} & data.keys():
        scheduler.reschedule(settings)
    # The missed-buy check is a job that exists or does not, so switching it on
    # has to create it — and switching it on is also when it should look, which
    # is what the job's own start-up delay gives for free.
    if "catch_up" in data:
        scheduler.reschedule_catch_up(settings)
    # Same shape for the between-buy watch: switching it off removes the job
    # rather than leaving one that returns early, so `job_overview` keeps
    # listing what the scheduler actually holds.
    if "watch" in data:
        scheduler.reschedule_watch(settings)
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

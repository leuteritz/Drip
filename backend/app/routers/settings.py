from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import Session

from .. import scheduler
from ..database import get_session, load_settings
from ..schemas import PauseRequest, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def get_settings(session: Session = Depends(get_session)):
    return load_settings(session)


@router.put("")
def update_settings(update: SettingsUpdate, session: Session = Depends(get_session)):
    settings = load_settings(session)
    data = update.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(settings, key, value)
    session.add(settings)
    session.commit()
    session.refresh(settings)

    if "schedule_weekday" in data or "schedule_time" in data:
        scheduler.reschedule(settings)
    return settings


@router.post("/pause")
def pause(request: PauseRequest, session: Session = Depends(get_session)):
    settings = load_settings(session)
    settings.paused_until = date.today() + timedelta(days=request.days)
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings


@router.post("/resume")
def resume(session: Session = Depends(get_session)):
    settings = load_settings(session)
    settings.paused_until = None
    session.add(settings)
    session.commit()
    session.refresh(settings)
    return settings

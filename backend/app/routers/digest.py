"""The weekly report: what it contains, when it goes out, and sending it now.

Read-and-write settings plus a rendered preview. The preview goes through
`notifier.build_digest_embed`, the same function that builds the real message,
so what the dialog shows cannot drift from what Discord receives.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session

from .. import digest as digest_service
from .. import notifier, scheduler
from ..config import config
from ..database import get_session, load_digest_settings
from ..models import DigestSettings
from ..schemas import DigestPreviewResponse, DigestSettingsResponse, DigestUpdate, TestNotificationResponse

router = APIRouter(prefix="/api/digest", tags=["digest"])


def _response(settings: DigestSettings) -> dict:
    chosen = digest_service.selection(settings)
    return {
        "enabled": settings.enabled,
        "weekday": settings.weekday,
        "send_time": settings.send_time,
        "next_run": scheduler.next_digest_time(),
        "discord_configured": bool(config.discord_webhook_url),
        "blocks": [
            {
                "key": block.key,
                "label": block.label,
                "description": block.description,
                "enabled": chosen[block.key],
            }
            for block in digest_service.BLOCKS
        ],
    }


@router.get("", response_model=DigestSettingsResponse)
def get_digest(session: Session = Depends(get_session)):
    return _response(load_digest_settings(session))


@router.put("", response_model=DigestSettingsResponse)
def update_digest(update: DigestUpdate, session: Session = Depends(get_session)):
    settings = load_digest_settings(session)
    data = update.model_dump(exclude_unset=True)

    if "blocks" in data and data["blocks"] is not None:
        settings.blocks = digest_service.merge_selection(settings, data.pop("blocks"))
    for key, value in data.items():
        if value is not None:
            setattr(settings, key, value)

    session.add(settings)
    session.commit()
    session.refresh(settings)

    # Same rule as the buy job: a schedule change only lands once the cron job
    # is rebuilt, and switching the digest off has to remove it.
    scheduler.reschedule_digest(settings)
    return _response(settings)


@router.get("/preview", response_model=DigestPreviewResponse)
def preview(session: Session = Depends(get_session)):
    """The report with every block rendered, for the frontend to filter."""
    return notifier.build_digest_embed(digest_service.build(session))


@router.post("/send", response_model=TestNotificationResponse)
def send_now(session: Session = Depends(get_session)):
    """Sends this week's report immediately, even while the schedule is off."""
    if not config.discord_webhook_url:
        return {"sent": False, "reason": "No Discord webhook configured in backend/.env"}
    return {"sent": digest_service.send(session, force=True)}

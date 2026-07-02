from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from .. import bot as bot_runner
from .. import scheduler
from ..bot import is_paused
from ..config import config
from ..database import get_session, load_settings
from ..schemas import RunRequest

router = APIRouter(prefix="/api/bot", tags=["bot"])


@router.get("/status")
def status(session: Session = Depends(get_session)):
    settings = load_settings(session)
    return {
        "dry_run": settings.dry_run,
        "paused": is_paused(settings.paused_until),
        "paused_until": settings.paused_until,
        "next_run": scheduler.next_run_time(),
        "has_credentials": config.has_coinbase_credentials,
        "discord_configured": bool(config.discord_webhook_url),
    }


@router.post("/run")
def run_now(request: RunRequest):
    """Manual bot run. dry_run=None uses the stored setting."""
    try:
        return bot_runner.run_purchase(
            dry_run_override=request.dry_run, triggered_by="manual"
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

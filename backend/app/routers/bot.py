from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from .. import bot as bot_runner
from .. import notifier, scheduler
from ..bot import is_paused
from ..config import config
from ..database import get_session, load_settings
from ..schemas import (
    BotStatusResponse,
    ManualBuyRequest,
    RunRequest,
    RunResultResponse,
    TestNotificationResponse,
)

router = APIRouter(prefix="/api/bot", tags=["bot"])


@router.get("/status", response_model=BotStatusResponse)
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


def _run(dry_run: bool | None, amount_eur: float | None = None) -> dict:
    """Shared error handling for the two manual entry points."""
    try:
        return bot_runner.run_purchase(
            dry_run_override=dry_run,
            triggered_by="manual",
            amount_eur_override=amount_eur,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/run", response_model=RunResultResponse)
def run_now(request: RunRequest):
    """Manual bot run. dry_run=None uses the stored setting."""
    return _run(request.dry_run)


@router.post("/buy", response_model=RunResultResponse)
def buy_now(request: ManualBuyRequest):
    """Manual buy with a fixed EUR amount. Respects the stored dry_run
    setting unless explicitly overridden."""
    return _run(request.dry_run, request.amount_eur)


@router.post("/test-notification", response_model=TestNotificationResponse)
def test_notification():
    """Send a test message to the configured Discord webhook."""
    if not config.discord_webhook_url:
        return {"sent": False, "reason": "No Discord webhook configured in backend/.env"}
    sent = notifier.send_notification(
        title="Drip - test",
        description="Your Discord webhook is working. This is only a test.",
        color=notifier.COLOR_TEST,
    )
    return {"sent": sent}

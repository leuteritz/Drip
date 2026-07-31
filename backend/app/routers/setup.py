"""Setup: the secrets, the state of the machine, and the maintenance escapes.

Everything here used to need shell access to the Pi - editing `backend/.env`,
reading the container log to see whether the scheduler survived a restart,
deleting the candle table by hand. It is the one place that writes credentials
(through `credentials.save`, never straight to the row) and the one place that
answers with numbers about the install rather than about bitcoin.

Secrets go in but never come back out: `GET` returns `credentials.mask()`.
"""
import logging
import os
import sqlite3
import sys
import tempfile
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, func, select
from starlette.background import BackgroundTask

from .. import credentials, indicators, research, scheduler, trading
from ..config import DATA_DIR
from ..database import get_session
from ..models import Candle, Purchase
from ..schemas import (
    CoinbaseTestResponse,
    CredentialsUpdate,
    MaintenanceResponse,
    SetupResponse,
)
from ..trading import CoinbaseError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/setup", tags=["setup"])

DB_PATH = DATA_DIR / "bot.db"

# Import time is close enough to process start, and it is the honest answer to
# "how long has this backend been up" - the scheduler is started right after.
_STARTED = time.time()


def _credential_fields() -> list[dict]:
    resolved = credentials.current()
    return [
        {
            "key": spec.key,
            "group": spec.group,
            "label": spec.label,
            "hint": spec.hint,
            "placeholder": spec.placeholder,
            "multiline": spec.multiline,
            "configured": resolved.get(spec.key).configured,
            "source": resolved.get(spec.key).source,
            "masked": credentials.mask(resolved.get(spec.key).value),
        }
        for spec in credentials.FIELDS
    ]


def _system(session: Session) -> dict:
    span = session.exec(select(func.min(Candle.day), func.max(Candle.day))).one()
    age = research.cache_age()
    now = datetime.now().astimezone()

    return {
        "now": now.isoformat(),
        "timezone": os.environ.get("TZ") or now.tzname() or "system default",
        "uptime_seconds": int(time.time() - _STARTED),
        "python_version": sys.version.split()[0],
        "scheduler_running": scheduler.is_running(),
        "jobs": scheduler.job_overview(),
        "database_bytes": DB_PATH.stat().st_size if DB_PATH.exists() else 0,
        "purchase_count": session.exec(select(func.count()).select_from(Purchase)).one(),
        "candle_count": session.exec(select(func.count()).select_from(Candle)).one(),
        "candle_from": span[0].isoformat() if span[0] else None,
        "candle_to": span[1].isoformat() if span[1] else None,
        "research_cache_age_seconds": int(age) if age is not None else None,
    }


@router.get("", response_model=SetupResponse)
def get_setup(session: Session = Depends(get_session)):
    """What is configured, and how the install is doing. One call, because the
    dialog shows both at once."""
    return {"credentials": _credential_fields(), "system": _system(session)}


@router.put("/credentials", response_model=SetupResponse)
def update_credentials(update: CredentialsUpdate, session: Session = Depends(get_session)):
    """Stores the secrets the dashboard was given.

    Takes effect immediately - `credentials.save` drops the resolution cache,
    and the balance cache goes with it, since a new key means a different
    account until proven otherwise.
    """
    values = update.model_dump(exclude_unset=True)
    values = {key: value for key, value in values.items() if value is not None}
    if not values:
        raise HTTPException(status_code=400, detail="Nothing to update")

    credentials.save(session, values)
    trading.invalidate_balance_cache()
    return {"credentials": _credential_fields(), "system": _system(session)}


@router.post("/coinbase/test", response_model=CoinbaseTestResponse)
def test_coinbase():
    """Proves the key pair by asking Coinbase for the balances it will spend.

    Read-only, and deliberately the same call the header uses, so a pass here
    means the well readout will fill too. Always 200: a rejected key is an
    answer, not a server error.
    """
    creds = credentials.current()
    if not creds.has_coinbase:
        return {"ok": False, "detail": "No API key and private key stored yet."}

    try:
        balances = trading.get_balances()
    except CoinbaseError as exc:
        logger.warning("Coinbase credential test failed: %s", exc)
        return {"ok": False, "detail": str(exc)}

    trading.invalidate_balance_cache()
    return {
        "ok": True,
        "detail": "Coinbase accepted the key - these are the balances it can see.",
        **balances,
    }


@router.delete("/cache/candles", response_model=MaintenanceResponse)
def clear_candle_cache(session: Session = Depends(get_session)):
    """Empties the daily candle table. The next request refetches it from
    Coinbase's public API - slow (350 days for the moving average), never
    destructive: candles are a cache, not history."""
    rows = session.exec(select(Candle)).all()
    for row in rows:
        session.delete(row)
    session.commit()
    research.clear_cache()
    return {
        "ok": True,
        "detail": f"{len(rows):,} cached days dropped - the next chart refetches them.",
    }


@router.delete("/cache/research", response_model=MaintenanceResponse)
def clear_research_cache():
    """Drops the in-process caches: the scored day table and the Fear & Greed
    history. Rebuilt on the next request from candles already on disk."""
    research.clear_cache()
    indicators.clear_fng_history_cache()
    return {"ok": True, "detail": "Scoring table and Fear & Greed history will be rebuilt."}


@router.get("/backup")
def backup():
    """The whole SQLite database as a download.

    Taken through SQLite's own backup API rather than by reading the file from
    underneath a running app, so the copy is consistent even mid-write. It
    contains everything, credentials included - treat it as a secret.
    """
    if not DB_PATH.exists():
        raise HTTPException(status_code=404, detail="No database file yet")

    handle, path = tempfile.mkstemp(prefix="drip-backup-", suffix=".db")
    os.close(handle)
    with sqlite3.connect(DB_PATH) as source, sqlite3.connect(path) as target:
        source.backup(target)

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    return FileResponse(
        path,
        media_type="application/vnd.sqlite3",
        filename=f"drip-backup-{stamp}.db",
        background=BackgroundTask(os.unlink, path),
    )

"""Drip - FastAPI backend.

Serves the REST API under /api and, once built, the frontend
from backend/static as a single-page app.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session

from . import scheduler
from .config import STATIC_DIR
from .database import engine, init_db, load_digest_settings, load_settings
from .routers import (
    account,
    bot,
    digest,
    market,
    purchases,
    research,
    settings,
    setup,
    simulate,
    stats,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with Session(engine) as session:
        scheduler.start(load_settings(session), load_digest_settings(session))
    yield
    scheduler.shutdown()


app = FastAPI(title="Drip", version="1.0.0", lifespan=lifespan)

app.include_router(account.router)
app.include_router(settings.router)
app.include_router(setup.router)
app.include_router(purchases.router)
app.include_router(market.router)
app.include_router(bot.router)
app.include_router(digest.router)
app.include_router(stats.router)
app.include_router(simulate.router)
app.include_router(research.router)


if (STATIC_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        candidate = STATIC_DIR / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")

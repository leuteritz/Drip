"""Drip - FastAPI backend.

Serves the REST API under /api and, once built, the frontend
from backend/static as a single-page app.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session

from . import auth, scheduler
from .config import STATIC_DIR
from .database import engine, init_db, load_digest_settings, load_settings
from .routers import (
    account,
    auth as auth_router,
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
    # Warm the lock before anything can ask for it, so the one blocking SQLite
    # read it needs never happens inside the async middleware below.
    auth.current()
    with Session(engine) as session:
        scheduler.start(load_settings(session), load_digest_settings(session))
    yield
    scheduler.shutdown()


app = FastAPI(title="Drip", version="1.0.0", lifespan=lifespan)


@app.middleware("http")
async def lock(request: Request, call_next):
    """The optional password, in front of everything under /api.

    Middleware rather than a router dependency, and that is a decision: there
    are ten routers, so a dependency would be ten places to forget one and a
    router added next release would be ungated by default. That is precisely the
    drift `digest.BLOCKS` and `credentials.FIELDS` exist to prevent. A path
    prefix states the rule once, in words, in `auth.is_open`.

    The first line is the guarantee the whole feature rests on: with no password
    set this returns before doing anything at all, and an install that has never
    set one is byte-identical to the Drip it was yesterday.
    """
    if auth.allows(request.url.path, request.cookies.get(auth.COOKIE)):
        return await call_next(request)
    return JSONResponse(
        status_code=401,
        content={"detail": "Sign in to reach this."},
    )


app.include_router(auth_router.router)
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

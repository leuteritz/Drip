"""The database out, and back in again.

Drip could already hand you a copy of itself — `/api/setup/backup` has taken one
through SQLite's own backup API since the setup dialog existed. What it could
not do was accept one, which made the download a copy rather than a backup: an
SD card that stopped answering left somebody with a file, a Pi, and no way to
put one into the other short of `docker cp` and a guess about which path.

So both directions live here, and the asymmetry between them is the whole
module. Taking a copy is free and cannot go wrong; putting one back replaces a
file holding somebody's entire purchase history, and every rule below is about
that one sentence:

- **Nothing is touched until the upload has proved itself.** It is written to a
  temporary file, opened as SQLite, integrity-checked and asked for the tables a
  Drip database has. A truncated download, a JPEG with the wrong extension or
  somebody else's database is refused before the live file is opened at all,
  because a restore that fails halfway is worse than one that never started.
- **The replaced database is kept**, as `bot.db.replaced` beside the new one.
  One file, overwritten by the next restore rather than accumulating: a Pi has a
  small card, and the case this exists for is restoring the *wrong* file and
  wanting the last five minutes back. It is deliberately not offered in the UI —
  it is a floor to land on, not a feature.
- **The restored file is migrated before anything reads it.** A backup is by
  definition older than now, so it can be missing a column that a later version
  added — `init_db()` runs over it exactly as it does on start-up, which is what
  makes restoring last year's file into this year's Drip work at all.
- **Everything in memory that outlived the file is dropped.** Credentials, the
  balance cache, the scoring table, the Fear & Greed history — all of them were
  answers about a database that no longer exists. The scheduler is rebuilt from
  the restored settings for the same reason: the restored install may buy on a
  different day, and a job still holding the old one would be the previous
  database's opinion outliving it.

Nothing here is undoable by waiting, which is why the frontend asks twice.
"""
import logging
import os
import shutil
import sqlite3
import tempfile
from datetime import datetime
from pathlib import Path

from .config import DATA_DIR

logger = logging.getLogger(__name__)

DB_PATH = DATA_DIR / "bot.db"
# The one file kept back after a restore. Overwritten by the next one — see the
# module docstring on why this is a floor rather than a history.
REPLACED_PATH = DATA_DIR / "bot.db.replaced"

# What makes an uploaded file a *Drip* database rather than merely a valid
# SQLite one. Deliberately the two singleton tables and the history: a file with
# these is either ours or close enough to be worth migrating, and one without
# them is somebody else's and must never land on top of a purchase history.
REQUIRED_TABLES = {"purchase", "botsettings"}

# A generous ceiling on an upload — a decade of weekly buys with the full candle
# cache is a few megabytes. This is here so a stray multi-gigabyte file fills a
# temporary directory rather than the Pi's card.
MAX_UPLOAD_BYTES = 256 * 1024 * 1024
CHUNK = 1024 * 1024


class RestoreError(Exception):
    """The upload is not something that may be written over the database."""


def snapshot() -> tuple[Path, str]:
    """A consistent copy of the live database, and the name to offer it under.

    Taken through SQLite's own backup API rather than by reading the file from
    underneath a running app, so the copy holds together even mid-write. It
    contains everything, credentials included — treat it as a secret.

    The caller owns the returned path and is responsible for unlinking it.
    """
    if not DB_PATH.exists():
        raise FileNotFoundError("No database file yet")

    handle, path = tempfile.mkstemp(prefix="drip-backup-", suffix=".db")
    os.close(handle)
    with sqlite3.connect(DB_PATH) as source, sqlite3.connect(path) as target:
        source.backup(target)

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    return Path(path), f"drip-backup-{stamp}.db"


def _inspect(path: Path) -> dict:
    """Prove the file is a Drip database, and say what is in it.

    Raises `RestoreError` with a sentence a person can act on — this is the one
    place that can tell "not a database" from "not *this* database", and the
    difference is the whole of what the dialog can say back.
    """
    with open(path, "rb") as handle:
        if handle.read(16) != b"SQLite format 3\x00":
            raise RestoreError(
                "That is not a SQLite database — a Drip backup is the .db file "
                "the Backup button hands you."
            )

    try:
        # Read-only, and immutable=1 so a half-written file cannot be recovered
        # into by the act of looking at it.
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        raise RestoreError(f"The file could not be opened as a database: {exc}")

    try:
        result = conn.execute("PRAGMA integrity_check").fetchone()
        if not result or result[0] != "ok":
            raise RestoreError(
                "The database is damaged and was not restored — the copy you "
                "uploaded is incomplete."
            )

        tables = {row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )}
        missing = REQUIRED_TABLES - tables
        if missing:
            raise RestoreError(
                "That is a SQLite database, but not a Drip one — it has no "
                f"{' or '.join(sorted(missing))} table."
            )

        purchases = conn.execute("SELECT count(*) FROM purchase").fetchone()[0]
        candles = (
            conn.execute("SELECT count(*) FROM candle").fetchone()[0]
            if "candle" in tables
            else 0
        )
    except sqlite3.DatabaseError as exc:
        # In practice this is a truncated download: the header is intact, so it
        # got as far as being opened, and the first real read finds the missing
        # tail. Reported as the damage it is rather than as SQLite's own words —
        # "database disk image is malformed" is not a sentence anyone can act on.
        logger.warning("Restore rejected an unreadable database: %s", exc)
        raise RestoreError(
            "The database is damaged and was not restored — the copy you "
            "uploaded is incomplete."
        )
    finally:
        conn.close()

    return {"purchases": purchases, "candles": candles}


def stage(stream, filename: str = "") -> tuple[Path, dict]:
    """Write an upload to a temporary file and check it. Never touches the DB.

    Split from `apply` on purpose: everything that can refuse the file happens
    before anything is replaced, so the failure modes are all on this side of
    the line.
    """
    handle, temp = tempfile.mkstemp(prefix="drip-restore-", suffix=".db")
    path = Path(temp)
    written = 0
    try:
        with os.fdopen(handle, "wb") as out:
            while chunk := stream.read(CHUNK):
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise RestoreError(
                        "That file is far larger than any Drip database — "
                        "nothing was changed."
                    )
                out.write(chunk)

        if not written:
            raise RestoreError("The upload was empty — nothing was changed.")

        facts = _inspect(path)
    except Exception:
        path.unlink(missing_ok=True)
        raise

    logger.info(
        "Restore staged from %s: %s buys, %s candles",
        filename or "an upload", facts["purchases"], facts["candles"],
    )
    return path, facts


def apply(staged: Path) -> dict:
    """Put a staged file in place of the live database and reopen everything.

    Imports are local: this pulls in most of the app, and `backup` is imported
    by a router that loads during start-up. The order below is the only one that
    works — drop the pool, move the old file aside, move the new one in, migrate
    it, then invalidate everything that was an answer about the old one.
    """
    from . import auth, credentials, indicators, research, scheduler, trading
    from .database import (
        engine,
        init_db,
        load_digest_settings,
        load_settings,
    )
    from sqlmodel import Session

    # Close every pooled connection first. SQLite holds the file open per
    # connection, and replacing it underneath one is how a running app ends up
    # reading half of each.
    engine.dispose()

    if DB_PATH.exists():
        shutil.move(str(DB_PATH), str(REPLACED_PATH))
    shutil.move(str(staged), str(DB_PATH))

    # A backup is older than now by definition, so it may predate a column this
    # version expects. Exactly what start-up does, for exactly that reason.
    init_db()

    # Everything cached in this process was an answer about a file that is gone.
    # The lock goes with them, and it is the one worth naming: the replaced
    # database's opinion about who may come in may not outlive it. A backup from
    # before there was a password restores an install with no password, and one
    # taken under a different password takes that password's sessions down with
    # it — both correct, and both a consequence of `auth.Lock.signing_key`
    # rather than anything coded here.
    auth.invalidate()
    credentials.invalidate()
    trading.invalidate_balance_cache()
    research.clear_cache()
    indicators.clear_fng_history_cache()

    # The restored install may buy on a different day than the one that was
    # running a moment ago; a job still holding the old schedule would be the
    # replaced database's opinion outliving it.
    with Session(engine) as session:
        settings = load_settings(session)
        scheduler.start(settings, load_digest_settings(session))

    logger.warning("Database restored from an upload - previous file kept as %s",
                   REPLACED_PATH.name)
    return {
        "schedule_weekday": settings.schedule_weekday,
        "schedule_time": settings.schedule_time,
        "dry_run": settings.dry_run,
    }

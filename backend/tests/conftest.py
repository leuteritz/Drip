"""Test fixtures — an in-memory database and nothing else.

There is no mock framework here and there is not going to be one. What is worth
testing in Drip is the arithmetic that decides money: what a period is, whether
a slot was missed, what a reading scores, what a stack is worth. All of it is
pure or takes a `Session`, so a SQLite database in memory is the whole harness.

Nothing here touches Coinbase, and nothing renders. Those are the two things
this suite deliberately does not cover: one is somebody else's server and the
other is what the screenshots are for.
"""
import sys
from datetime import datetime
from pathlib import Path

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

# The app is imported as `app.*`, so the package's parent has to be importable.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import BotSettings, Purchase  # noqa: E402


@pytest.fixture
def session():
    """A fresh, empty database per test.

    `StaticPool` plus a shared cache is what keeps an in-memory SQLite alive
    across the connections SQLModel opens — without it every checkout gets its
    own blank database and nothing written is ever read back.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as open_session:
        yield open_session


@pytest.fixture
def settings(session):
    """The singleton settings row, as a fresh install has it."""
    row = BotSettings(id=1)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@pytest.fixture
def buy(session):
    """Put one purchase row in, for tests that only care that something is there.

    A fixture rather than a plain helper so the tests need no imports from each
    other — `tests/` stays a directory of independent files rather than becoming
    a package with its own import graph.
    """

    def _buy(when: datetime, *, dry_run=False, order_id="test", amount=50.0):
        row = Purchase(
            timestamp=when,
            price_eur=50_000.0,
            amount_eur=amount,
            btc_amount=amount / 50_000.0,
            fear_greed=50,
            rsi=50.0,
            ma_350=50_000.0,
            score=0,
            multiplier=1.0,
            order_id=order_id,
            status="Success",
            dry_run=dry_run,
            filled=True,
        )
        session.add(row)
        session.commit()
        return row

    return _buy

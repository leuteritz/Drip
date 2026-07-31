"""Read-only strategy research. Nothing here touches the database or an order.

Every endpoint reads the same cached scoring table (`research.score_table`), so
the first call after a cold start is the slow one - it may fetch up to three
years of candles - and the rest are cheap.
"""
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from .. import research
from ..database import get_session, load_settings
from ..schemas import (
    AttributionResponse,
    ForwardReturnsResponse,
    GridResponse,
    RollingWindowsResponse,
)

router = APIRouter(prefix="/api/research", tags=["research"])

# Analyses are cut from the cached table, so a longer window costs nothing extra.
DaysQuery = Query(default=365, ge=90, le=research.RESEARCH_DAYS)


@router.get("/attribution", response_model=AttributionResponse)
def attribution(days: int = DaysQuery, session: Session = Depends(get_session)):
    """How the edge over plain DCA splits between the three indicators."""
    return research.attribution(session, days=days, settings=load_settings(session))


@router.get("/forward-returns", response_model=ForwardReturnsResponse)
def forward_returns(days: int = DaysQuery, session: Session = Depends(get_session)):
    """What the price did after each score, bucketed by multiplier tier."""
    return research.forward_returns(session, days=days)


@router.get("/rolling", response_model=RollingWindowsResponse)
def rolling(
    window_days: int = Query(default=365, ge=90, le=730),
    session: Session = Depends(get_session),
):
    """The backtest repeated from every start date a week apart."""
    return research.rolling_windows(
        session, window_days=window_days, settings=load_settings(session)
    )


@router.get("/grid", response_model=GridResponse)
def grid(days: int = DaysQuery, session: Session = Depends(get_session)):
    """Buy weekday against multiplier spread."""
    return research.grid(session, days=days, settings=load_settings(session))

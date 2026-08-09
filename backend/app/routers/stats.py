from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from .. import analytics, holdings, outlook, pulse
from ..database import get_session
from ..schemas import (
    ComparisonPoint,
    HoldingsResponse,
    OutlookResponse,
    PerformanceResponse,
    PulseResponse,
)

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/performance", response_model=PerformanceResponse)
def performance(include_dry_run: bool = Query(default=True),
                session: Session = Depends(get_session)):
    return analytics.performance_summary(session, include_dry_run)


@router.get("/comparison", response_model=list[ComparisonPoint])
def comparison(include_dry_run: bool = Query(default=True),
               session: Session = Depends(get_session)):
    return analytics.comparison_series(session, include_dry_run)


@router.get("/holdings", response_model=HoldingsResponse)
def holdings_summary(include_dry_run: bool = Query(default=True),
                     session: Session = Depends(get_session)):
    """Cost basis against the market, plus how old each lot is."""
    return holdings.summary(session, include_dry_run)


@router.get("/pulse", response_model=PulseResponse)
def pulse_summary(periods: int | None = Query(default=None, ge=4, le=400),
                  session: Session = Depends(get_session)):
    """Which weeks a buy actually landed in — and what the gaps would have cost.

    No `include_dry_run`: this counts every run the bot made, test or live,
    because the question is whether the machine woke up.
    """
    return pulse.summary(session, periods)


@router.get("/outlook", response_model=OutlookResponse)
def outlook_summary(include_dry_run: bool = Query(default=True),
                    session: Session = Depends(get_session)):
    """The recent stacking rate carried forward, and the next round number."""
    return outlook.summary(session, include_dry_run)

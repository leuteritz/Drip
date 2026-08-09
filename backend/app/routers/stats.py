from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from .. import analytics, custody, holdings, outlook, pulse, waterline
from ..database import get_session, load_settings
from ..schemas import (
    ComparisonPoint,
    CustodyResponse,
    HoldingsResponse,
    OutlookResponse,
    PerformanceResponse,
    PulseResponse,
    WaterlineResponse,
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


@router.get("/waterline", response_model=WaterlineResponse)
def waterline_summary(include_dry_run: bool = Query(default=True),
                      session: Session = Depends(get_session)):
    """How far under water the stack went, and what was bought down there.

    Takes the dry-run filter because it is cut from the same daily series the
    comparison chart plots, and the two must show the same days.
    """
    return waterline.summary(session, include_dry_run)


@router.get("/custody", response_model=CustodyResponse)
def custody_summary(session: Session = Depends(get_session)):
    """How much of what Drip bought is still sitting on the exchange.

    No `include_dry_run` either, and for a stronger reason than `pulse` has:
    a test run never bought bitcoin, so it cannot be in anyone's custody. The
    threshold is read from the settings rather than passed in — it is the
    install's own answer to how much is too much to leave there.
    """
    return custody.summary(session, load_settings(session).custody_threshold_eur)


@router.get("/outlook", response_model=OutlookResponse)
def outlook_summary(include_dry_run: bool = Query(default=True),
                    session: Session = Depends(get_session)):
    """The recent stacking rate carried forward, and the next round number."""
    return outlook.summary(session, include_dry_run)

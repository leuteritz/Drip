from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from .. import analytics, holdings
from ..database import get_session
from ..schemas import ComparisonPoint, HoldingsResponse, PerformanceResponse

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

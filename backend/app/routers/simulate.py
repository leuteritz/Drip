from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from .. import simulation
from ..database import get_session, load_settings

router = APIRouter(prefix="/api/simulate", tags=["simulate"])


@router.get("")
def simulate(
    days: int = Query(365, ge=30, le=1500),
    session: Session = Depends(get_session),
):
    """Backtest the current bot settings over the last `days` days vs. plain DCA."""
    settings = load_settings(session)
    return simulation.backtest(session, days=days, settings=settings)

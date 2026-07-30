from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from .. import simulation
from ..database import get_session, load_settings
from ..schemas import SimulationResponse

router = APIRouter(prefix="/api/simulate", tags=["simulate"])


@router.get("", response_model=SimulationResponse)
def simulate(
    days: int = Query(365, ge=30, le=1500),
    session: Session = Depends(get_session),
):
    """Backtest the current bot settings over the last `days` days vs. plain DCA."""
    return simulation.backtest(session, days=days, settings=load_settings(session))

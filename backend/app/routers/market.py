from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from .. import strategy
from ..database import get_session
from ..market_data import ensure_candles
from ..schemas import CandleResponse, IndicatorsResponse

# There was a `GET /price` here, and it went because nothing ever called it: the
# header reads the price off `/indicators`, which has to score the market anyway
# and carries `current_price` with the rest. A spot price on its own is available
# to any caller through `market_data.get_current_price`.
router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/candles", response_model=list[CandleResponse])
def candles(days: int = Query(default=90, ge=7, le=1500),
            session: Session = Depends(get_session)):
    return [
        {"date": c.day.isoformat(), "open": c.open, "high": c.high,
         "low": c.low, "close": c.close, "volume": c.volume}
        for c in ensure_candles(session, days=days)
    ]


@router.get("/indicators", response_model=IndicatorsResponse)
def indicators(session: Session = Depends(get_session)):
    """Live analysis: what would the bot do right now?"""
    return strategy.analyze(session).as_dict()

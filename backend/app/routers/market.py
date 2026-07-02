from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from .. import strategy
from ..coinbase_client import ensure_candles, get_current_price
from ..database import get_session

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/price")
def price():
    return {"price": get_current_price()}


@router.get("/candles")
def candles(days: int = Query(default=90, ge=7, le=1500),
            session: Session = Depends(get_session)):
    result = ensure_candles(session, days=days)
    return [
        {"date": c.day.isoformat(), "open": c.open, "high": c.high,
         "low": c.low, "close": c.close, "volume": c.volume}
        for c in result
    ]


@router.get("/indicators")
def indicators(session: Session = Depends(get_session)):
    """Live analysis: what would the bot do right now?"""
    return strategy.analyze(session).as_dict()

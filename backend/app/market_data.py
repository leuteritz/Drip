"""Public Coinbase market data: spot price and the cached daily candle series.

Deliberately credential-free — these are the public brokerage endpoints, which
is what lets the whole dashboard, dry runs, backtests and analytics work with an
empty backend/.env. Anything requiring an API key lives in `trading.py`.
"""
import logging
from datetime import date, datetime, time, timedelta, timezone

import requests
from sqlmodel import Session, select

from .constants import PRODUCT_ID
from .models import Candle

logger = logging.getLogger(__name__)

PUBLIC_API = "https://api.coinbase.com/api/v3/brokerage/market"
MAX_CANDLES_PER_REQUEST = 300  # API limit is 350, keep some headroom


def get_current_price() -> float:
    """Current BTC-EUR price (public endpoint)."""
    resp = requests.get(f"{PUBLIC_API}/products/{PRODUCT_ID}", timeout=15)
    resp.raise_for_status()
    return float(resp.json()["price"])


def _fetch_daily_candles(start: datetime, end: datetime) -> list[dict]:
    resp = requests.get(
        f"{PUBLIC_API}/products/{PRODUCT_ID}/candles",
        params={
            "start": int(start.timestamp()),
            "end": int(end.timestamp()),
            "granularity": "ONE_DAY",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("candles", [])


def _refetch_from(cached_days: list[date], start_day: date, today: date) -> date:
    """First day that has to be fetched again.

    Today's candle keeps moving, so it is always refetched. Beyond that we only
    skip ahead to the end of the cache when the cache actually reaches back to
    the start of the requested window — otherwise we refetch the whole window,
    which is also what repairs a hole in the middle of the cache.
    """
    settled = sorted(d for d in cached_days if d < today)
    if settled and settled[0] <= start_day + timedelta(days=1):
        return settled[-1]
    return start_day


def ensure_candles(session: Session, days: int) -> list[Candle]:
    """Returns daily candles for the last `days` days; missing ones are
    fetched from Coinbase and cached in SQLite."""
    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=days)

    cached = {
        c.day: c
        for c in session.exec(select(Candle).where(Candle.day >= start_day)).all()
    }
    missing_from = _refetch_from(list(cached), start_day, today)

    cursor = datetime.combine(missing_from, time.min, tzinfo=timezone.utc)
    fetch_end = datetime.now(timezone.utc)

    while cursor < fetch_end:
        chunk_end = min(cursor + timedelta(days=MAX_CANDLES_PER_REQUEST), fetch_end)
        try:
            raw = _fetch_daily_candles(cursor, chunk_end)
        except requests.RequestException as exc:
            logger.warning("Candle fetch failed: %s", exc)
            break
        for entry in raw:
            day = datetime.fromtimestamp(int(entry["start"]), tz=timezone.utc).date()
            session.merge(Candle(
                day=day,
                open=float(entry["open"]),
                high=float(entry["high"]),
                low=float(entry["low"]),
                close=float(entry["close"]),
                volume=float(entry["volume"]),
            ))
        cursor = chunk_end
    session.commit()

    result = session.exec(
        select(Candle).where(Candle.day >= start_day).order_by(Candle.day)
    ).all()
    return list(result)

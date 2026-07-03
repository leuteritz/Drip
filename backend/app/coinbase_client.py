"""Coinbase access.

Market data (price, candles) uses the public brokerage endpoints without an
API key, so the dashboard and dry runs work without credentials.
Only real orders require the authenticated SDK client.
"""
import logging
import time as time_module
import uuid
from datetime import datetime, time, timedelta, timezone

import requests
from sqlmodel import Session, select

from .config import config
from .models import Candle

logger = logging.getLogger(__name__)

PUBLIC_API = "https://api.coinbase.com/api/v3/brokerage/market"
PRODUCT_ID = "BTC-EUR"
MAX_CANDLES_PER_REQUEST = 300  # API limit is 350, keep some headroom


class CoinbaseError(Exception):
    pass


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


def ensure_candles(session: Session, days: int) -> list[Candle]:
    """Returns daily candles for the last `days` days; missing ones are
    fetched from Coinbase and cached in SQLite."""
    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=days)

    cached = {
        c.day: c
        for c in session.exec(select(Candle).where(Candle.day >= start_day)).all()
    }
    # Today's candle keeps changing -> always refetch it
    missing_from = start_day
    have_days = sorted(d for d in cached if d < today)
    if have_days:
        # Only fetch the range after the last cached day, provided the cache
        # is gapless at the start of the window
        if have_days[0] <= start_day + timedelta(days=1):
            missing_from = have_days[-1]

    fetch_start = datetime.combine(missing_from, time.min, tzinfo=timezone.utc)
    fetch_end = datetime.now(timezone.utc)

    cursor = fetch_start
    while cursor < fetch_end:
        chunk_end = min(cursor + timedelta(days=MAX_CANDLES_PER_REQUEST), fetch_end)
        try:
            raw = _fetch_daily_candles(cursor, chunk_end)
        except requests.RequestException as exc:
            logger.warning("Candle fetch failed: %s", exc)
            break
        for entry in raw:
            day = datetime.fromtimestamp(int(entry["start"]), tz=timezone.utc).date()
            candle = Candle(
                day=day,
                open=float(entry["open"]),
                high=float(entry["high"]),
                low=float(entry["low"]),
                close=float(entry["close"]),
                volume=float(entry["volume"]),
            )
            session.merge(candle)
        cursor = chunk_end
    session.commit()

    result = session.exec(
        select(Candle).where(Candle.day >= start_day).order_by(Candle.day)
    ).all()
    return list(result)


def _rest_client():
    """Authenticated SDK client. Raises CoinbaseError without credentials."""
    if not config.has_coinbase_credentials:
        raise CoinbaseError(
            "No Coinbase credentials configured in backend/.env "
            "(COINBASE_API_KEY / COINBASE_API_SECRET)"
        )

    from coinbase.rest import RESTClient

    return RESTClient(
        api_key=config.coinbase_api_key,
        api_secret=config.api_secret_normalized,
    )


def _balance_value(account) -> float:
    balance = getattr(account, "available_balance", None)
    if balance is None:
        return 0.0
    value = balance.get("value") if isinstance(balance, dict) else getattr(balance, "value", None)
    return float(value) if value is not None else 0.0


def get_balances() -> dict:
    """Available EUR and BTC balances on the Coinbase account.
    Raises CoinbaseError without credentials or on API failure."""
    client = _rest_client()
    balances = {"eur_available": 0.0, "btc_available": 0.0}
    wanted = {"EUR": "eur_available", "BTC": "btc_available"}

    try:
        cursor = None
        while wanted:
            resp = client.get_accounts(limit=250, cursor=cursor)
            for account in getattr(resp, "accounts", []) or []:
                key = wanted.pop(getattr(account, "currency", None), None)
                if key:
                    balances[key] = _balance_value(account)
            cursor = getattr(resp, "cursor", None)
            if not getattr(resp, "has_next", False) or not cursor:
                break
    except CoinbaseError:
        raise
    except Exception as exc:
        raise CoinbaseError(f"Balance fetch failed: {exc}")

    return balances


_balance_cache: tuple[float, dict] | None = None


def get_balances_cached(max_age: float = 30.0) -> dict:
    """get_balances with a short TTL cache so header refreshes don't
    hammer the authenticated endpoint."""
    global _balance_cache
    now = time_module.monotonic()
    if _balance_cache is not None and now - _balance_cache[0] < max_age:
        return _balance_cache[1]
    data = get_balances()
    _balance_cache = (now, data)
    return data


def invalidate_balance_cache() -> None:
    global _balance_cache
    _balance_cache = None


def place_market_buy(amount_eur: float) -> tuple[str, str]:
    """Places a real market buy. Returns (order_id, status).
    Raises CoinbaseError on failure."""
    client = _rest_client()
    order = client.market_order_buy(
        client_order_id=str(uuid.uuid4()),
        product_id=PRODUCT_ID,
        quote_size=f"{amount_eur:.2f}",
    )

    # CreateOrderResponse is an object, not a dict
    if getattr(order, "success", False):
        invalidate_balance_cache()
        success = order.success_response
        order_id = getattr(success, "order_id", None) or (
            success.get("order_id") if isinstance(success, dict) else "unknown"
        )
        return str(order_id), "Success"

    error = getattr(order, "error_response", None)
    raise CoinbaseError(f"Order failed: {error}")

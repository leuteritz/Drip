"""Authenticated Coinbase access: account balances and real market orders.

This is the only module that needs the Coinbase key pair. It is kept apart from
`market_data.py` on purpose: the SDK client is imported lazily inside
`_rest_client`, so an installation without credentials never touches it and the
rest of the app keeps working. Where the key pair comes from is `credentials.py`
alone — dashboard first, `backend/.env` second.
"""
import logging
import time
import uuid

from . import credentials
from .constants import PRODUCT_ID, STATUS_SUCCESS

logger = logging.getLogger(__name__)

BALANCE_CACHE_TTL = 30.0  # seconds


class CoinbaseError(Exception):
    """Raised when credentials are missing or the authenticated API fails."""


def _rest_client():
    """Authenticated SDK client. Raises CoinbaseError without credentials.

    Built fresh per call from `credentials.current()`, so a key pasted into the
    dashboard is in effect on the next request rather than after a restart.
    """
    creds = credentials.current()
    if not creds.has_coinbase:
        raise CoinbaseError(
            "No Coinbase credentials - add them under Setup in the dashboard, "
            "or set COINBASE_API_KEY / COINBASE_API_SECRET in backend/.env"
        )

    from coinbase.rest import RESTClient

    return RESTClient(
        api_key=creds.coinbase_api_key.value,
        api_secret=creds.api_secret_normalized,
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


def get_balances_cached(max_age: float = BALANCE_CACHE_TTL) -> dict:
    """get_balances with a short TTL cache so header refreshes don't
    hammer the authenticated endpoint."""
    global _balance_cache
    now = time.monotonic()
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
        return str(order_id), STATUS_SUCCESS

    error = getattr(order, "error_response", None)
    raise CoinbaseError(f"Order failed: {error}")

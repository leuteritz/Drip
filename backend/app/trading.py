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
from dataclasses import dataclass

from . import credentials
from .constants import PRODUCT_ID, STATUS_SUCCESS

logger = logging.getLogger(__name__)

BALANCE_CACHE_TTL = 30.0  # seconds

# How long a placed order is given to report what it actually bought. A market
# order fills at once, but the order endpoint can lag its own fill by a moment,
# so this is a short wait and not a retry loop: roughly four seconds, after
# which the buy is recorded from the estimate instead. Nothing is re-sent — the
# order is already placed and paid for, and reading it is the only thing that
# can still fail here.
FILL_POLL_ATTEMPTS = 6
FILL_POLL_DELAY = 0.75  # seconds between reads


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


@dataclass
class Fill:
    """What a placed order turned out to be.

    `read` is the whole point of this type. An order is sent as a euro amount
    and comes back as a quantity of bitcoin, a price and a fee, and only the
    exchange knows those three — the euros are the amount asked for, not the
    amount that reached the stack. When `read` is False the exchange did not say
    within `FILL_POLL_ATTEMPTS`, and the caller works the buy out itself the way
    it always did; the fields below are then zero and mean nothing.
    """

    order_id: str
    status: str
    btc: float = 0.0
    price_eur: float = 0.0
    fee_eur: float = 0.0
    read: bool = False


def _attr(source, name):
    """One field off a response that is sometimes an object and sometimes a dict.

    The SDK is inconsistent about this across endpoints and versions, and a
    fill that cannot be read costs a purchase its real numbers, so both shapes
    are accepted rather than assumed.
    """
    if source is None:
        return None
    if isinstance(source, dict):
        return source.get(name)
    return getattr(source, name, None)


def _num(source, name) -> float:
    value = _attr(source, name)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def read_fill(client, order_id: str) -> Fill | None:
    """Ask the exchange what the order actually bought.

    Read-only and re-entrant: it polls `get_order` and never places anything,
    so the worst a failure here can do is leave the purchase on its estimate.
    That is deliberate — by the time this runs the money is already spent, and
    an exception escaping would turn a completed buy into a recorded failure.
    """
    for attempt in range(FILL_POLL_ATTEMPTS):
        try:
            order = _attr(client.get_order(order_id=order_id), "order")
        except Exception as exc:  # network, auth, shape - all the same answer
            logger.warning("Could not read fill for order %s: %s", order_id, exc)
            return None

        btc = _num(order, "filled_size")
        if btc > 0:
            # `total_fees` is charged in the quote currency, which is the euro
            # side of BTC-EUR - so it is directly comparable to the amount asked
            # for, and the difference is what never became bitcoin.
            fee = _num(order, "total_fees")
            price = _num(order, "average_filled_price")
            if price <= 0:
                filled_value = _num(order, "filled_value")
                price = filled_value / btc if filled_value > 0 else 0.0
            return Fill(
                order_id=order_id,
                status=STATUS_SUCCESS,
                btc=btc,
                price_eur=price,
                fee_eur=fee,
                read=price > 0,
            )

        if attempt + 1 < FILL_POLL_ATTEMPTS:
            time.sleep(FILL_POLL_DELAY)

    logger.warning("Order %s reported no fill in time", order_id)
    return None


def place_market_buy(amount_eur: float) -> Fill:
    """Places a real market buy and reports what it bought.

    Raises CoinbaseError only when the *order* fails. Once it is accepted the
    buy has happened, so everything after that point degrades to a Fill with
    `read=False` rather than raising.
    """
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
        order_id = str(order_id)
        return read_fill(client, order_id) or Fill(
            order_id=order_id, status=STATUS_SUCCESS
        )

    error = getattr(order, "error_response", None)
    raise CoinbaseError(f"Order failed: {error}")

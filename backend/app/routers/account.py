"""Coinbase account info (balances)."""
import logging

from fastapi import APIRouter

from .. import credentials, well
from ..schemas import BalanceResponse
from ..trading import CoinbaseError, get_balances_cached

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/account", tags=["account"])

_UNAVAILABLE = {"eur_available": None, "btc_available": None}


@router.get("/balance", response_model=BalanceResponse)
def balance():
    """Available EUR/BTC on the Coinbase account.

    Always returns 200 so the dashboard degrades gracefully: without
    credentials `configured` is false, on API failure `error` is set.

    `low_buys` rides along on every answer, including the two that carry no
    balance at all. It is `well.LOW_BUYS` - the threshold the header's well chip
    turns rose at, which used to be written down a second time in `Readouts.tsx`
    and kept in step by a comment. The chip turning rose and Discord calling the
    well low are one statement, so there is one number and the backend owns it.
    """
    threshold = {"low_buys": well.LOW_BUYS}
    if not credentials.current().has_coinbase:
        return {"configured": False, **_UNAVAILABLE, **threshold, "error": None}
    try:
        balances = get_balances_cached()
    except CoinbaseError as exc:
        logger.warning("Balance fetch failed: %s", exc)
        return {"configured": True, **_UNAVAILABLE, **threshold, "error": str(exc)}
    return {"configured": True, **balances, **threshold, "error": None}

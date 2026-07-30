"""Coinbase account info (balances)."""
import logging

from fastapi import APIRouter

from ..config import config
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
    """
    if not config.has_coinbase_credentials:
        return {"configured": False, **_UNAVAILABLE, "error": None}
    try:
        balances = get_balances_cached()
    except CoinbaseError as exc:
        logger.warning("Balance fetch failed: %s", exc)
        return {"configured": True, **_UNAVAILABLE, "error": str(exc)}
    return {"configured": True, **balances, "error": None}

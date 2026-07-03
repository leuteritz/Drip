"""Coinbase account info (balances)."""
import logging

from fastapi import APIRouter

from ..coinbase_client import CoinbaseError, get_balances_cached
from ..config import config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/balance")
def balance():
    """Available EUR/BTC on the Coinbase account.

    Always returns 200 so the dashboard degrades gracefully: without
    credentials `configured` is false, on API failure `error` is set.
    """
    if not config.has_coinbase_credentials:
        return {
            "configured": False,
            "eur_available": None,
            "btc_available": None,
            "error": None,
        }
    try:
        balances = get_balances_cached()
    except CoinbaseError as exc:
        logger.warning("Balance fetch failed: %s", exc)
        return {
            "configured": True,
            "eur_available": None,
            "btc_available": None,
            "error": str(exc),
        }
    return {"configured": True, **balances, "error": None}

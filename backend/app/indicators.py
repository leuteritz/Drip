"""Technical indicators."""
import logging
import time
from datetime import date, datetime, timezone

logger = logging.getLogger(__name__)

# Cached full Fear & Greed history (alternative.me), refreshed at most daily.
_FNG_HISTORY: dict[date, int] = {}
_FNG_HISTORY_FETCHED_AT: float = 0.0
_FNG_HISTORY_TTL = 6 * 60 * 60  # 6 hours


def calculate_rsi_wilder(prices: list[float], period: int = 14) -> float:
    """RSI following Wilder's original smoothing method."""
    if len(prices) < period + 1:
        return 50.0

    deltas = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
    gains = [max(d, 0.0) for d in deltas]
    losses = [abs(min(d, 0.0)) for d in deltas]

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def moving_average(prices: list[float]) -> float:
    if not prices:
        return 0.0
    return sum(prices) / len(prices)


def get_fear_and_greed() -> dict:
    """Crypto Fear & Greed index (alternative.me). Falls back to neutral 50."""
    try:
        import requests

        resp = requests.get("https://api.alternative.me/fng/?limit=1", timeout=15)
        resp.raise_for_status()
        entry = resp.json()["data"][0]
        return {
            "value": int(entry["value"]),
            "classification": str(entry["value_classification"]),
        }
    except Exception as exc:
        logger.warning("Fear & Greed unavailable: %s", exc)
        return {"value": 50, "classification": "Neutral (fallback)"}


def get_fear_and_greed_history() -> dict[date, int]:
    """Full daily Fear & Greed history (alternative.me), keyed by date.

    Used for backtesting so simulations score with the real historical F&G
    values instead of a placeholder. Cached in-process to avoid refetching the
    whole series on every request. Returns {} on error; callers should default
    missing dates to a neutral 50.
    """
    global _FNG_HISTORY, _FNG_HISTORY_FETCHED_AT

    if _FNG_HISTORY and (time.time() - _FNG_HISTORY_FETCHED_AT) < _FNG_HISTORY_TTL:
        return _FNG_HISTORY

    try:
        import requests

        resp = requests.get(
            "https://api.alternative.me/fng/?limit=0&format=json", timeout=20
        )
        resp.raise_for_status()
        history: dict[date, int] = {}
        for entry in resp.json().get("data", []):
            day = datetime.fromtimestamp(
                int(entry["timestamp"]), tz=timezone.utc
            ).date()
            history[day] = int(entry["value"])
        if history:
            _FNG_HISTORY = history
            _FNG_HISTORY_FETCHED_AT = time.time()
        return history
    except Exception as exc:
        logger.warning("Fear & Greed history unavailable: %s", exc)
        return _FNG_HISTORY  # stale cache if we have one, else {}

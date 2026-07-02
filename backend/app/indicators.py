"""Technical indicators."""
import logging

logger = logging.getLogger(__name__)


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

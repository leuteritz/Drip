"""Buy strategy: indicator score -> multiplier applied to the base amount."""
from dataclasses import dataclass

from sqlmodel import Session

from . import coinbase_client, indicators

# Thresholds (kept as constants so they can become configurable later)
FNG_STRONG_FEAR = 25
FNG_FEAR = 45
FNG_NEUTRAL = 55
RSI_OVERSOLD = 30
RSI_SLIGHTLY_OVERSOLD = 45
RSI_OVERBOUGHT = 70
MA_DAYS = 350
RSI_PERIOD = 14
SCORE_MAX = 8


@dataclass
class Analysis:
    score: int
    factors: list[str]
    current_price: float
    fear_greed: int
    fng_classification: str
    rsi: float
    ma_350: float
    multiplier: float = 1.0
    signal: str = ""
    color: int = 0xFFA500

    def as_dict(self) -> dict:
        return {
            "score": self.score,
            "score_max": SCORE_MAX,
            "factors": self.factors,
            "current_price": self.current_price,
            "fear_greed": self.fear_greed,
            "fng_classification": self.fng_classification,
            "rsi": self.rsi,
            "ma_350": self.ma_350,
            "ma_distance_pct": ((self.current_price - self.ma_350) / self.ma_350 * 100)
            if self.ma_350
            else 0.0,
            "multiplier": self.multiplier,
            "signal": self.signal,
        }


def determine_purchase_strategy(score: int) -> dict:
    """Maps the score to a buy multiplier - the bot ALWAYS buys."""
    if score >= 5:
        return {"multiplier": 1.5, "signal": "Strong buy signal", "color": 0x45818C}
    if score >= 3:
        return {"multiplier": 1.25, "signal": "Good buy signal", "color": 0x93B7BE}
    if score >= 1:
        return {"multiplier": 1.0, "signal": "Normal buy signal", "color": 0xD5C7BC}
    if score >= -1:
        return {"multiplier": 0.75, "signal": "Weak buy signal", "color": 0x785964}
    return {"multiplier": 0.5, "signal": "Minimum buy", "color": 0x785964}


def score_indicators(
    fear_greed: int,
    fng_classification: str,
    rsi: float,
    current_price: float,
    ma_350: float,
) -> Analysis:
    """Pure scoring: turns the three indicator readings into an Analysis.

    Shared by the live path (`analyze`) and the backtest simulation so both
    produce identical scores/multipliers from the same inputs.
    """
    score = 0
    factors: list[str] = []

    # 1. Fear & Greed index
    if fear_greed < FNG_STRONG_FEAR:
        score += 3
        factors.append(f"F&G {fear_greed} ({fng_classification}, +3)")
    elif fear_greed < FNG_FEAR:
        score += 2
        factors.append(f"F&G {fear_greed} ({fng_classification}, +2)")
    elif fear_greed < FNG_NEUTRAL:
        factors.append(f"F&G {fear_greed} ({fng_classification}, +0)")
    else:
        score -= 2
        factors.append(f"F&G {fear_greed} ({fng_classification}, -2)")

    # 2. RSI
    if rsi < RSI_OVERSOLD:
        score += 3
        factors.append(f"RSI {rsi:.1f} (strongly oversold, +3)")
    elif rsi < RSI_SLIGHTLY_OVERSOLD:
        score += 1
        factors.append(f"RSI {rsi:.1f} (slightly oversold, +1)")
    elif rsi > RSI_OVERBOUGHT:
        score -= 2
        factors.append(f"RSI {rsi:.1f} (overbought, -2)")
    else:
        factors.append(f"RSI {rsi:.1f} (neutral, +0)")

    # 3. 350-day moving average
    if ma_350 <= 0:
        ma_350 = current_price  # no data available -> neutral
    diff_pct = (current_price - ma_350) / ma_350 * 100 if ma_350 else 0.0
    if current_price < ma_350:
        score += 2
        factors.append(f"Price below {MA_DAYS}d MA ({diff_pct:.1f}%, +2)")
    else:
        factors.append(f"Price above {MA_DAYS}d MA (+{diff_pct:.1f}%, +0)")

    strategy = determine_purchase_strategy(score)
    return Analysis(
        score=score,
        factors=factors,
        current_price=current_price,
        fear_greed=fear_greed,
        fng_classification=fng_classification,
        rsi=rsi,
        ma_350=ma_350,
        multiplier=strategy["multiplier"],
        signal=strategy["signal"],
        color=strategy["color"],
    )


def analyze(session: Session) -> Analysis:
    """Computes the score and multiplier from live market data."""
    fng = indicators.get_fear_and_greed()
    current_price = coinbase_client.get_current_price()

    candles = coinbase_client.ensure_candles(session, days=MA_DAYS + 5)
    closes = [c.close for c in candles]
    rsi = indicators.calculate_rsi_wilder(closes[-(RSI_PERIOD + 7):], period=RSI_PERIOD)
    ma_350 = indicators.moving_average(closes[-MA_DAYS:])

    return score_indicators(
        fear_greed=fng["value"],
        fng_classification=fng["classification"],
        rsi=rsi,
        current_price=current_price,
        ma_350=ma_350,
    )

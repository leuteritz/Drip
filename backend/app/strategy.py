"""Buy strategy: indicator score -> multiplier applied to the base amount."""
from dataclasses import dataclass

from sqlmodel import Session

from . import indicators, market_data

# Thresholds (kept as constants so they can become configurable later)
FNG_STRONG_FEAR = 25
FNG_FEAR = 45
FNG_NEUTRAL = 55
RSI_OVERSOLD = 30
RSI_SLIGHTLY_OVERSOLD = 45
RSI_OVERBOUGHT = 70
MA_DAYS = 350
RSI_PERIOD = 14

# How far the price sits from its own year, in percent. The moving average is
# the one indicator here that measures a *distance*, and it used to be read as a
# yes/no: 1% below its year scored the same +2 as 40% below, and no amount of
# dearness cost anything at all. These are the steps that distance is graded on.
MA_FAR_BELOW_PCT = -25.0
MA_BELOW_PCT = -10.0
MA_ABOVE_PCT = 30.0
MA_FAR_ABOVE_PCT = 60.0

# The ends of the score: -2 -2 -2 and +3 +3 +3. Both are reachable - since the
# moving average can subtract, "everything dear at once" is a real reading
# rather than a floor nothing ever touches.
SCORE_MAX = 9
SCORE_MIN = -6

# Wilder's smoothing has alpha = 1/14, so a short slice is mostly its own seed:
# after the 6 steps a 21-close window allows, 64% of the value is still the
# simple mean it started from, and the number that came out was not the RSI the
# README names. 200 closes is fully converged, and `analyze` already fetches 355.
RSI_LOOKBACK = 200

# Inputs that score exactly zero points in their own block below. Isolating one
# indicator means handing the other two these.
NEUTRAL_FNG = 50
NEUTRAL_RSI = 50.0


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
            "points": indicator_points(
                self.fear_greed, self.rsi, self.current_price, self.ma_350
            ),
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
            # The signal's own colour, one of the five palette hexes. It exists
            # for the Discord embed; the dashboard reads it too, so the browser
            # tab's drop carries the same colour as the message would.
            "color": self.color,
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


def indicator_points(
    fear_greed: int, rsi: float, current_price: float, ma_350: float
) -> dict[str, int]:
    """Each indicator's own contribution to the score.

    `score_indicators` adds three independent blocks and every neutral input
    scores 0 in its block, so scoring one indicator at a time against neutral
    values isolates its points without restating a single threshold anywhere
    else. That additivity is also what lets `research`'s coalitions be built by
    plain summation — this lives here so both it and the live path get the
    numbers from the one scoring function.
    """

    def only(**overrides) -> int:
        return score_indicators(
            fear_greed=overrides.get("fear_greed", NEUTRAL_FNG),
            fng_classification="",
            rsi=overrides.get("rsi", NEUTRAL_RSI),
            current_price=current_price,
            ma_350=overrides.get("ma_350", current_price),
        ).score

    return {
        "fng": only(fear_greed=fear_greed),
        "rsi": only(rsi=rsi),
        "ma": only(ma_350=ma_350),
    }


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

    # 3. 350-day moving average - how far from its own year, not whether
    if ma_350 <= 0:
        ma_350 = current_price  # no data available -> neutral
    diff_pct = (current_price - ma_350) / ma_350 * 100 if ma_350 else 0.0
    if diff_pct < MA_FAR_BELOW_PCT:
        step, word = 3, "far below"
    elif diff_pct < MA_BELOW_PCT:
        step, word = 2, "well below"
    elif diff_pct < 0:
        step, word = 1, "just below"
    elif diff_pct > MA_FAR_ABOVE_PCT:
        step, word = -2, "far above"
    elif diff_pct > MA_ABOVE_PCT:
        step, word = -1, "well above"
    else:
        step, word = 0, "above"
    score += step
    factors.append(f"Price {word} {MA_DAYS}d MA ({diff_pct:+.1f}%, {step:+d})")

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
    current_price = market_data.get_current_price()

    candles = market_data.ensure_candles(session, days=MA_DAYS + 5)
    closes = [c.close for c in candles]
    rsi = indicators.calculate_rsi_wilder(closes[-RSI_LOOKBACK:], period=RSI_PERIOD)
    ma_350 = indicators.moving_average(closes[-MA_DAYS:])

    return score_indicators(
        fear_greed=fng["value"],
        fng_classification=fng["classification"],
        rsi=rsi,
        current_price=current_price,
        ma_350=ma_350,
    )

"""Kaufstrategie: Score aus Indikatoren -> Multiplikator auf den Basisbetrag.
Logik 1:1 aus legacy/main.py portiert."""
from dataclasses import dataclass, field

from sqlmodel import Session

from . import coinbase_client, indicators

# Schwellwerte (spaeter ggf. konfigurierbar)
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
    emoji: str = ""
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
            "emoji": self.emoji,
        }


def determine_purchase_strategy(score: int) -> dict:
    """Bestimmt Kaufstrategie basierend auf Score - der Bot kauft IMMER"""
    if score >= 5:
        return {"multiplier": 1.5, "signal": "STARKES KAUFSIGNAL", "emoji": "🚀", "color": 0x00FF00}
    if score >= 3:
        return {"multiplier": 1.25, "signal": "GUTES KAUFSIGNAL", "emoji": "✅", "color": 0x32CD32}
    if score >= 1:
        return {"multiplier": 1.0, "signal": "NORMALES KAUFSIGNAL", "emoji": "💰", "color": 0xFFA500}
    if score >= -1:
        return {"multiplier": 0.75, "signal": "SCHWACHES KAUFSIGNAL", "emoji": "⚠️", "color": 0xFF8C00}
    return {"multiplier": 0.5, "signal": "MINIMALKAUF", "emoji": "🔻", "color": 0xFF6347}


def analyze(session: Session) -> Analysis:
    """Berechnet Score und Multiplikator aus Live-Marktdaten."""
    score = 0
    factors: list[str] = []

    # 1. Fear & Greed Index
    fng = indicators.get_fear_and_greed()
    fear_level = fng["value"]
    if fear_level < FNG_STRONG_FEAR:
        score += 3
        factors.append(f"FNG={fear_level} ({fng['classification']}, +3)")
    elif fear_level < FNG_FEAR:
        score += 2
        factors.append(f"FNG={fear_level} ({fng['classification']}, +2)")
    elif fear_level < FNG_NEUTRAL:
        factors.append(f"FNG={fear_level} ({fng['classification']}, +0)")
    else:
        score -= 2
        factors.append(f"FNG={fear_level} ({fng['classification']}, -2)")

    # 2. Aktueller Preis
    current_price = coinbase_client.get_current_price()

    # 3. RSI aus Tages-Candles
    candles = coinbase_client.ensure_candles(session, days=MA_DAYS + 5)
    closes = [c.close for c in candles]
    rsi = indicators.calculate_rsi_wilder(closes[-(RSI_PERIOD + 7):], period=RSI_PERIOD)
    if rsi < RSI_OVERSOLD:
        score += 3
        factors.append(f"RSI={rsi:.1f} (Stark ueberverkauft, +3)")
    elif rsi < RSI_SLIGHTLY_OVERSOLD:
        score += 1
        factors.append(f"RSI={rsi:.1f} (Leicht ueberverkauft, +1)")
    elif rsi > RSI_OVERBOUGHT:
        score -= 2
        factors.append(f"RSI={rsi:.1f} (Ueberkauft, -2)")
    else:
        factors.append(f"RSI={rsi:.1f} (Neutral, +0)")

    # 4. 350-Tage Moving Average
    ma_350 = indicators.moving_average(closes[-MA_DAYS:])
    if ma_350 <= 0:
        ma_350 = current_price  # kein Datenmaterial -> neutral
    diff_pct = (current_price - ma_350) / ma_350 * 100
    if current_price < ma_350:
        score += 2
        factors.append(f"Preis < {MA_DAYS}d-MA ({diff_pct:.1f}%, +2)")
    else:
        factors.append(f"Preis > {MA_DAYS}d-MA (+{diff_pct:.1f}%, +0)")

    strategy = determine_purchase_strategy(score)
    return Analysis(
        score=score,
        factors=factors,
        current_price=current_price,
        fear_greed=fear_level,
        fng_classification=fng["classification"],
        rsi=rsi,
        ma_350=ma_350,
        multiplier=strategy["multiplier"],
        signal=strategy["signal"],
        emoji=strategy["emoji"],
        color=strategy["color"],
    )

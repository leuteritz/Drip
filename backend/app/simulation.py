"""Backtest simulation: replays the Drip strategy over historical candles.

Uses the same scoring as the live bot (`strategy.score_indicators`) with the
real historical Fear & Greed values, so the result is an honest what-if for the
user's current schedule/base-amount settings. Purchases happen weekly on the
configured weekday. Nothing is written to the database - this is a read-only
computation, so it never pollutes the real purchase history.

DCA baseline: the same base amount is invested at every purchase date (as if
the multiplier were always 1.0), matching the convention in `analytics.py`.
"""
import bisect
from datetime import date, timedelta

from sqlmodel import Session

from . import indicators, strategy
from .coinbase_client import ensure_candles
from .models import BotSettings


def backtest(session: Session, days: int, settings: BotSettings) -> dict:
    end = date.today()
    start = end - timedelta(days=days)

    # Fetch enough lookback that RSI-14 and the 350-day MA are valid even at the
    # very start of the window. ensure_candles caches, so this is cheap on reuse.
    candles = ensure_candles(session, days=days + strategy.MA_DAYS + 10)
    ordered = sorted(candles, key=lambda c: c.day)
    day_list = [c.day for c in ordered]
    closes = [c.close for c in ordered]

    fng_hist = indicators.get_fear_and_greed_history()

    weekday = settings.schedule_weekday
    base_amount = settings.base_amount_eur

    # Weekly purchases on the configured weekday within [start, end].
    trades: list[dict] = []
    d = start
    while d <= end:
        if d.weekday() == weekday:
            pos = bisect.bisect_right(day_list, d) - 1  # last candle on/before d
            if pos >= strategy.RSI_PERIOD:
                price = closes[pos]
                rsi_window = closes[max(0, pos - (strategy.RSI_PERIOD + 7) + 1): pos + 1]
                rsi = indicators.calculate_rsi_wilder(rsi_window, period=strategy.RSI_PERIOD)
                ma_350 = indicators.moving_average(
                    closes[max(0, pos - strategy.MA_DAYS + 1): pos + 1]
                )
                fng = fng_hist.get(d, 50)
                analysis = strategy.score_indicators(
                    fear_greed=fng,
                    fng_classification="",
                    rsi=rsi,
                    current_price=price,
                    ma_350=ma_350,
                )
                amount = round(base_amount * analysis.multiplier, 2)
                trades.append({
                    "day": d,
                    "amount": amount,
                    "btc": amount / price if price else 0.0,
                    "dca_amount": base_amount,
                    "dca_btc": base_amount / price if price else 0.0,
                })
        d += timedelta(days=1)

    # Daily portfolio-value series across the display window.
    series: list[dict] = []
    bot_btc = bot_invested = dca_btc = dca_invested = 0.0
    idx = 0
    window = [c for c in ordered if start - timedelta(days=1) <= c.day <= end]
    for candle in window:
        while idx < len(trades) and trades[idx]["day"] <= candle.day:
            t = trades[idx]
            bot_btc += t["btc"]
            bot_invested += t["amount"]
            dca_btc += t["dca_btc"]
            dca_invested += t["dca_amount"]
            idx += 1
        series.append({
            "date": candle.day.isoformat(),
            "price": candle.close,
            "bot_value": bot_btc * candle.close,
            "bot_invested": bot_invested,
            "dca_value": dca_btc * candle.close,
            "dca_invested": dca_invested,
        })

    current_price = closes[-1] if closes else 0.0
    bot_value = bot_btc * current_price
    dca_value = dca_btc * current_price

    return {
        "summary": {
            "days": days,
            "purchase_count": len(trades),
            "current_price": current_price,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "weekday": weekday,
            "base_amount_eur": base_amount,
            "bot": _side(bot_invested, bot_btc, bot_value),
            "dca": _side(dca_invested, dca_btc, dca_value),
        },
        "series": series,
    }


def _side(invested: float, btc: float, value: float) -> dict:
    return {
        "invested_eur": invested,
        "btc_total": btc,
        "value_eur": value,
        "profit_eur": value - invested,
        "profit_pct": ((value - invested) / invested * 100) if invested else 0.0,
    }

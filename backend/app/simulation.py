"""Backtest simulation: replays the Drip strategy over historical candles.

Uses the same scoring as the live bot (`strategy.score_indicators`) with the
real historical Fear & Greed values, so the result is an honest what-if for the
user's current schedule/base-amount settings. Purchases happen weekly on the
configured weekday. Nothing is written to the database - this is a read-only
computation, so it never pollutes the real purchase history.

DCA baseline: the same base amount is invested at every purchase date (as if
the multiplier were always 1.0), matching the convention in `analytics.py`.
The portfolio arithmetic is shared with it via `portfolio.py`.
"""
import bisect
from datetime import date, timedelta

from sqlmodel import Session

from . import indicators, strategy
from .market_data import ensure_candles
from .models import BotSettings
from .portfolio import InvestmentEvent, build_series, side_summary

NEUTRAL_FNG = 50  # used for dates the Fear & Greed history doesn't cover


def _purchase_days(start: date, end: date, weekday: int) -> list[date]:
    """Every `weekday` within [start, end] - the simulated buy schedule."""
    first = start + timedelta(days=(weekday - start.weekday()) % 7)
    days: list[date] = []
    day = first
    while day <= end:
        days.append(day)
        day += timedelta(days=7)
    return days


def _simulate_events(days: list[date], day_list: list[date], closes: list[float],
                     base_amount: float, fng_hist: dict[date, int]) -> list[InvestmentEvent]:
    """Scores each purchase day against the candles available up to that day."""
    events: list[InvestmentEvent] = []
    for day in days:
        pos = bisect.bisect_right(day_list, day) - 1  # last candle on/before day
        if pos < strategy.RSI_PERIOD:
            continue  # not enough history to score this date

        price = closes[pos]
        if not price:
            continue

        rsi_window = closes[max(0, pos - (strategy.RSI_PERIOD + 7) + 1): pos + 1]
        analysis = strategy.score_indicators(
            fear_greed=fng_hist.get(day, NEUTRAL_FNG),
            fng_classification="",
            rsi=indicators.calculate_rsi_wilder(rsi_window, period=strategy.RSI_PERIOD),
            current_price=price,
            ma_350=indicators.moving_average(
                closes[max(0, pos - strategy.MA_DAYS + 1): pos + 1]
            ),
        )
        amount = round(base_amount * analysis.multiplier, 2)
        events.append(InvestmentEvent(
            day=day,
            bot_eur=amount,
            bot_btc=amount / price,
            dca_eur=base_amount,
            dca_btc=base_amount / price,
        ))
    return events


def backtest(session: Session, days: int, settings: BotSettings) -> dict:
    end = date.today()
    start = end - timedelta(days=days)

    # Fetch enough lookback that RSI-14 and the 350-day MA are valid even at the
    # very start of the window. ensure_candles caches, so this is cheap on reuse.
    candles = sorted(ensure_candles(session, days=days + strategy.MA_DAYS + 10),
                     key=lambda c: c.day)
    day_list = [c.day for c in candles]
    closes = [c.close for c in candles]

    events = _simulate_events(
        _purchase_days(start, end, settings.schedule_weekday),
        day_list,
        closes,
        settings.base_amount_eur,
        indicators.get_fear_and_greed_history(),
    )

    window = [(c.day, c.close) for c in candles
              if start - timedelta(days=1) <= c.day <= end]
    series = build_series(window, events)

    current_price = closes[-1] if closes else 0.0
    return {
        "summary": {
            "days": days,
            "purchase_count": len(events),
            "current_price": current_price,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "weekday": settings.schedule_weekday,
            "base_amount_eur": settings.base_amount_eur,
            "bot": side_summary(
                sum(e.bot_eur for e in events),
                sum(e.bot_btc for e in events),
                current_price,
            ),
            "dca": side_summary(
                sum(e.dca_eur for e in events),
                sum(e.dca_btc for e in events),
                current_price,
            ),
        },
        "series": series,
    }

"""Backtest simulation: replays the Drip strategy over historical candles.

Uses the same scoring as the live bot (`strategy.score_indicators`) with the
real historical Fear & Greed values, so the result is an honest what-if for the
user's current settings. Nothing is written to the database - this is a
read-only computation, so it never pollutes the real purchase history.

Buys land on the days *this install actually buys on*, `cadence.py` deciding
which those are. It used to step a hard seven days whatever the setting said,
which was defended as "the backtest measures the scoring, not the calendar" —
and that is exactly half right. It justifies why a buy day is scored the same
way here as anywhere; it never justified showing a monthly saver a weekly
simulation and calling it their strategy. Both hold at once: the same scoring,
on the days the drip drips.

DCA baseline: the same base amount is invested at every purchase date (as if
the multiplier were always 1.0), matching the convention in `analytics.py`.
The portfolio arithmetic is shared with it via `portfolio.py`.
"""
import bisect
from datetime import date, timedelta

from sqlmodel import Session

from . import cadence, indicators, strategy
from .market_data import ensure_candles
from .models import BotSettings
from .portfolio import InvestmentEvent, build_series, side_summary

NEUTRAL_FNG = 50  # used for dates the Fear & Greed history doesn't cover


def _purchase_days(start: date, end: date, key: str, weekday: int) -> list[date]:
    """Every day inside [start, end] the drip would have landed on.

    Walked a period at a time through `cadence`, never by adding a fixed number
    of days: a month is not 30 of them, and the module that knows what a period
    is is the only one allowed to say. The first period is skipped when its own
    slot falls before the window - a buy that would have happened last month is
    not one this window gets to count.
    """
    days: list[date] = []
    period = cadence.period_start(start, key)
    while True:
        slot = cadence.slot_day(period, key, weekday)
        if slot > end:
            break
        if slot >= start:
            days.append(slot)
        period = cadence.advance(period, key)
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

        rsi_window = closes[max(0, pos - strategy.RSI_LOOKBACK + 1): pos + 1]
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

    drip = cadence.get(settings.cadence)
    events = _simulate_events(
        _purchase_days(start, end, drip.key, settings.schedule_weekday),
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
            # The rhythm that was replayed. It travels with the summary because
            # the dialog says which one out loud - a backtest that quietly ran a
            # different schedule than the install does is the one thing this
            # card must not do.
            "cadence": drip.key,
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

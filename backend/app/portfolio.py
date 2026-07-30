"""Shared portfolio math for the bot-vs-DCA comparison.

Both the live analytics (`analytics.py`, over real Purchase rows) and the
backtest (`simulation.py`, over simulated trades) need the same two things:
a per-side summary, and a daily value series. Keeping the arithmetic here means
the dashboard and the simulation can never drift apart in how they compute
profit or accumulate a portfolio over time.

DCA baseline convention: every event carries both the bot's actual spend and
the plain-DCA spend (the base amount, i.e. amount / multiplier). See
`analytics.py` for why manual buys are stored with multiplier=1.0.
"""
from dataclasses import dataclass
from datetime import date


@dataclass
class InvestmentEvent:
    """One buy, in both worlds: what the bot spent and what plain DCA would."""

    day: date
    bot_eur: float
    bot_btc: float
    dca_eur: float
    dca_btc: float


def side_summary(invested: float, btc: float, price: float) -> dict:
    """Value/profit block for one side of the comparison (bot or DCA)."""
    value = btc * price
    return {
        "invested_eur": invested,
        "btc_total": btc,
        "value_eur": value,
        "profit_eur": value - invested,
        "profit_pct": ((value - invested) / invested * 100) if invested else 0.0,
    }


def build_series(days_and_closes: list[tuple[date, float]],
                 events: list[InvestmentEvent]) -> list[dict]:
    """Daily portfolio value for both sides across the given days.

    `days_and_closes` must be ordered by day and `events` by `day`; each event
    is folded in on the first day that is on or after it, so a buy shows up in
    the series from its own day onward.
    """
    series: list[dict] = []
    idx = 0
    bot_btc = bot_invested = dca_btc = dca_invested = 0.0

    for day, close in days_and_closes:
        while idx < len(events) and events[idx].day <= day:
            event = events[idx]
            bot_btc += event.bot_btc
            bot_invested += event.bot_eur
            dca_btc += event.dca_btc
            dca_invested += event.dca_eur
            idx += 1

        series.append({
            "date": day.isoformat(),
            "price": close,
            "bot_value": bot_btc * close,
            "bot_invested": bot_invested,
            "dca_value": dca_btc * close,
            "dca_invested": dca_invested,
        })

    return series

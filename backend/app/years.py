"""What each calendar year bought, and what that year's money is worth now.

Every other figure in Drip is all-time or a rolling window: the cost basis is
over every buy, the P&L is since the first one, the research windows are the
last 365 or 1095 days. All of them are the right way to read a savings bot, and
between them they leave one question unanswerable — a saver five years in cannot
see 2022 at all. A drip is lived a year at a time (and, in Germany, taxed that
way), so the years are worth having their own arithmetic.

Read-only, and it invents nothing: the rows come from
`analytics.relevant_purchases` so this can never disagree with the P&L or the
stack view, the value/profit block is `portfolio.side_summary` rather than a
second definition of profit, and the yardstick is `holdings.twap` /
`holdings.advantage_pct` - the same comparison the cost-basis card makes about
the whole stack, asked about one year of it. No new API and no new failure mode:
one candle read, which the dashboard has already paid for.

Two honesty rules, and the first is the one this module could most easily get
wrong:

- **A year in progress is partial on both sides.** It has fewer buys *and* a
  market average over part of a year, so setting it beside a complete year with
  no warning would invite a comparison that is not one. Every cohort carries
  `complete` and `priced_days`, and the card says so.
- **Profit here is "what that year's buys are worth today", never an annual
  return.** A 2022 cohort has had four years to work and a 2026 one a few weeks;
  the figure is honest arithmetic about a cohort and would be a lie about a
  year's performance.

`btc_total` goes out as bitcoin rather than sats, so `lib/units.ts` decides
which the reader sees - `outlook.py` and `digest.py` already carry a
`SATS_PER_BTC` each and a third would be one too many.
"""
from collections import defaultdict
from datetime import date

from sqlmodel import Session

from . import analytics, holdings, portfolio
from .market_data import ensure_candles, get_current_price
from .models import Purchase


def _closes_by_year(session: Session, first_day: date) -> dict[int, list[float]]:
    """Every daily close since the first buy, bucketed by calendar year.

    One `ensure_candles` call sized the way `holdings._cost_basis` sizes its
    own, so a warm cache costs nothing and a cold one is the fetch the rest of
    the dashboard was going to make anyway.
    """
    needed = (date.today() - first_day).days + 2
    by_year: dict[int, list[float]] = defaultdict(list)
    for candle in ensure_candles(session, days=max(needed, 7)):
        if candle.day >= first_day and candle.close > 0:
            by_year[candle.day.year].append(candle.close)
    return by_year


def _cohort(
    year: int,
    rows: list[Purchase],
    closes: list[float],
    price: float,
    today: date,
) -> dict:
    invested = sum(p.amount_eur for p in rows)
    btc = sum(p.btc_amount for p in rows)
    prices = [p.price_eur for p in rows if p.price_eur > 0]
    avg_price = invested / btc if btc else 0.0
    market_twap = holdings.twap(closes)
    days = sorted(p.timestamp.date() for p in rows)

    # A year is complete when the calendar has left it behind *and* the candle
    # cache actually covered it. The second half matters on an install whose
    # history starts mid-year: 2021 there is a partial year however long ago it
    # ended, and reporting its part-year average as the year's would be wrong.
    complete = year < today.year and len(closes) >= 350

    return {
        "year": year,
        "buys": len(rows),
        **portfolio.side_summary(invested, btc, price),
        "avg_price_eur": avg_price,
        "best_price_eur": min(prices) if prices else 0.0,
        "worst_price_eur": max(prices) if prices else 0.0,
        "market_twap_eur": market_twap,
        "advantage_pct": holdings.advantage_pct(avg_price, market_twap),
        "first_buy": days[0].isoformat() if days else None,
        "last_buy": days[-1].isoformat() if days else None,
        "priced_days": len(closes),
        "complete": complete,
    }


def summary(session: Session, include_dry_run: bool = True) -> dict:
    """Every calendar year that saw a buy, oldest first."""
    price = get_current_price()
    purchases = analytics.relevant_purchases(session, include_dry_run)
    today = date.today()

    if not purchases:
        return {
            "as_of": today.isoformat(),
            "current_price": price,
            "include_dry_run": include_dry_run,
            "years": [],
        }

    by_year: dict[int, list[Purchase]] = defaultdict(list)
    for purchase in purchases:
        by_year[purchase.timestamp.year].append(purchase)

    closes = _closes_by_year(session, purchases[0].timestamp.date())

    return {
        "as_of": today.isoformat(),
        "current_price": price,
        "include_dry_run": include_dry_run,
        "years": [
            _cohort(year, rows, closes.get(year, []), price, today)
            for year, rows in sorted(by_year.items())
        ],
    }

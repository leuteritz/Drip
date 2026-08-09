"""How far under water the stack went, and what the drip bought down there.

Every other figure on this dashboard is an average over the buys that happened.
Averages are the right way to read a savings bot and they are exactly what hides
the only thing that ever makes somebody stop: the stretches where the stack was
worth less than the money put into it. A cost basis of €38,000 says nothing
about the eleven months it spent 60% down, and eleven months 60% down is what
DCA actually asks of a person.

So this module reports the water, not the average. Two questions, and the second
is the one worth having:

- **How deep, and for how long.** Every stretch the position spent below what it
  cost, measured off the same daily series the chart above the card plots.
- **What was bought while it was down there.** A drip that kept going through a
  drawdown bought its cheapest bitcoin exactly then, and no other card on the
  page can say so — the history knows what each buy cost and nothing about the
  weather it was made in.

Read-only, and it invents nothing. There is no new API and no new failure mode:
the series comes from `analytics.comparison_series`, which is the same call the
comparison chart already makes, so the card and the chart above it can never
disagree about which days were under water.

Three rules hold it together, and each is about not overstating the case:

- **A fee is not a drawdown.** A buy settles the position a fraction of a
  percent below its cost the moment it is made, so a strict reading of "below
  water" marks nearly every buy day. An episode is therefore only counted once
  it went deeper than `MIN_DEPTH_PCT`; everything shallower is the spread and
  the fee, not a market anyone sat through. Every figure here — the day count,
  the share, the buys — is measured over counted episodes alone, so the card
  cannot say "18% of days" while listing episodes that add up to less.
- **The curve is bucketed by its deepest point, never averaged.** Five years of
  daily depths do not fit in a card, and a mean would flatten the very trough
  the card exists to show. Each bucket reports the worst day in it, so the low
  water mark on the drawn curve is the real one.
- **Down there and up here are priced the same way.** Both halves of
  `bought_under` / `bought_above` are valued at today's price, so the comparison
  is fair arithmetic. It is still not a like-for-like verdict on timing — a buy
  from four years ago has had four years to work, whichever side it fell on —
  and the card says so rather than letting the better number stand as proof.
"""
from datetime import date

from sqlmodel import Session

from . import analytics
from .models import Purchase
from .outlook import SATS_PER_BTC

# How far below cost a stretch has to go before it counts as one. Below this is
# the fee and the spread: a buy is under water the second it settles, and an
# episode nobody could have noticed is not one anybody sat through.
MIN_DEPTH_PCT = 2.0

# Most points the drawn curve carries. A year of daily depths is already more
# marks than a card is wide; five years is ten times that. The same reasoning as
# `pulse.MAX_MARKS`, and the bucketing rule below is what keeps it honest.
CURVE_POINTS = 220


def _depth(point: dict) -> float:
    """How far below its own cost the position sat that day, in percent.

    Zero or positive means at or above water — the profit above the line is a
    different card's business, and reporting it here would make the curve about
    something else entirely.
    """
    invested = point.get("bot_invested") or 0.0
    if invested <= 0:
        return 0.0
    profit = (point.get("bot_value") or 0.0) - invested
    return min(profit / invested * 100, 0.0)


def _runs(days: list[tuple[str, float]]) -> list[tuple[int, int]]:
    """Index ranges of consecutive days spent below water, inclusive."""
    runs: list[tuple[int, int]] = []
    start: int | None = None
    for i, (_, depth) in enumerate(days):
        if depth < 0 and start is None:
            start = i
        elif depth >= 0 and start is not None:
            runs.append((start, i - 1))
            start = None
    if start is not None:
        runs.append((start, len(days) - 1))
    return runs


def _episode(days: list[tuple[str, float]], span: tuple[int, int],
             purchases: list[Purchase], ongoing: bool) -> dict:
    """One stretch under water, with what the drip put in while it lasted."""
    start, end = span
    window = days[start:end + 1]
    deepest = min(window, key=lambda d: d[1])
    first_day, last_day = window[0][0], window[-1][0]

    made = [
        p for p in purchases
        if first_day <= p.timestamp.date().isoformat() <= last_day
    ]
    return {
        "start": first_day,
        "end": last_day,
        "days": len(window),
        "depth_pct": deepest[1],
        "deepest_on": deepest[0],
        # An episode still running has not been recovered from, and the card
        # must not print a "back above water after N days" for it.
        "recovered": not ongoing,
        "buys": len(made),
        "eur": sum(p.amount_eur for p in made),
        "sats": sum(p.btc_amount for p in made) * SATS_PER_BTC,
    }


def _side(purchases: list[Purchase], price: float) -> dict:
    """What a set of buys cost and what it is worth now."""
    eur = sum(p.amount_eur for p in purchases)
    btc = sum(p.btc_amount for p in purchases)
    value = btc * price
    return {
        "buys": len(purchases),
        "eur": eur,
        "sats": btc * SATS_PER_BTC,
        "value_eur": value,
        "profit_pct": ((value - eur) / eur * 100) if eur > 0 else 0.0,
        "avg_price_eur": (eur / btc) if btc > 0 else 0.0,
    }


def _curve(days: list[tuple[str, float]]) -> list[dict]:
    """The depth series, bucketed down to something a card can draw.

    Each bucket reports its **deepest** day rather than its average: the trough
    is the whole point of the picture, and a mean would file it down to nothing
    on a long history. The date carried is the date of that deepest day, so a
    tooltip names the day it is actually showing.
    """
    if len(days) <= CURVE_POINTS:
        return [{"date": day, "depth_pct": depth} for day, depth in days]

    size = len(days) / CURVE_POINTS
    out: list[dict] = []
    for i in range(CURVE_POINTS):
        chunk = days[int(i * size):max(int((i + 1) * size), int(i * size) + 1)]
        day, depth = min(chunk, key=lambda d: d[1])
        out.append({"date": day, "depth_pct": depth})
    return out


def summary(session: Session, include_dry_run: bool = True) -> dict:
    """The whole card in one call.

    `available` is false while there is not enough series to say anything, which
    is a different state from "never went under" — a fresh install has no
    answer, a lucky one has a good answer, and the card says the right one.
    """
    series = analytics.comparison_series(session, include_dry_run)
    days = [(p["date"], _depth(p)) for p in series if (p.get("bot_invested") or 0) > 0]
    today = date.today().isoformat()

    if len(days) < 2:
        return {
            "as_of": today,
            "include_dry_run": include_dry_run,
            "available": False,
            "threshold_pct": MIN_DEPTH_PCT,
        }

    purchases = analytics.relevant_purchases(session, include_dry_run)
    price = series[-1]["price"] if series else 0.0

    # Only stretches that got deeper than the threshold. Everything downstream
    # is measured over these alone, so no figure on the card describes a set of
    # days the episode list does not contain.
    counted = [
        span for span in _runs(days)
        if min(d for _, d in days[span[0]:span[1] + 1]) <= -MIN_DEPTH_PCT
    ]
    last_index = len(days) - 1
    episodes = [
        _episode(days, span, purchases, ongoing=span[1] == last_index)
        for span in counted
    ]

    under_days = {
        days[i][0]
        for start, end in counted
        for i in range(start, end + 1)
    }
    below = [p for p in purchases if p.timestamp.date().isoformat() in under_days]
    above = [p for p in purchases if p.timestamp.date().isoformat() not in under_days]

    current = episodes[-1] if episodes and not episodes[-1]["recovered"] else None
    deepest = min(episodes, key=lambda e: e["depth_pct"]) if episodes else None
    longest = max(episodes, key=lambda e: e["days"]) if episodes else None

    return {
        "as_of": today,
        "include_dry_run": include_dry_run,
        "available": True,
        "threshold_pct": MIN_DEPTH_PCT,
        "current_price": price,
        "days": len(days),
        "days_under": len(under_days),
        "under_pct": len(under_days) / len(days) * 100,
        "episodes": len(episodes),
        "depth_now_pct": days[-1][1],
        # The stretch still running, or nothing at all — never the last one that
        # ended, which would read as though the stack were under water today.
        "current": current,
        "deepest": deepest,
        "longest": longest,
        "recent": episodes[-3:][::-1],
        "bought_under": _side(below, price),
        "bought_above": _side(above, price),
        "curve": _curve(days),
    }

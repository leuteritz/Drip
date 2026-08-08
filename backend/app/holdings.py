"""What the stack actually is: cost basis against the market, and holding ages.

Two questions the profit numbers cannot answer.

*Cost basis* asks whether the buying was any good, which is not the same as
whether the price went up. The yardstick is the market's own time-weighted
average price over the same stretch: a buyer who simply spread the same money
evenly across every day would have paid that, so beating it is the actual
measure of a well-timed drip, and it stays meaningful in a market that fell.

That average is euros over bitcoin, so it is what a coin cost *after* the
exchange took its cut — the fee never became bitcoin, and it therefore sits in
the gap between this average and the market's own. Right, but invisible, so the
fee is reported beside it rather than left as an unexplained shortfall. Only
buys that reported a fill know what they were charged, which is what
`fees_from` counts.

*Holding ages* is the German one-year rule (§23 EStG): bitcoin held longer than
a year leaves the private-sale window. Drip only ever buys, so there is nothing
to match sells against and every purchase is simply its own lot — FIFO and any
other lot method agree here, and will keep agreeing until a sell exists.

Read-only, and deliberately not a tax calculation: it reports what is held and
how old it is, and leaves the rest to the person who has to file it.
"""
from collections import OrderedDict
from datetime import date

from sqlmodel import Session, select

from . import analytics
from .constants import ORDER_ID_ERROR
from .market_data import ensure_candles, get_current_price
from .models import Purchase

TIMELINE_MONTHS = 12  # how far ahead the ripening timeline looks


def plus_one_year(day: date) -> date:
    """The day the one-year holding period is over.

    29 February has no anniversary in a common year; rolling it to 1 March is
    the conservative direction - it never claims a lot is free too early.

    Public because `receipt.py` ages a single buy with it: the one-year rule is
    a statement about the calendar and there may only be one of it here.
    """
    try:
        return day.replace(year=day.year + 1)
    except ValueError:
        return day.replace(year=day.year + 1, month=3, day=1)


def _bucket(lots: list[dict]) -> dict:
    cost = sum(lot["cost_eur"] for lot in lots)
    value = sum(lot["value_eur"] for lot in lots)
    return {
        "lots": len(lots),
        "btc": sum(lot["btc"] for lot in lots),
        "cost_eur": cost,
        "value_eur": value,
        "gain_eur": value - cost,
    }


def _cost_basis(session: Session, purchases: list[Purchase], price: float) -> dict:
    """Average entry price against the market's own average over the same days."""
    invested = sum(p.amount_eur for p in purchases)
    btc = sum(p.btc_amount for p in purchases)
    prices = [p.price_eur for p in purchases if p.price_eur > 0]
    avg_price = invested / btc if btc else 0.0

    # Only a buy that reported its fill knows what it was charged, so the sum
    # is over those alone and the count says how many that was. A history from
    # before Drip read fills back has none, and reporting 0 as a total there
    # would be an invented number rather than a missing one.
    charged = [p for p in purchases if p.filled]
    fees = sum(p.fee_eur for p in charged)
    charged_eur = sum(p.amount_eur for p in charged)

    twap = 0.0
    first_day = purchases[0].timestamp.date() if purchases else None
    if first_day:
        needed = (date.today() - first_day).days + 2
        closes = [
            c.close
            for c in ensure_candles(session, days=max(needed, 7))
            if c.day >= first_day and c.close > 0
        ]
        twap = sum(closes) / len(closes) if closes else 0.0

    return {
        "purchase_count": len(purchases),
        "btc_total": btc,
        "invested_eur": invested,
        "avg_price_eur": avg_price,
        "market_twap_eur": twap,
        # Positive means the average euro went in below the market's average -
        # the only sense in which a drip can be said to have bought well.
        "advantage_pct": ((twap - avg_price) / twap * 100) if twap and avg_price else 0.0,
        "fees_eur": fees,
        "fees_pct": (fees / charged_eur * 100) if charged_eur else 0.0,
        "fees_from": len(charged),
        "best_price_eur": min(prices) if prices else 0.0,
        "worst_price_eur": max(prices) if prices else 0.0,
        "first_buy": first_day.isoformat() if first_day else None,
        "days": (date.today() - first_day).days if first_day else 0,
    }


def _excluded(session: Session) -> dict:
    """Buys recorded as failures, which every other figure leaves out.

    Reported rather than hidden: a legacy import can carry a long run of these,
    and a stack view that quietly dropped them would understate the holding by
    however much they are worth.
    """
    rows = list(session.exec(
        select(Purchase).where(Purchase.order_id == ORDER_ID_ERROR)
    ).all())
    return {
        "count": len(rows),
        "btc": sum(r.btc_amount for r in rows),
        "eur": sum(r.amount_eur for r in rows),
    }


def summary(session: Session, include_dry_run: bool = True) -> dict:
    """Cost basis (honours the dry-run filter) plus holding ages (never does).

    The holding view counts real buys only, whatever the filter says: a test
    run is not bitcoin and cannot ripen.
    """
    price = get_current_price()
    counted = analytics.relevant_purchases(session, include_dry_run)
    real = analytics.relevant_purchases(session, include_dry_run=False)

    today = date.today()
    free_lots: list[dict] = []
    locked_lots: list[dict] = []
    for purchase in real:
        acquired = purchase.timestamp.date()
        free_at = plus_one_year(acquired)
        lot = {
            "acquired": acquired.isoformat(),
            "free_at": free_at.isoformat(),
            "days_left": max((free_at - today).days, 0),
            "btc": purchase.btc_amount,
            "cost_eur": purchase.amount_eur,
            "value_eur": purchase.btc_amount * price,
        }
        (free_lots if free_at <= today else locked_lots).append(lot)

    # Locked lots grouped by the month they come free, oldest first.
    months: "OrderedDict[str, list[dict]]" = OrderedDict()
    for lot in sorted(locked_lots, key=lambda l: l["free_at"]):
        months.setdefault(lot["free_at"][:7], []).append(lot)
    timeline = [
        {"month": month, **_bucket(lots)}
        for month, lots in list(months.items())[:TIMELINE_MONTHS]
    ]

    next_free = min((lot["free_at"] for lot in locked_lots), default=None)
    return {
        "as_of": today.isoformat(),
        "current_price": price,
        "include_dry_run": include_dry_run,
        "cost_basis": _cost_basis(session, counted, price),
        "free": _bucket(free_lots),
        "locked": _bucket(locked_lots),
        "next_free_date": next_free,
        "next_free_in_days": (
            max((date.fromisoformat(next_free) - today).days, 0) if next_free else 0
        ),
        "timeline": timeline,
        "excluded": _excluded(session),
    }

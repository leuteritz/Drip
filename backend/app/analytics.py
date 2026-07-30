"""Performance analytics: P&L plus bot strategy vs. plain DCA comparison.

DCA baseline: at each purchase event the base amount (amount / multiplier)
is invested at the same price - so the only difference from the bot
strategy is the score multiplier. The arithmetic itself lives in
`portfolio.py`, shared with the backtest.
"""
from datetime import date, timedelta

from sqlmodel import Session, select

from .constants import ORDER_ID_ERROR
from .market_data import ensure_candles, get_current_price
from .models import Purchase
from .portfolio import InvestmentEvent, build_series, side_summary


def _relevant_purchases(session: Session, include_dry_run: bool) -> list[Purchase]:
    stmt = select(Purchase).where(Purchase.order_id != ORDER_ID_ERROR).order_by(Purchase.timestamp)
    purchases = list(session.exec(stmt).all())
    if not include_dry_run:
        purchases = [p for p in purchases if not p.dry_run]
    return purchases


def _as_events(purchases: list[Purchase]) -> list[InvestmentEvent]:
    """Turns stored purchases into bot/DCA event pairs.

    A purchase with multiplier=0 would be meaningless, so it falls back to the
    bot's own spend rather than dividing by zero.
    """
    events: list[InvestmentEvent] = []
    for p in purchases:
        base = p.amount_eur / p.multiplier if p.multiplier else p.amount_eur
        events.append(InvestmentEvent(
            day=p.timestamp.date(),
            bot_eur=p.amount_eur,
            bot_btc=p.btc_amount,
            dca_eur=base,
            dca_btc=base / p.price_eur if p.price_eur else 0.0,
        ))
    return events


def performance_summary(session: Session, include_dry_run: bool = True) -> dict:
    purchases = _relevant_purchases(session, include_dry_run)
    current_price = get_current_price()
    events = _as_events(purchases)

    bot = side_summary(
        invested=sum(e.bot_eur for e in events),
        btc=sum(e.bot_btc for e in events),
        price=current_price,
    )
    dca = side_summary(
        invested=sum(e.dca_eur for e in events),
        btc=sum(e.dca_btc for e in events),
        price=current_price,
    )

    return {
        "current_price": current_price,
        "purchase_count": len(purchases),
        **bot,
        "dca": dca,
        "include_dry_run": include_dry_run,
    }


def comparison_series(session: Session, include_dry_run: bool = True) -> list[dict]:
    """Daily time series: bot vs. plain DCA portfolio value since the first buy."""
    purchases = _relevant_purchases(session, include_dry_run)
    if not purchases:
        return []

    first_day = purchases[0].timestamp.date()
    days_needed = (date.today() - first_day).days + 2
    candles = ensure_candles(session, days=max(days_needed, 7))
    window = [c for c in candles if c.day >= first_day - timedelta(days=1)]

    return build_series(
        [(c.day, c.close) for c in window],
        _as_events(purchases),
    )

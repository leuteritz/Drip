"""Performance analytics: P&L plus bot strategy vs. plain DCA comparison.

DCA baseline: at each purchase event the base amount (amount / multiplier)
is invested at the same price - so the only difference from the bot
strategy is the score multiplier.
"""
from datetime import date, timedelta

from sqlmodel import Session, select

from .coinbase_client import ensure_candles, get_current_price
from .models import Purchase


def _relevant_purchases(session: Session, include_dry_run: bool) -> list[Purchase]:
    stmt = select(Purchase).where(Purchase.order_id != "ERROR").order_by(Purchase.timestamp)
    purchases = list(session.exec(stmt).all())
    if not include_dry_run:
        purchases = [p for p in purchases if not p.dry_run]
    return purchases


def performance_summary(session: Session, include_dry_run: bool = True) -> dict:
    purchases = _relevant_purchases(session, include_dry_run)
    current_price = get_current_price()

    invested = sum(p.amount_eur for p in purchases)
    btc = sum(p.btc_amount for p in purchases)
    value = btc * current_price

    dca_invested = sum(p.amount_eur / p.multiplier for p in purchases if p.multiplier)
    dca_btc = sum(
        (p.amount_eur / p.multiplier) / p.price_eur for p in purchases if p.multiplier
    )
    dca_value = dca_btc * current_price

    return {
        "current_price": current_price,
        "purchase_count": len(purchases),
        "invested_eur": invested,
        "btc_total": btc,
        "value_eur": value,
        "profit_eur": value - invested,
        "profit_pct": ((value - invested) / invested * 100) if invested else 0.0,
        "dca": {
            "invested_eur": dca_invested,
            "btc_total": dca_btc,
            "value_eur": dca_value,
            "profit_eur": dca_value - dca_invested,
            "profit_pct": ((dca_value - dca_invested) / dca_invested * 100)
            if dca_invested
            else 0.0,
        },
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
    candles = [c for c in candles if c.day >= first_day - timedelta(days=1)]

    series: list[dict] = []
    idx = 0
    bot_btc = bot_invested = dca_btc = dca_invested = 0.0

    for candle in candles:
        while idx < len(purchases) and purchases[idx].timestamp.date() <= candle.day:
            p = purchases[idx]
            bot_btc += p.btc_amount
            bot_invested += p.amount_eur
            base = p.amount_eur / p.multiplier if p.multiplier else p.amount_eur
            dca_btc += base / p.price_eur
            dca_invested += base
            idx += 1

        series.append({
            "date": candle.day.isoformat(),
            "price": candle.close,
            "bot_value": bot_btc * candle.close,
            "bot_invested": bot_invested,
            "dca_value": dca_btc * candle.close,
            "dca_invested": dca_invested,
        })

    return series

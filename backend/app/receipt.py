"""What became of one buy.

Every other figure on this dashboard is an average over the buys: the cost
basis, the P&L, the edge against plain DCA, the weeks the drip landed in. That
is the right way to read a savings bot, and it leaves one thing unreadable —
the single row. The history can say what a buy cost and nothing about what came
of it, and the three indicator readings sitting in that row never say how they
became the multiplier beside them. The live hero explains this week's buy that
way (`SignalBreakdown`, reading `strategy.indicator_points`); a buy from two
years ago has never been able to explain itself at all.

So: one buy, answered on its own terms. Read-only, and it invents nothing —
every figure here is either stored on the row, arithmetic over rows that are, or
read out of the candle cache the rest of the dashboard already fills.

Three rules hold it together:

- **The multiplier's share is measured on the fill, not re-derived from the
  price.** A buy at 1.5x put a third of its euros in *because of the score*, so
  a third of the bitcoin it actually received is the multiplier's; dividing the
  extra euros by the day's price would quietly hand the fee to plain DCA and
  make every 1.5x week look better than it was. The share is
  `(multiplier - 1) / multiplier`, which is exactly the split
  `analytics._as_events` makes when it derives the DCA baseline, and it comes
  out negative below 1.0x — a week the score held money back is a week that
  bought less of a rise, and this is where that is said out loud.
- **The points are recomputed, and the recount is reported when it disagrees.**
  `strategy.indicator_points` scores the stored readings the way today's
  `score_indicators` would, which is not necessarily what was recorded: an
  imported legacy row carries somebody else's score, and a threshold changed
  since the buy would score it differently now. The stored `score` stays the
  row's own truth and `points_total` sits beside it; when the two differ the
  frontend says so rather than showing arithmetic that does not add up.
- **A test run is not bitcoin.** Its outcome is what it *would* have been worth
  and is labelled as such; it gets no rank among the real buys and no holding
  age, for the same reason `holdings` never ages one.
"""
from datetime import date

from sqlmodel import Session

from . import strategy
from .constants import ORDER_ID_ERROR
from .holdings import plus_one_year
from .market_data import ensure_candles, get_current_price
from .models import Purchase

# How far either side of a buy the market average is taken. A month is long
# enough to say something about the price and short enough that the answer is
# about this buy rather than about the year it happened in.
WINDOW_DAYS = 15


def _outcome(purchase: Purchase, price: float) -> dict:
    """What the buy is worth now, and how much of that the score is answerable
    for.

    `real` is the only thing here that decides how it may be read: a dry run
    and a failed order both produce numbers, and neither produced bitcoin.
    """
    value_eur = purchase.btc_amount * price
    gain_eur = value_eur - purchase.amount_eur

    # The multiplier's own share of the buy — of the euros and of the bitcoin
    # alike, so the fee is split with it rather than being handed to one side.
    # 1.0x is exactly zero; 0.5x is -1, which is the whole point: the score can
    # cost as well as earn.
    share = (purchase.multiplier - 1) / purchase.multiplier if purchase.multiplier else 0.0
    extra_eur = purchase.amount_eur * share
    extra_btc = purchase.btc_amount * share

    return {
        "current_price": price,
        "value_eur": value_eur,
        "gain_eur": gain_eur,
        "gain_pct": (gain_eur / purchase.amount_eur * 100) if purchase.amount_eur else 0.0,
        "base_eur": purchase.amount_eur - extra_eur,
        "extra_eur": extra_eur,
        "extra_btc": extra_btc,
        # What the multiplier is answerable for, in euros: the bitcoin it added
        # (or withheld), valued now, against the euros it spent (or kept).
        "multiplier_eur": extra_btc * price - extra_eur,
    }


def _standing(session: Session, purchase: Purchase) -> dict | None:
    """Whether the buy caught a good price — measured against the days around it.

    The obvious yardstick is the wrong one. Ranking this price among every price
    in the history, or holding it against the stack's own cost basis, mostly
    measures *when* the buy happened: over five years of a rising market every
    recent buy is "above average" and every early one below, whatever the timing
    was worth. A history sorted by price is very nearly a history sorted by date.

    So the comparison is local. `holdings` measures the whole stack against the
    market's own time-weighted average over the same stretch; this is that
    sentence about one buy — its price against the average close of the days
    either side of it. Positive means it went in below what that month cost, and
    that is a statement about the buying rather than about the calendar.

    `days_covered` is how much of the window actually had prices: a buy from
    this week has no days after it, and the figure says so rather than quietly
    comparing a fortnight to a month.
    """
    if purchase.price_eur <= 0:
        return None

    day = purchase.timestamp.date()
    needed = (date.today() - day).days + WINDOW_DAYS + 2
    closes = [
        c.close
        for c in ensure_candles(session, days=max(needed, WINDOW_DAYS * 2 + 10))
        if abs((c.day - day).days) <= WINDOW_DAYS and c.close > 0
    ]
    if not closes:
        return None

    avg = sum(closes) / len(closes)
    return {
        "window_days": WINDOW_DAYS * 2 + 1,
        "days_covered": len(closes),
        "market_avg_eur": avg,
        "vs_market_pct": (avg - purchase.price_eur) / avg * 100,
    }


def build(session: Session, purchase: Purchase) -> dict:
    """The whole receipt for one row, in one call."""
    price = get_current_price()
    failed = purchase.order_id == ORDER_ID_ERROR
    real = not purchase.dry_run and not failed

    points = strategy.indicator_points(
        purchase.fear_greed, purchase.rsi, purchase.price_eur, purchase.ma_350
    )
    # Scored the way today's thresholds would score it. `purchase.score` is what
    # the row itself recorded, and an imported history is full of rows the two
    # readings disagree about.
    recount = sum(points.values())

    standing = None
    free_at = None
    days_left = 0
    if real:
        standing = _standing(session, purchase)
        ripe = plus_one_year(purchase.timestamp.date())
        free_at = ripe.isoformat()
        days_left = max((ripe - date.today()).days, 0)

    return {
        "id": purchase.id,
        "timestamp": purchase.timestamp.isoformat(),
        "origin": purchase.origin,
        "status": purchase.status,
        "order_id": purchase.order_id,
        "dry_run": purchase.dry_run,
        "failed": failed,
        "real": real,
        "filled": purchase.filled,
        "amount_eur": purchase.amount_eur,
        "btc_amount": purchase.btc_amount,
        "price_eur": purchase.price_eur,
        "fee_eur": purchase.fee_eur,
        "scoring": {
            "score": purchase.score,
            "score_max": strategy.SCORE_MAX,
            "points": points,
            "points_total": recount,
            "multiplier": purchase.multiplier,
            "signal": strategy.determine_purchase_strategy(purchase.score)["signal"],
            "fear_greed": purchase.fear_greed,
            "rsi": purchase.rsi,
            "ma_350": purchase.ma_350,
            "ma_distance_pct": (
                (purchase.price_eur - purchase.ma_350) / purchase.ma_350 * 100
            )
            if purchase.ma_350
            else 0.0,
        },
        "outcome": _outcome(purchase, price),
        "standing": standing,
        "free_at": free_at,
        "free_in_days": days_left,
    }

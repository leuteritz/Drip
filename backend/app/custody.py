"""Where the stack actually is: bitcoin that was bought and never moved off.

Every other module here is about how the saving is going. This one is about
where the result of it sits, and it exists because the dashboard could report a
six-figure stack without ever mentioning that all of it is on somebody else's
exchange. A bot that buys unattended for five years otherwise never raises the
one subject a bitcoin saver is eventually supposed to act on.

It is `well.py` pointed at the other end of a buy. The well is the money that
has not been spent yet, read as a runway; this is the money that has, read as a
question about custody. Both are about the exchange rather than the database,
and both are therefore held to the same discipline.

Four rules:

- **It never raises**, for `well.py`'s reason: it is read by a dashboard and by
  the weekly report, and a check that fell over would turn "I could not tell"
  into an error nobody asked for. No keys, a refused request, an unexpected
  shape, a price feed that would not answer — every one comes back as a standing
  of `unknown`, which is a thing the caller can say out loud.
- **The exchange is the truth about custody; the database is the truth about
  buying.** Confusing the two is the one mistake this module must not make. What
  Drip bought is a fact it owns and can always state; whether that bitcoin is
  still there is a fact only Coinbase has, so an install with no keys reports
  what it bought and says nothing at all about where it is. Claiming the whole
  stack sits on the exchange on the strength of the purchase history would be
  worse than staying quiet — it would be a warning about a risk somebody may
  have retired years ago.
- **It never guesses which buys were moved.** A balance smaller than the history
  says a part of the stack has left; it does not say which lots, and lots are
  not what a withdrawal is made of anyway. The difference is reported as a
  difference and nothing is matched against it — the same reason `holdings.py`
  does not do FIFO until a sell exists.
- **It reports, it never acts.** Drip cannot move bitcoin: an Advanced Trade key
  buys, and withdrawing is behind Coinbase's own login by design. So the answer
  here is a sentence and never a button, and the one link in sight belongs to
  the frontend's `lib/coinbase.ts`.
"""
import logging
from datetime import date

from sqlmodel import Session

from . import analytics, credentials
from .constants import (
    CUSTODY_HELD,
    CUSTODY_MOVED,
    CUSTODY_PARTLY,
    CUSTODY_UNKNOWN,
)
from .market_data import get_current_price
from .trading import CoinbaseError, get_balances_cached

logger = logging.getLogger(__name__)

# How far the balance may sit from the purchase history and still count as the
# whole stack being there. Buying and holding is not exact to the satoshi — a
# fill rounds, a legacy import carries somebody else's arithmetic — and a card
# announcing that 0.4% of the stack has been moved would be reporting noise as
# an event.
HELD_SHARE = 0.98
# Below this, what is left on the exchange is a remainder rather than a holding:
# the stack has been taken off, and whatever is sitting there is change.
MOVED_SHARE = 0.02


def standing(bought_btc: float, on_exchange_btc: float) -> str:
    """Which of the three things the two figures say, or `unknown`.

    A balance *larger* than the history is not a fourth state: it means bitcoin
    from somewhere else shares the account, and everything Drip bought is still
    on it — which is exactly `held`. The extra is reported as the difference it
    is and never explained, since Drip has no idea where it came from.
    """
    if bought_btc <= 0:
        return CUSTODY_UNKNOWN
    share = on_exchange_btc / bought_btc
    if share >= HELD_SHARE:
        return CUSTODY_HELD
    if share <= MOVED_SHARE:
        return CUSTODY_MOVED
    return CUSTODY_PARTLY


def summary(
    session: Session,
    threshold_eur: float,
    price: float | None = None,
) -> dict:
    """What Drip bought, how much of it is still on the exchange, and its value.

    `threshold_eur` is the point at which this stops being information and
    starts being a nudge — `BotSettings.custody_threshold_eur`, and 0 switches
    the nudge off without hiding the figures. `price` is handed in by callers
    that have already fetched it, so the report does not price the market twice.

    `available` is whether a balance was actually read; `btc_on_exchange`,
    `value_eur`, `difference_btc` and `over` are only meaningful when it is
    true. `configured` separates the two reasons it might not have been, the
    same split `well.runway` makes: an install with no keys has nothing to say
    about custody, while one with keys has an answer it could not fetch.
    """
    # What was bought is ours and is always known, so it is stated whatever the
    # exchange says. Real buys only, whatever the dashboard's dry-run filter is
    # set to — a test run is not bitcoin and cannot be in anyone's custody.
    purchases = analytics.relevant_purchases(session, include_dry_run=False)
    bought_btc = sum(p.btc_amount for p in purchases)
    first_day = purchases[0].timestamp.date() if purchases else None

    report = {
        "bought_btc": bought_btc,
        "since": first_day.isoformat() if first_day else None,
        "days": (date.today() - first_day).days if first_day else 0,
        "threshold_eur": threshold_eur,
        "configured": False,
        "available": False,
        "standing": CUSTODY_UNKNOWN,
        "btc_on_exchange": None,
        "difference_btc": None,
        "value_eur": None,
        "current_price": None,
        "over": False,
    }

    # Whether there is an exchange account to ask about, asked in its own try —
    # `well.py`'s rule. A failure here means we do not know that there are keys,
    # and reporting a custody fault on the strength of an unanswered question
    # would invent the very thing it describes.
    try:
        if not credentials.current().has_coinbase:
            return report
    except Exception:
        logger.exception("Custody could not resolve credentials")
        return report

    report["configured"] = True

    try:
        on_exchange = get_balances_cached()["btc_available"]
        current = price if price and price > 0 else get_current_price()
    except CoinbaseError as exc:
        logger.warning("Custody unavailable: %s", exc)
        return report
    except Exception:  # never raises - see the module docstring
        logger.exception("Custody failed")
        return report

    value = on_exchange * current
    return {
        **report,
        "available": True,
        "standing": standing(bought_btc, on_exchange),
        "btc_on_exchange": on_exchange,
        # Positive means the account holds more than Drip ever bought, which is
        # somebody else's bitcoin sharing it rather than anything Drip did.
        "difference_btc": on_exchange - bought_btc,
        "value_eur": value,
        "current_price": current,
        # Measured on what is actually sitting there, not on what was bought:
        # a stack already moved into self-custody has nothing left to nudge
        # about, and this is what makes that fall out rather than be handled.
        "over": threshold_eur > 0 and value >= threshold_eur,
    }

"""What is left to buy with: the euros on the exchange, read as buys.

Every other module here is about money that has already been spent. This one is
about the money that has not, and it exists because the dashboard could see the
well running dry while Drip itself could not say so. A bot that buys unattended
once a week otherwise finds out about an empty account the way it finds out
about anything else the exchange refuses — a failed order, and a week not
bought.

The runway is therefore measured in the only unit that answers the question:
how many more buys the balance covers, at the size the next one will be. And it
is said twice, deliberately differently. The weekly report carries the figure
whether or not it is comfortable, because that report is where the state of the
drip is read. The buy message carries it **only once it is low** — a line on
every purchase stating a healthy balance is a line nobody is still reading by
the time it matters.

Three rules hold it together:

- **It never raises.** It is read straight after an order has been placed, where
  the rule from `trading.read_fill` applies with full force: the money is
  already spent, and nothing here may turn a completed purchase into an error
  row. No keys, a refused request, an unexpected response — every one of them
  comes back as a runway that is simply not known, which is a thing the caller
  can say out loud.
- **`LOW_BUYS` is defined here and nowhere else.** The header's well chip used
  to carry its own copy, kept in step by a comment; it now reads the number off
  `/api/account/balance`, which carries it on every answer. The arithmetic is
  still whole buys with the remainder dropped on both sides, because that is the
  other half of the agreement. The chip on the water turning rose and Discord
  calling the well low are one statement, and they would be worth nothing if
  they disagreed about when it is true.
- **It reports, it never acts.** Nothing here skips, resizes or defers a buy;
  the exchange is still what decides whether an order can be paid for. This only
  makes sure the answer arrives before the order does.
"""
import logging

from .trading import CoinbaseError, get_balances_cached
from . import credentials

logger = logging.getLogger(__name__)

# How many buys' worth of euros still counts as running dry. The one definition:
# `routers/account.py` serves it to the header's chip. See the module docstring.
LOW_BUYS = 2


def runway(next_amount_eur: float) -> dict:
    """How far the balance on the exchange goes, in buys of `next_amount_eur`.

    `available` is whether a figure was actually read; everything else is only
    meaningful when it is true. `configured` separates the two reasons it might
    not have been: an install with no keys has no well to report, while one with
    keys has a well whose figure could not be fetched — a different fault, and
    the only one worth mentioning in a message.
    """
    unknown = {
        "configured": False,
        "available": False,
        "eur_available": None,
        "next_amount_eur": next_amount_eur,
        "buys_left": None,
        "low": False,
    }

    # Whether there is a well at all, asked separately from what is in it: a
    # failure here means we do not know that there are keys, and an install with
    # none has nothing to report. Saying "balance unavailable" on the strength of
    # a question that was never answered would invent the fault it describes.
    try:
        if not credentials.current().has_coinbase:
            return unknown
    except Exception:
        logger.exception("Well runway could not resolve credentials")
        return unknown

    try:
        if next_amount_eur <= 0:
            # Nothing to divide by: a well is only a runway once there is a buy
            # for it to feed. Reported as unknown rather than as endless.
            return {**unknown, "configured": True}
        eur = get_balances_cached()["eur_available"]
    except CoinbaseError as exc:
        logger.warning("Well runway unavailable: %s", exc)
        return {**unknown, "configured": True}
    except Exception:  # never raises - see the module docstring
        logger.exception("Well runway failed")
        return {**unknown, "configured": True}

    buys_left = int(eur // next_amount_eur)
    return {
        "configured": True,
        "available": True,
        "eur_available": eur,
        "next_amount_eur": next_amount_eur,
        "buys_left": buys_left,
        "low": buys_left <= LOW_BUYS,
    }

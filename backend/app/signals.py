"""Indicator candidates that are not in the score — yet, and maybe never.

Everything here comes out of the candle cache alone: no new API, no new failure
mode, nothing that could ever stop the bot from buying. That is the entry price
for being considered at all, given `market_data.py` is what keeps Drip working
without credentials.

None of this is wired into `strategy.py` and none of it may be until the
research section says it earns its place. Two of these are ordinary derived
prices; the third is a calendar, and is included precisely so it can be seen
failing.
"""
from datetime import date

# Bitcoin's block-subsidy halvings. The next is expected in 2028; until it
# arrives, the last entry is what `days_since_halving` counts from.
HALVINGS = [
    date(2012, 11, 28),
    date(2016, 7, 9),
    date(2020, 5, 11),
    date(2024, 4, 20),
]
CYCLE_DAYS = 1458  # ~4 years, the nominal gap between halvings

MAYER_MA_DAYS = 200  # the Mayer Multiple is defined against the 200-day MA


def mayer_multiple(price: float, ma_200: float) -> float:
    """Price over its 200-day average. Below 1 is historically cheap."""
    return price / ma_200 if ma_200 > 0 else 1.0


def drawdown_pct(price: float, high_water: float) -> float:
    """How far below the highest close so far, as a negative percentage.

    `high_water` must be the running maximum up to that day, never the maximum
    of the whole series — scoring a past day against a peak that had not
    happened yet is lookahead, and it would make this indicator look clairvoyant.
    """
    if high_water <= 0:
        return 0.0
    return (price - high_water) / high_water * 100


def days_since_halving(day: date) -> int:
    past = [h for h in HALVINGS if h <= day]
    return (day - past[-1]).days if past else 0


def cycle_phase(day: date) -> float:
    """Position in the nominal four-year cycle, 0 at a halving and 1 before the
    next one. A calendar, not a measurement — see the note in the UI."""
    return min(days_since_halving(day) / CYCLE_DAYS, 1.0)

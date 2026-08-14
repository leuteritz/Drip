"""A year of acquisitions as a file, for the person who has to explain them.

`holdings.py` already knows the whole of this — `plus_one_year` is the German
one-year rule (§23 EStG) and the card built on it says which buys are past it.
What it could not do was leave the screen. A saver filing a return, or handing
the year to somebody who files it for them, was copying figures off a card by
hand, which is the one job a dashboard should never leave to a person.

So this is that card as rows, and it is deliberately no more than that. Four
rules, and the first is the module:

- **It does not calculate tax.** `holdings` says it of itself — "deliberately
  not a tax calculation: it reports what is held and how old it is, and leaves
  the rest to the person who has to file it" — and a file is the same statement,
  not a licence to go further. There is no gain, no disposal proceeds, no
  allowance and no rate here, because Drip never sells and would be inventing
  all four. What it exports is what it actually knows: what was bought, when,
  for how much, and whether the calendar has let go of it.
- **`tax_free_on` is the one computed column, and it is a date question.** Was
  the year up by the end of the year being exported? `holdings.plus_one_year`
  answers it, the same function the card uses — the one-year rule is a statement
  about the calendar and there may only be one of it here.
- **Real buys only.** A test run is not bitcoin and cannot ripen, which is
  `holdings`' own rule for the same reason, so this goes through
  `analytics.relevant_purchases(include_dry_run=False)`. Failed orders never
  bought anything either and are excluded by that same call.
- **A year still running says so.** `years.py` carries `complete` on every
  cohort and the card prints it; a CSV has no room for a footnote, so the fact
  rides in a comment line above the header. A spreadsheet shows it as a first
  row rather than hiding it, which is the point.

Read-only, no candles, no exchange, no clock beyond today's date. The rows come
from `analytics` so this can never disagree with the card it was read off.
"""
import csv
import io
from datetime import date

from sqlmodel import Session

from . import analytics, holdings
from .constants import ORIGINS
from .models import Purchase

# The legacy export's discipline, for the same reason: a reader that knows this
# header keeps working when a column is appended. Nothing is ever slotted in.
HEADER = [
    "Acquired",
    "BTC",
    "PriceEUR",
    "CostEUR",
    "FeeEUR",
    "FreeAt",
    "TaxFreeOn31Dec",
    "Origin",
]


def rows_for(session: Session, year: int) -> list[Purchase]:
    """Every real buy made in `year`, oldest first."""
    return [
        p
        for p in analytics.relevant_purchases(session, include_dry_run=False)
        if p.timestamp.year == year
    ]


def is_complete(year: int, today: date | None = None) -> bool:
    """Whether the calendar has left `year` behind.

    Deliberately the *calendar* half of `years._cohort`'s `complete` and not the
    candle half: that one also asks whether the price history covered the year,
    because it reports a market average. Nothing here is priced against the
    market, so a thin candle cache does not make an acquisition list partial.
    """
    return year < (today or date.today()).year


def to_csv(session: Session, year: int) -> str:
    """The year's acquisitions as CSV text, with what it cannot say said first."""
    today = date.today()
    rows = rows_for(session, year)
    year_end = date(year, 12, 31)

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    # The comment lines a footnote would have carried. A leading '#' is what
    # every spreadsheet shows as an ordinary first row and every parser that
    # cares can skip, which is the right way round for a file a person opens.
    writer.writerow([f"# Drip - acquisitions in {year}, real buys only (test runs excluded)"])
    if not is_complete(year, today):
        writer.writerow([f"# {year} is still running - this is the year so far, as of {today.isoformat()}"])
    writer.writerow([
        "# TaxFreeOn31Dec: whether the one-year holding period (§23 EStG) was over "
        f"by {year_end.isoformat()}. Drip never sells, so no gain is computed here."
    ])

    writer.writerow(HEADER)
    for purchase in rows:
        acquired = purchase.timestamp.date()
        free_at = holdings.plus_one_year(acquired)
        writer.writerow([
            acquired.isoformat(),
            f"{purchase.btc_amount:.8f}",
            f"{purchase.price_eur:.2f}",
            f"{purchase.amount_eur:.2f}",
            # 0 on a row that never read its fill means *unknown*, never "none
            # was charged" — `Purchase.filled` is the only honest reading of it,
            # so an unfilled row exports an empty cell rather than a zero.
            f"{purchase.fee_eur:.2f}" if purchase.filled else "",
            free_at.isoformat(),
            "yes" if free_at <= year_end else "no",
            purchase.origin if purchase.origin in ORIGINS else "unknown",
        ])

    return buffer.getvalue()

"""Whether the next buy will go through, asked before it is due.

Every other module here reports on buys that have already happened. `pulse` goes
furthest — it finds the weeks that were missed — but it finds them *afterwards*,
which for an unattended bot is a week too late. This is the same question asked
in the other direction: not "did the drip land" but "will the next one".

It exists because Drip could already see all the individual pieces and never put
them together. A key that is stored but expired, a portfolio renamed at Coinbase,
a scheduler that came up without its job, a webhook nobody ever pasted — each of
those is invisible until the Monday it costs a week, and each of them is a
question that can be asked cheaply, right now, without spending anything.

Three rules hold it together:

- **It never raises, and it never acts.** Same discipline as `well.py`, for a
  different reason: this is read by a dashboard, by the weekly report and
  potentially while a buy is being decided, and a check that falls over would
  turn "I could not tell" into an error nobody asked for. Every failure is an
  answer — `unknown` — and never an exception. Nothing here places, skips,
  resizes or defers anything; the exchange still decides whether an order can be
  paid for.
- **It reports on the buy that is actually next.** In dry run no money moves, so
  a missing key cannot stop the coming run and is not reported as though it
  could — it is softened to a warning that says exactly that. A check list that
  cries failure over a test run is one nobody reads by the time it means
  something.
- **Every check is read-only and cheap.** The balance comes from the same
  30-second cache `well` and the header already share, so the report pays
  nothing extra for it; the price check is the public endpoint `strategy` calls
  on every run anyway. Nothing here is an authenticated write, and nothing sends
  a test message to Discord — a webhook that pings every time somebody opens the
  dashboard is worse than one that was never checked.

`unknown` is a first-class answer and is deliberately not folded into either of
its neighbours. A balance that could not be fetched is not a healthy balance and
it is not an empty one; saying so is the whole reason this module can be trusted
about the things it *does* claim.
"""
import logging
from dataclasses import asdict, dataclass
from datetime import date

from sqlmodel import Session

from . import credentials, scheduler, strategy, well
from .bot import is_paused
from .constants import (
    PREFLIGHT_FAIL as STATUS_FAIL,
    PREFLIGHT_PASS as STATUS_PASS,
    PREFLIGHT_UNKNOWN as STATUS_UNKNOWN,
    PREFLIGHT_WARN as STATUS_WARN,
)
from .database import load_settings
from .market_data import get_current_price
from .trading import CoinbaseError, get_balances_cached

logger = logging.getLogger(__name__)

# How the four rank against each other when one word has to stand for all of
# them. `unknown` sits above `pass` and below `warn` on purpose: not knowing is
# worse than being fine and less urgent than a thing that is known to be wrong.
_RANK = {STATUS_PASS: 0, STATUS_UNKNOWN: 1, STATUS_WARN: 2, STATUS_FAIL: 3}


@dataclass(frozen=True)
class Check:
    """One question and its answer.

    `detail` is a whole sentence rather than a code, because only this module
    knows what went wrong and the caller has no way to write the sentence for
    it. The frontend and the digest lay the checks out; neither interprets them.
    """

    key: str
    label: str
    status: str
    detail: str


def _soften(check: Check, dry_run: bool) -> Check:
    """A failure the coming run cannot actually hit, said as a warning.

    Only ever applied to the three checks about money — in dry run no order is
    placed, so a missing key or an empty account cannot stop the next run. It
    still matters, and the sentence says why: it is the day you go live that
    this is about.
    """
    if not dry_run or check.status != STATUS_FAIL:
        return check
    return Check(
        check.key,
        check.label,
        STATUS_WARN,
        f"{check.detail} The next run is a test, so this will not stop it.",
    )


# --- The checks -------------------------------------------------------------

def _keys() -> Check:
    try:
        has = credentials.current().has_coinbase
    except Exception:  # never raises - see the module docstring
        logger.exception("Preflight could not resolve credentials")
        return Check("keys", "Coinbase key", STATUS_UNKNOWN,
                     "The stored credentials could not be read.")

    if has:
        return Check("keys", "Coinbase key", STATUS_PASS,
                     "An API key and a private key are in place.")
    return Check("keys", "Coinbase key", STATUS_FAIL,
                 "No Coinbase key is stored, so a real order cannot be placed.")


def _auth() -> Check:
    """Proves the key pair by reading the balances it would spend.

    The same call `/api/setup/coinbase/test` makes, and the same 30-second cache
    the header and `well` share — so asking this costs nothing on top of what
    the page was already fetching, and `_funds` below reads the very answer this
    check passed on rather than a second one that could disagree with it.
    """
    try:
        if not credentials.current().has_coinbase:
            return Check("auth", "Coinbase accepts it", STATUS_UNKNOWN,
                         "There is no key to test yet.")
    except Exception:
        logger.exception("Preflight could not resolve credentials")
        return Check("auth", "Coinbase accepts it", STATUS_UNKNOWN,
                     "The stored credentials could not be read.")

    try:
        get_balances_cached()
    except CoinbaseError as exc:
        logger.warning("Preflight: Coinbase refused the key: %s", exc)
        return Check("auth", "Coinbase accepts it", STATUS_FAIL,
                     "Coinbase would not answer with the key stored here.")
    except Exception:
        logger.exception("Preflight balance check failed")
        return Check("auth", "Coinbase accepts it", STATUS_UNKNOWN,
                     "Coinbase could not be reached to test the key.")

    return Check("auth", "Coinbase accepts it", STATUS_PASS,
                 "The key was accepted and can read the account.")


def _funds(next_amount_eur: float) -> Check:
    """The well, read as a yes or no about one specific buy.

    `well.runway` already answers this in buys, and it is what the header chip
    and the digest both read — so the threshold for "running low" is its
    `LOW_BUYS` and not a second number invented here.
    """
    runway = well.runway(next_amount_eur)
    if not runway["configured"]:
        return Check("funds", "Money to buy with", STATUS_UNKNOWN,
                     "Without a key there is no balance to read.")
    if not runway["available"]:
        return Check("funds", "Money to buy with", STATUS_UNKNOWN,
                     "Coinbase did not answer with a balance.")

    eur, left = runway["eur_available"], runway["buys_left"]
    if left <= 0:
        return Check("funds", "Money to buy with", STATUS_FAIL,
                     f"€{eur:,.0f} on Coinbase does not cover the next buy "
                     f"of €{next_amount_eur:,.0f}.")
    if runway["low"]:
        buys = "buy" if left == 1 else "buys"
        return Check("funds", "Money to buy with", STATUS_WARN,
                     f"€{eur:,.0f} left — about {left} more {buys}.")
    return Check("funds", "Money to buy with", STATUS_PASS,
                 f"€{eur:,.0f} left — about {left} more buys.")


def _market() -> Check:
    """Whether the public price feed answers at all.

    This is the failure that used to end in a log file: no price means no score
    and no order, and `bot.run_purchase` never gets far enough to write a row.
    Deliberately the same public endpoint the live run uses, so a pass here
    means the same call will work on Monday.
    """
    try:
        price = get_current_price()
    except Exception as exc:
        logger.warning("Preflight: public price feed unreachable: %s", exc)
        return Check("market", "Price feed", STATUS_FAIL,
                     "Coinbase's public price endpoint did not answer, so a run "
                     "now would stop before ordering.")

    if price <= 0:
        return Check("market", "Price feed", STATUS_UNKNOWN,
                     "The price endpoint answered without a price.")
    return Check("market", "Price feed", STATUS_PASS,
                 f"Bitcoin is quoting at €{price:,.0f}.")


def _schedule(paused_until: date | None) -> Check:
    """Whether the scheduler is actually holding the buy.

    Read out of APScheduler rather than derived from the settings, the same rule
    `scheduler.job_overview` follows: a job that never got scheduled shows up as
    missing instead of being advertised from the setting meant to create it.
    """
    try:
        running = scheduler.is_running()
        next_run = scheduler.next_run_time()
    except Exception:
        logger.exception("Preflight could not read the scheduler")
        return Check("schedule", "The drip is scheduled", STATUS_UNKNOWN,
                     "The scheduler could not be asked what it is holding.")

    if not running or next_run is None:
        return Check("schedule", "The drip is scheduled", STATUS_FAIL,
                     "The scheduler is not holding a buy job, so nothing will "
                     "run on its own.")
    if is_paused(paused_until):
        return Check("schedule", "The drip is scheduled", STATUS_WARN,
                     f"Paused until {paused_until} — the scheduled buy will be "
                     "skipped until then.")
    return Check("schedule", "The drip is scheduled", STATUS_PASS,
                 "The buy job is in the scheduler and due to run.")


def _discord(enabled: bool) -> Check:
    """Whether a failure would reach anyone.

    Never a failure of its own: Discord cannot stop a buy. It is here because
    every other check on this list is only worth having if somebody hears about
    it, and a bot that fails silently is the case this whole module is about.
    """
    try:
        configured = bool(credentials.current().discord_webhook)
    except Exception:
        logger.exception("Preflight could not resolve credentials")
        return Check("discord", "You would hear about it", STATUS_UNKNOWN,
                     "The stored webhook could not be read.")

    if not configured:
        return Check("discord", "You would hear about it", STATUS_WARN,
                     "No Discord webhook, so a failed buy would go unreported.")
    if not enabled:
        return Check("discord", "You would hear about it", STATUS_WARN,
                     "Notifications are switched off, so a failed buy would go "
                     "unreported.")
    return Check("discord", "You would hear about it", STATUS_PASS,
                 "Discord is configured and switched on.")


# --- The report -------------------------------------------------------------

def _next_amount(session: Session, base_eur: float) -> float:
    """What the next buy will actually cost, scored the way the buy will be.

    Worth the call rather than falling back to the base amount, because this
    figure is *shown*: the hero already prices the coming buy at the live
    multiplier, and a runway measured against the base would put a different
    number of remaining buys on screen than the well chip two lines above it.
    Two answers to one question is worse than one slow answer.

    Never raises, like everything else here — a market that cannot be scored
    gives the base amount back, which is what the multiplier moves either side
    of and therefore the least wrong stand-in there is.
    """
    try:
        return base_eur * strategy.analyze(session).multiplier
    except Exception:
        logger.warning("Preflight could not score the next buy - using the base amount")
        return base_eur


def summary(session: Session, next_amount_eur: float | None = None) -> dict:
    """Every check, in reading order, plus the one word they add up to.

    `next_amount_eur` is what the caller already worked out from the live score.
    The digest passes its own so the market is not scored twice in one report;
    left out, this scores it itself rather than guessing — see `_next_amount`.
    """
    settings = load_settings(session)
    amount = (
        next_amount_eur
        if next_amount_eur is not None
        else _next_amount(session, settings.base_amount_eur)
    )

    checks = [
        _soften(_keys(), settings.dry_run),
        _soften(_auth(), settings.dry_run),
        _soften(_funds(amount), settings.dry_run),
        _market(),
        _schedule(settings.paused_until),
        _discord(settings.discord_enabled),
    ]

    status = max((c.status for c in checks), key=lambda s: _RANK[s])
    return {
        "status": status,
        "ready": status == STATUS_PASS,
        "dry_run": settings.dry_run,
        "next_run": scheduler.next_run_time(),
        "next_amount_eur": amount,
        "checks": [asdict(c) for c in checks],
    }

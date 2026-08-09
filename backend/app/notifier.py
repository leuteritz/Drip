"""Discord webhook notifications.

Owns both the transport (`send_notification`) and the embed layout for the
messages Drip sends, so the purchase flow in `bot.py` stays about buying and
never about formatting.
"""
import logging
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

import requests

from . import credentials
from .constants import PREFLIGHT_FAIL, PREFLIGHT_UNKNOWN, PREFLIGHT_WARN
from .models import Purchase

if TYPE_CHECKING:  # avoids importing the strategy module at runtime
    from .strategy import Analysis

logger = logging.getLogger(__name__)

COLOR_PAUSED = 0x454545
COLOR_ERROR = 0x785964
COLOR_TEST = 0x45818C


def send_notification(title: str, description: str, color: int = 0x93B7BE,
                      fields: list[dict] | None = None, enabled: bool = True) -> bool:
    webhook = credentials.current().discord_webhook
    if not enabled or not webhook:
        return False

    embed = {
        "title": title,
        "description": description,
        "color": color,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": "Drip"},
    }
    if fields:
        embed["fields"] = fields

    try:
        response = requests.post(
            webhook,
            json={"embeds": [embed], "username": "Drip"},
            timeout=10,
        )
        if response.status_code in (200, 204):
            return True
        logger.warning("Discord error %s: %s", response.status_code, response.text)
    except requests.RequestException as exc:
        logger.warning("Discord unreachable: %s", exc)
    return False


def _late_by(slot: datetime, landed: datetime) -> str:
    """'6 hours late' / '3 days late' — how far past its slot a buy arrived."""
    hours = max((landed - slot).total_seconds() / 3600, 0)
    if hours < 48:
        rounded = max(round(hours), 1)
        return f"{rounded} {'hour' if rounded == 1 else 'hours'} late"
    days = round(hours / 24)
    return f"{days} {'day' if days == 1 else 'days'} late"


def _buys_left(count: int) -> str:
    """'about 3 more buys' / 'not enough for the next buy'."""
    if count <= 0:
        return "not enough for the next buy"
    return f"about {count} more {'buy' if count == 1 else 'buys'}"


def send_purchase_notification(analysis: "Analysis", purchase: Purchase,
                               enabled: bool, error: str | None,
                               manual: bool = False,
                               late_slot: datetime | None = None,
                               well: dict | None = None) -> bool:
    """The post-buy embed: what was bought and which indicators drove it.

    `late_slot` is set only by the catch-up job, and it is the reason the buy is
    worth explaining at all: a purchase appearing on a Wednesday when the drip
    is set to Monday looks like a bug unless the message says which slot it is
    answering, and how late the answer is.

    `well` is `well.runway` and appears **only when it is low** — first, above
    what was bought, because it is the one line here about the next buy rather
    than this one. A healthy balance restated on every purchase is a line nobody
    is still reading by the week it stops being true.
    """
    from .strategy import SCORE_MAX

    # The price and the amount are read off the row rather than off the
    # analysis: a real buy carries the price it was actually filled at and the
    # fee that came out of the amount, and the message that reports a purchase
    # should say what the purchase was, not what the market looked like when it
    # was decided. On a dry run the two are the same number anyway.
    amount = f"€{purchase.amount_eur:.2f}"
    if purchase.filled and purchase.fee_eur > 0:
        amount += f"\n€{purchase.fee_eur:.2f} fee"

    fields = []
    if well and well["low"]:
        fields.append({
            "name": "⚠️ Well running dry",
            "value": (f"€{well['eur_available']:,.0f} left on Coinbase — "
                      f"{_buys_left(well['buys_left'])}. Top up before the next drip."),
            "inline": False,
        })

    fields += [
        {"name": "BTC price", "value": f"€{purchase.price_eur:,.2f}", "inline": True},
        {"name": "Amount", "value": amount, "inline": True},
        {"name": "Bitcoin", "value": f"{purchase.btc_amount:.8f} BTC", "inline": True},
        {"name": "Score", "value": f"{analysis.score}/{SCORE_MAX} - {analysis.signal}", "inline": False},
        {"name": "Fear & Greed", "value": f"{analysis.fear_greed} ({analysis.fng_classification})", "inline": True},
        {"name": "RSI", "value": f"{analysis.rsi:.1f}", "inline": True},
        {"name": "350d MA", "value": f"€{analysis.ma_350:,.0f}", "inline": True},
    ]

    when = f"**{purchase.timestamp:%Y-%m-%d %H:%M}**"
    if late_slot is not None:
        when += (
            f"\n⏳ Catching up the buy due {late_slot:%a %d %b, %H:%M}"
            f" — {_late_by(late_slot, purchase.timestamp)}"
        )
    if error:
        title, description, color = "Drip - buy FAILED", f"{when}\n{error}", COLOR_ERROR
    elif purchase.dry_run:
        title = "Drip - manual dry run" if manual else "Drip - dry run"
        description = f"{when}\nTest cycle (no real order placed)"
        color = analysis.color
    else:
        title = "Drip - manual buy" if manual else "Drip - bitcoin bought"
        description = f"{when}\nOrder `{purchase.order_id}`"
        color = analysis.color

    return send_notification(title, description, color, fields, enabled)


def _day_month(iso: str) -> str:
    """'2026-07-25' -> '25 Jul'."""
    day = date.fromisoformat(iso)
    return f"{day.day} {day:%b}"


def _pulse_line(beat: dict) -> str:
    """The rhythm block: how many of the recent periods a buy actually landed in.

    Two lines at most, and the second one only exists when something is wrong —
    an overdue buy is the one thing in this whole report worth reading first,
    and it is the reason the block is in the message rather than only on a
    dashboard nobody is standing in front of.

    The count is of the periods that were *asked* for: a paused one is named at
    the end rather than counted at the front, so a fortnight off never reads as
    a fortnight the bot slept through.

    The word around the number comes from the cadence rather than being "week"
    in every sentence — a monthly saver reading "47 of the last 50 weeks bought"
    would be reading about a bot nobody is running.
    """
    from . import cadence

    unit = cadence.get(beat.get("cadence"))
    judged = beat["periods_judged"]
    paused = beat["paused"]

    def word(count: int) -> str:
        return unit.unit if count == 1 else unit.units

    if not judged:
        return f"**Paused** - none of the last {paused} {word(paused)} was due"

    if beat["missed"] or beat["failed"]:
        line = f"**{beat['landed']} of the last {judged} {word(judged)}** bought"
        if beat["missed"]:
            line += f" · {beat['missed']} missed"
            if beat["gap_cost"]["sats"]:
                line += f" (about {beat['gap_cost']['sats']:,.0f} sats)"
        if beat["failed"]:
            line += f" · {beat['failed']} {word(beat['failed'])} the order failed"
    else:
        line = f"**Every one of the last {judged} {word(judged)}** bought"

    if paused:
        line += f" · {paused} paused on purpose"

    if beat["overdue"]["overdue"]:
        days = beat["overdue"]["days"]
        when = "today" if days < 1 else f"{days} {'day' if days == 1 else 'days'} ago"
        line += f"\n⚠ The buy due {when} has not landed - the bot may not be running."
    return line


# What each preflight status looks like in a message. `pass` has no mark
# because a passing check never appears on its own line — see `_preflight_line`.
_PREFLIGHT_MARK = {PREFLIGHT_FAIL: "⛔", PREFLIGHT_WARN: "⚠", PREFLIGHT_UNKNOWN: "❔"}


def _preflight_line(report: dict) -> str:
    """What would stop the next drip, or one line saying nothing would.

    Only the checks that have something to say are listed. A report that names
    all six every week is a report where the one line that matters is the
    hardest to find, and the whole point of asking before the buy is that the
    answer arrives while it can still be acted on.

    An `unknown` is dropped as soon as anything worse is on the list, because it
    is almost always that thing's own shadow: with no key stored, "Coinbase
    would not answer" and "there is no balance to read" are not two more faults,
    they are the same fault said three times. Alone, it is the whole message —
    a check that could not be run is exactly the kind of quiet this is for. The
    dashboard still shows all six; a message is not a list.
    """
    trouble = [c for c in report["checks"] if c["status"] != "pass"]
    if not trouble:
        return ("**Everything checks out** - key, balance, price feed and "
                "schedule are all in place.")

    if any(c["status"] in (PREFLIGHT_FAIL, PREFLIGHT_WARN) for c in trouble):
        trouble = [c for c in trouble if c["status"] != PREFLIGHT_UNKNOWN]

    lines = [f"{_PREFLIGHT_MARK[c['status']]} {c['detail']}" for c in trouble]
    if report["dry_run"]:
        lines.append("_Drip is in dry run, so nothing would have been bought anyway._")
    return "\n".join(lines)


def _digest_fields(digest: dict) -> list[dict]:
    """Every field the report can carry, in reading order, each tagged with the
    block it belongs to. Blocks with nothing to say leave their field out."""
    week, total, basis = digest["week"], digest["total"], digest["cost_basis"]
    market, timing, stack = digest["market"], digest["timing"], digest["holdings"]
    milestone, streak = digest["milestone"], digest["streak"]
    analysis, edge = digest["analysis"], digest["vs_dca"]

    stacked = f"**{week['sats']:,.0f} sats** for €{week['spent_eur']:.2f}"
    if week["buys"] > 1:
        stacked += f" across {week['buys']} buys"

    fields: list[dict] = [{
        "key": "week",
        "name": "This week",
        "value": stacked if week["buys"] else "No buys this week",
        "inline": False,
    }]

    if market["available"]:
        fields.append({
            "key": "market",
            "name": "Bitcoin this week",
            "value": (f"€{market['close_eur']:,.0f} ({market['change_pct']:+.1f}%) · "
                      f"high €{market['high_eur']:,.0f} · low €{market['low_eur']:,.0f}"),
            "inline": False,
        })

    fields += [
        {"key": "stack", "name": "Stacked", "value": f"{total['sats']:,.0f} sats", "inline": True},
        {"key": "stack", "name": "Invested", "value": f"€{total['invested_eur']:,.2f}", "inline": True},
        {
            "key": "stack",
            "name": "Value",
            "value": f"€{total['value_eur']:,.2f} ({total['profit_pct']:+.1f}%)",
            "inline": True,
        },
        {
            "key": "dca",
            "name": "vs. plain DCA",
            "value": f"{edge['pp']:+.2f} pp per euro invested",
            "inline": True,
        },
        {
            "key": "basis",
            "name": "Your entry vs. market",
            "value": (f"€{basis['avg_price_eur']:,.0f} vs €{basis['market_twap_eur']:,.0f} "
                      f"({basis['advantage_pct']:+.1f}%)"),
            "inline": True,
        },
    ]

    if timing["available"]:
        fields.append({
            "key": "timing",
            "name": "This week's timing",
            "value": (f"€{timing['paid_eur']:,.0f} paid vs €{timing['avg_close_eur']:,.0f} "
                      f"average ({timing['advantage_pct']:+.1f}%)"),
            "inline": True,
        })

    fields.append({
        "key": "signal",
        "name": "Right now",
        "value": f"Score {analysis.score} - {analysis.signal} ({analysis.multiplier}x)",
        "inline": False,
    })

    if digest["next_run"]:
        when = datetime.fromisoformat(digest["next_run"])
        fields.append({
            "key": "next",
            "name": "Next buy",
            "value": (f"{when:%a} {when.day} {when:%b} at {when:%H:%M} · "
                      f"about €{digest['next_amount_eur']:.2f}"),
            "inline": True,
        })

    # What is left to buy with. Nothing is said on an install with no keys —
    # there is no well there to report — while a configured one whose balance
    # could not be read says so, because that is a fault rather than an absence.
    well = digest["well"]
    if well["configured"]:
        fields.append({
            "key": "well",
            "name": "Well running dry" if well["low"] else "Coinbase well",
            "value": (f"€{well['eur_available']:,.0f} · {_buys_left(well['buys_left'])}"
                      if well["available"] else "Balance unavailable"),
            "inline": True,
        })

    # Deliberately after the well: the balance is one of the things this checks,
    # and the summary reads better once the figure behind it has been stated.
    fields.append({
        "key": "preflight",
        "name": "Ready to buy" if digest["preflight"]["ready"] else "Before the next buy",
        "value": _preflight_line(digest["preflight"]),
        "inline": False,
    })

    if milestone["available"]:
        eta = (f" · about {milestone['weeks_away']} weeks away"
               if milestone["weeks_away"] else "")
        fields.append({
            "key": "milestone",
            "name": "Next milestone",
            "value": (f"{milestone['target_sats']:,} sats — {milestone['progress_pct']:.0f}% "
                      f"there{eta}"),
            "inline": True,
        })

    if streak["periods"]:
        # Named in the drip's own unit: "22 months in a row" for a monthly saver,
        # not 22 weeks, which is what the same number used to be printed as.
        from . import cadence

        unit = cadence.get(streak.get("cadence"))
        run, total = streak["periods"], streak["total_periods"]
        fields.append({
            "key": "streak",
            "name": "Streak",
            "value": (f"{run} {unit.unit if run == 1 else unit.units} in a row · "
                      f"{total} {unit.unit if total == 1 else unit.units} stacked "
                      "in total"),
            "inline": True,
        })

    beat = digest["pulse"]
    if beat["periods_checked"]:
        fields.append({
            "key": "pulse",
            "name": "Drip kept",
            "value": _pulse_line(beat),
            "inline": False,
        })

    if stack["free_sats"] or stack["locked_sats"]:
        held = stack["free_sats"] + stack["locked_sats"]
        ripe = (f"{stack['free_sats']:,.0f} of {held:,.0f} sats"
                if stack["free_sats"] else "Nothing past a year yet")
        if stack["next_free_date"]:
            days = stack["next_free_in_days"]
            ripe += (f" · next buy free {_day_month(stack['next_free_date'])} "
                     f"(in {days} {'day' if days == 1 else 'days'})")
        fields.append({
            "key": "tax",
            "name": "Past the one-year rule",
            "value": ripe,
            "inline": False,
        })

    if digest["excluded"]["count"]:
        fields.append({
            "key": "failed",
            "name": "Not counted",
            "value": (f"{digest['excluded']['count']} buys recorded as failed "
                      f"(€{digest['excluded']['eur']:,.2f})"),
            "inline": False,
        })

    return fields


def build_digest_embed(digest: dict, keys: set[str] | None = None) -> dict:
    """The weekly state-of-the-drip embed, restricted to the chosen blocks.

    Deliberately leads with sats rather than euros: over a week the euro value
    mostly reports what bitcoin did, while the sats are what the saving actually
    achieved. The euro figures follow underneath, where they belong.

    `keys=None` renders everything, which is what the frontend previews — the
    field list it gets back is tagged by block, so it can hide what is switched
    off without a round trip per toggle.
    """
    span, mode = digest["span"], "dry run" if digest["dry_run"] else "live"
    fields = [f for f in _digest_fields(digest) if keys is None or f["key"] in keys]

    return {
        "title": "Drip - your week",
        "description": (f"**{_day_month(span['from'])} – {_day_month(span['to'])}** · "
                        f"your drip is running in **{mode}**"),
        "color": digest["analysis"].color,
        "fields": fields,
    }


def send_digest_notification(digest: dict, keys: set[str], enabled: bool) -> bool:
    embed = build_digest_embed(digest, keys)
    if not embed["fields"]:
        logger.info("Weekly digest has no blocks switched on - not sending")
        return False

    return send_notification(
        title=embed["title"],
        description=embed["description"],
        color=embed["color"],
        # The block key is ours, not Discord's.
        fields=[{k: v for k, v in field.items() if k != "key"} for field in embed["fields"]],
        enabled=enabled,
    )


def send_run_failure_notification(error: str, enabled: bool) -> bool:
    """Sent when the scheduled run fell over before an order was ever attempted.

    Deliberately says that nothing was bought: the failed-order embed above
    reports a buy that was tried, and the two must not be mistaken for each
    other by someone reading their phone at nine on a Monday.
    """
    return send_notification(
        title="Drip - the weekly run failed",
        description=(f"**{datetime.now():%Y-%m-%d %H:%M}**\n"
                     "Nothing was bought and no order was placed. The next drip is "
                     f"still scheduled.\n```{error[:400]}```"),
        color=COLOR_ERROR,
        enabled=enabled,
    )


def send_paused_notification(paused_until, enabled: bool) -> bool:
    """Sent when a scheduled run is skipped because the bot is paused."""
    return send_notification(
        title="Drip paused",
        description=f"Scheduled buy skipped - paused until {paused_until}",
        color=COLOR_PAUSED,
        enabled=enabled,
    )

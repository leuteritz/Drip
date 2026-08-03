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


def send_purchase_notification(analysis: "Analysis", purchase: Purchase,
                               enabled: bool, error: str | None,
                               manual: bool = False) -> bool:
    """The post-buy embed: what was bought and which indicators drove it."""
    from .strategy import SCORE_MAX

    fields = [
        {"name": "BTC price", "value": f"€{analysis.current_price:,.2f}", "inline": True},
        {"name": "Amount", "value": f"€{purchase.amount_eur:.2f}", "inline": True},
        {"name": "Bitcoin", "value": f"{purchase.btc_amount:.8f} BTC", "inline": True},
        {"name": "Score", "value": f"{analysis.score}/{SCORE_MAX} - {analysis.signal}", "inline": False},
        {"name": "Fear & Greed", "value": f"{analysis.fear_greed} ({analysis.fng_classification})", "inline": True},
        {"name": "RSI", "value": f"{analysis.rsi:.1f}", "inline": True},
        {"name": "350d MA", "value": f"€{analysis.ma_350:,.0f}", "inline": True},
    ]

    when = f"**{purchase.timestamp:%Y-%m-%d %H:%M}**"
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

    if streak["weeks"]:
        fields.append({
            "key": "streak",
            "name": "Streak",
            "value": (f"{streak['weeks']} weeks in a row · "
                      f"{streak['total_weeks']} weeks stacked in total"),
            "inline": True,
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


def send_paused_notification(paused_until, enabled: bool) -> bool:
    """Sent when a scheduled run is skipped because the bot is paused."""
    return send_notification(
        title="Drip paused",
        description=f"Scheduled buy skipped - paused until {paused_until}",
        color=COLOR_PAUSED,
        enabled=enabled,
    )

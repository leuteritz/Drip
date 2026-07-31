"""Discord webhook notifications.

Owns both the transport (`send_notification`) and the embed layout for the
messages Drip sends, so the purchase flow in `bot.py` stays about buying and
never about formatting.
"""
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import requests

from .config import config
from .models import Purchase

if TYPE_CHECKING:  # avoids importing the strategy module at runtime
    from .strategy import Analysis

logger = logging.getLogger(__name__)

COLOR_PAUSED = 0x454545
COLOR_ERROR = 0x785964
COLOR_TEST = 0x45818C


def send_notification(title: str, description: str, color: int = 0x93B7BE,
                      fields: list[dict] | None = None, enabled: bool = True) -> bool:
    if not enabled or not config.discord_webhook_url:
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
            config.discord_webhook_url,
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


def send_digest_notification(digest: dict, enabled: bool) -> bool:
    """The weekly state-of-the-drip embed.

    Deliberately leads with sats rather than euros: over a week the euro value
    mostly reports what bitcoin did, while the sats are what the saving actually
    achieved. The euro figures follow underneath, where they belong.
    """
    week, total = digest["week"], digest["total"]
    basis, analysis = digest["cost_basis"], digest["analysis"]
    edge = digest["vs_dca"]

    fields = [
        {
            "name": "This week",
            "value": (f"{week['sats']:,.0f} sats for €{week['spent_eur']:.2f}"
                      if week["buys"] else "No buys"),
            "inline": False,
        },
        {"name": "Stacked", "value": f"{total['sats']:,.0f} sats", "inline": True},
        {"name": "Invested", "value": f"€{total['invested_eur']:,.2f}", "inline": True},
        {
            "name": "Value",
            "value": f"€{total['value_eur']:,.2f} ({total['profit_pct']:+.1f}%)",
            "inline": True,
        },
        {
            "name": "vs. plain DCA",
            "value": f"{edge['pp']:+.2f} pp per euro invested",
            "inline": True,
        },
        {
            "name": "Your entry vs. market",
            "value": (f"€{basis['avg_price_eur']:,.0f} vs €{basis['market_twap_eur']:,.0f} "
                      f"({basis['advantage_pct']:+.1f}%)"),
            "inline": True,
        },
        {
            "name": "Right now",
            "value": f"Score {analysis.score} - {analysis.signal} ({analysis.multiplier}x)",
            "inline": False,
        },
    ]

    if digest["next_free_date"]:
        fields.append({
            "name": "Next lot past one year",
            "value": digest["next_free_date"],
            "inline": True,
        })
    if digest["excluded"]["count"]:
        fields.append({
            "name": "Not counted",
            "value": (f"{digest['excluded']['count']} buys recorded as failed "
                      f"(€{digest['excluded']['eur']:,.2f})"),
            "inline": False,
        })

    mode = "dry run" if digest["dry_run"] else "live"
    description = f"The week in one message · currently in **{mode}**"
    if digest["next_run"]:
        description += f"\nNext buy: {digest['next_run'][:16].replace('T', ' ')}"

    return send_notification(
        title="Drip - your week",
        description=description,
        color=analysis.color,
        fields=fields,
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

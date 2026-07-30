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


def send_paused_notification(paused_until, enabled: bool) -> bool:
    """Sent when a scheduled run is skipped because the bot is paused."""
    return send_notification(
        title="Drip paused",
        description=f"Scheduled buy skipped - paused until {paused_until}",
        color=COLOR_PAUSED,
        enabled=enabled,
    )

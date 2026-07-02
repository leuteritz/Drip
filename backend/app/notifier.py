"""Discord webhook notifications."""
import logging
from datetime import datetime, timezone

import requests

from .config import config

logger = logging.getLogger(__name__)


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

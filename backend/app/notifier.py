"""Discord-Benachrichtigungen - portiert aus legacy/helper.py"""
import logging
from datetime import datetime, timezone

import requests

from .config import config

logger = logging.getLogger(__name__)


def send_notification(title: str, description: str, color: int = 0x00FF00,
                      fields: list[dict] | None = None, enabled: bool = True) -> bool:
    if not enabled or not config.discord_webhook_url:
        return False

    embed = {
        "title": title,
        "description": description,
        "color": color,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": "Bitcoin Smart-DCA Bot"},
    }
    if fields:
        embed["fields"] = fields

    try:
        response = requests.post(
            config.discord_webhook_url,
            json={"embeds": [embed], "username": "Bitcoin Smart-DCA Bot"},
            timeout=10,
        )
        if response.status_code in (200, 204):
            return True
        logger.warning("Discord-Fehler %s: %s", response.status_code, response.text)
    except requests.RequestException as exc:
        logger.warning("Discord nicht erreichbar: %s", exc)
    return False

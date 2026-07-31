"""SQLModel tables: purchases, bot settings, digest settings, credentials,
candle cache."""
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Purchase(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(index=True)
    price_eur: float
    amount_eur: float
    btc_amount: float
    fear_greed: int
    rsi: float
    ma_350: float
    score: int
    multiplier: float
    order_id: str = ""
    status: str = ""
    dry_run: bool = True


class BotSettings(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    base_amount_eur: float = 50.0
    schedule_weekday: int = 0  # 0 = Monday ... 6 = Sunday
    schedule_time: str = "09:00"
    dry_run: bool = True
    paused_until: Optional[date] = None
    discord_enabled: bool = True


class DigestSettings(SQLModel, table=True):
    """When the weekly report goes out, and what it carries.

    Its own table rather than more columns on BotSettings, because there are no
    migrations: `create_all` will not add a column to an existing table, but it
    does create a whole new one. That is the only reason this is configurable at
    all — see CLAUDE.md.

    `blocks` is a JSON object of {block key: bool}. A key that is missing falls
    back to the block's own default in `digest.BLOCKS`, so a block added in a
    later version arrives switched on instead of silently off.
    """

    id: int = Field(default=1, primary_key=True)
    enabled: bool = True
    weekday: int = 6  # 0 = Monday ... 6 = Sunday
    send_time: str = "18:00"
    blocks: str = "{}"


class Credentials(SQLModel, table=True):
    """The secrets the dashboard is allowed to set.

    Its own table for the same reason `DigestSettings` is: there are no
    migrations, and `create_all` will not add a column to an existing table but
    does create a whole new one.

    An empty string means "not set here" rather than "empty", so the value falls
    back to whatever `backend/.env` provided. `credentials.py` owns that
    resolution — never read these columns directly.
    """

    id: int = Field(default=1, primary_key=True)
    coinbase_api_key: str = ""
    coinbase_api_secret: str = ""
    discord_webhook_url: str = ""


class Candle(SQLModel, table=True):
    day: date = Field(primary_key=True)
    open: float
    high: float
    low: float
    close: float
    volume: float

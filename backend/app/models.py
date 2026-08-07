"""SQLModel tables: purchases, bot settings, pause windows, digest settings,
credentials, candle cache."""
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
    # Buy a slot that came and went while Drip was not running. Off by default:
    # it is the one thing here that can spend money at a moment nobody chose,
    # so it is asked for rather than assumed. See `pulse.missed_slot`.
    catch_up: bool = False


class PauseWindow(SQLModel, table=True):
    """A stretch the bot was deliberately told to stand still for.

    `BotSettings.paused_until` says whether Drip is paused *now* and nothing
    about last winter, which left the one hole in `pulse`: a fortnight somebody
    chose to skip looked exactly like a fortnight the Pi spent switched off at
    the wall, and both were reported as weeks the drip failed to land in. A row
    here is that missing fact — written when a pause is asked for, closed when
    it is lifted — so a skipped week can be told from a lost one.

    Deliberately a record and not a control: nothing schedules from these rows.
    `paused_until` still decides what happens next; this only remembers what was
    already decided, which is why it can be written after the fact without
    changing a single buy.

    `until` is the last day covered, inclusive — the same reading `is_paused`
    gives that column. `ended_at` is set only when a pause is lifted before it
    would have run out, and it is what makes the window shorter than `until`
    promised. An open window is one with no `ended_at` whose `until` has not
    passed.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    started_at: datetime = Field(index=True)
    until: date
    ended_at: Optional[datetime] = None


class DigestSettings(SQLModel, table=True):
    """When the weekly report goes out, and what it carries.

    Its own table rather than more columns on BotSettings, and it stayed one:
    it was written when `create_all` was the whole of the schema handling, and a
    new table was the only shape a new setting could arrive in. `database.
    _migrate_columns` has since made a column possible, but moving these would
    be a rewrite of a table holding somebody's schedule to buy nothing at all —
    so this is where the report's settings live, and a *report* setting belongs
    here rather than on the bot's own row anyway.

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

    Its own table for the same reason `DigestSettings` is one, and it earns it
    twice over now: secrets have no business sitting beside a schedule, and
    nothing that reads the bot's settings should be carrying them around.

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

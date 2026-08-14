"""SQLModel tables: purchases, bot settings, pause windows, digest settings,
credentials, candle cache."""
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Purchase(SQLModel, table=True):
    """One run of the bot: what it decided, and what that actually bought.

    `amount_eur` is the amount the buy was *ordered* for and stays that way —
    it is the base amount times the multiplier, and `analytics` divides it back
    out to get the plain-DCA baseline, so it may never drift towards whatever
    the exchange charged. Everything about what arrived is the other three
    columns: `btc_amount` and `price_eur` are read back off the filled order
    where the exchange said, and `fee_eur` is the slice of the amount that
    became Coinbase's rather than bitcoin.

    `filled` says which of those two worlds a row is from. False means the
    numbers were worked out here — every dry run, every imported legacy row, and
    a real buy whose fill could not be read in time — and a fee of 0 on such a
    row means "not known", never "none was charged".

    `origin` is the same idea about the other end of the buy: what asked for it.
    The bot already knew — `run_purchase` takes it, checks the pause with it and
    tells Discord about it — and then threw it away, which left two things
    unreadable afterwards. A buy somebody clicked is recorded with multiplier
    1.0 so it stays neutral in the DCA comparison, which makes it identical to a
    scheduled week that happened to score 1.0x; and a catch-up is a drip landing
    days off schedule, which reads as a bug rather than as the machine making
    good. An empty string is a row from before this was written down, or one
    imported from a file that never carried it — unknown, and reported as
    nothing rather than guessed at. See `constants.ORIGINS`.
    """

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
    fee_eur: float = 0.0
    filled: bool = False
    origin: str = ""


class BotSettings(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    base_amount_eur: float = 50.0
    # How often the drip drips: daily | weekly | biweekly | monthly. Weekly is
    # the default and is what every install had before this column existed, so
    # `_migrate_columns` writing that default in is the whole of the upgrade.
    # The two below still mean what they meant — a cadence only changes how
    # often that weekday comes round, and monthly is the *first* one in the
    # month. `cadence.py` owns what a period and a slot are; nothing else may
    # decide it. An unrecognised word here reads as weekly rather than raising.
    cadence: str = "weekly"
    schedule_weekday: int = 0  # 0 = Monday ... 6 = Sunday (ignored when daily)
    schedule_time: str = "09:00"
    dry_run: bool = True
    paused_until: Optional[date] = None
    discord_enabled: bool = True
    # Buy a slot that came and went while Drip was not running. Off by default:
    # it is the one thing here that can spend money at a moment nobody chose,
    # so it is asked for rather than assumed. See `pulse.missed_slot`.
    catch_up: bool = False
    # What the stack on the exchange may be worth before Drip mentions that it
    # is still sitting there. A round number rather than a share of anything:
    # the question is how much of somebody else's risk is being carried, and
    # that is an amount. 0 keeps the figures and drops the nudge. See
    # `custody.py`; it reaches an existing install through `_migrate_columns`.
    custody_threshold_eur: float = 1000.0
    # Whether Drip speaks between buys — a blocked next buy, or a drip that went
    # overdue with nothing to pick it up. On by default, unlike `catch_up`: this
    # only ever reports, it can never spend. See `watch.py`; it reaches an
    # existing install through `_migrate_columns`.
    watch: bool = True
    # Which cards the Overview shows: a JSON object of {card key: bool}. "{}"
    # resolved against the frontend's registry means every card on, which is the
    # page every install had before this column existed — so `_migrate_columns`
    # writing the default in is the whole of the upgrade, the way `cadence` was.
    # A key that is missing falls back to that card's own default, so a card
    # added in a later version arrives switched on rather than silently off —
    # the rule `DigestSettings.blocks` states. Unlike that one, the vocabulary
    # is *not* on this side: `cards.py` stores and shape-checks the blob and
    # deliberately holds no list, because the cards are rendered by React. See
    # `cards.py` and `frontend/src/lib/cards.ts`.
    cards: str = "{}"


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


class WatchAlert(SQLModel, table=True):
    """One thing Drip said between buys, and whether it is still true.

    A record, the way `PauseWindow` is: it never decides anything. An open row
    (no `cleared_at`) is a fault that has already been reported, which is the
    whole of what stops the same sentence going out every day for the weeks it
    stays true — and equally what lets it be said again if it clears and comes
    back.

    `detail` is the sentence itself rather than a code, so a fault that changes
    what it says is news again: "no key" becoming "the balance no longer covers
    the next buy" is a different problem with a different fix, even though both
    are the same `kind`.

    A row is written **only** when Discord actually accepted the message.
    Nothing may be recorded as said that was not said. A new table is also the
    one schema change SQLite makes for free, so this reaches an existing install
    through `create_all` alone — the `PauseWindow` precedent.
    """

    id: Optional[int] = Field(default=None, primary_key=True)
    kind: str = Field(index=True)      # one of constants.WATCHES
    detail: str = ""
    sent_at: datetime = Field(index=True)
    cleared_at: Optional[datetime] = None


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
    # The optional lock in front of the API, as a scrypt hash. Empty is the
    # whole of the guarantee: it means there is no password, which is what every
    # install had before this column existed and what `_migrate_columns` writes
    # in. It sits here rather than in `credentials.FIELDS` because those are the
    # secrets Drip hands to somebody else and this is the one that guards Drip
    # itself — a different shelf. Never read it directly; `auth.py` resolves it
    # against `.env` the way `credentials.py` resolves the three above.
    password_hash: str = ""


class Candle(SQLModel, table=True):
    day: date = Field(primary_key=True)
    open: float
    high: float
    low: float
    close: float
    volume: float

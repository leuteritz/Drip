"""Runtime secrets: the dashboard's row wins, `backend/.env` is the fallback.

Drip is installed by dropping a compose file onto a Pi, and `backend/.env` is
read by Docker at container start — the backend cannot write to it (compose
mounts the data volume, not that file, and `env_file` is only read once anyway).
So the dashboard stores what it is given in a table, and this module is the one
place that decides which of the two a caller gets:

    a value set in the dashboard  ->  used
    otherwise a value from .env   ->  used
    neither                       ->  the feature is simply not configured

Every reader goes through `current()` — `trading.py` for the Coinbase client,
`notifier.py` for the webhook, the routers for their `configured` flags — so the
resolution order exists exactly once. The result is cached in-process and
dropped by `invalidate()` the moment something is saved, which is also what
makes a freshly pasted key take effect without restarting the container.

Nothing here ever hands a secret back out: `mask()` is what the dashboard sees.
"""
import logging
from dataclasses import dataclass

from sqlmodel import Session

from .config import config
from .database import engine, load_credentials
from .models import Credentials

logger = logging.getLogger(__name__)

SOURCE_DASHBOARD = "dashboard"
SOURCE_ENV = "env"
SOURCE_NONE = "none"

GROUP_COINBASE = "coinbase"
GROUP_DISCORD = "discord"

MASK = "•" * 4


@dataclass(frozen=True)
class FieldSpec:
    """One editable secret, as offered to the dashboard.

    Served rather than hard-coded in the client for the same reason
    `digest.BLOCKS` is: the list, its order and its wording can only come from
    here, so a field added later cannot be forgotten in the frontend.
    """

    key: str
    group: str
    label: str
    hint: str
    placeholder: str
    multiline: bool = False


FIELDS: tuple[FieldSpec, ...] = (
    FieldSpec(
        key="coinbase_api_key",
        group=GROUP_COINBASE,
        label="API key name",
        hint="From Coinbase Developer Platform - the long organizations/… path, not the nickname you gave the key.",
        placeholder="organizations/…/apiKeys/…",
    ),
    FieldSpec(
        key="coinbase_api_secret",
        group=GROUP_COINBASE,
        label="Private key",
        hint="The EC private key downloaded with it. Paste it whole, BEGIN and END lines included.",
        placeholder="-----BEGIN EC PRIVATE KEY-----\n…\n-----END EC PRIVATE KEY-----",
        multiline=True,
    ),
    FieldSpec(
        key="discord_webhook_url",
        group=GROUP_DISCORD,
        label="Webhook URL",
        hint="Discord → Server settings → Integrations → Webhooks → Copy webhook URL.",
        placeholder="https://discord.com/api/webhooks/…",
    ),
)

KEYS = tuple(field.key for field in FIELDS)


@dataclass(frozen=True)
class Secret:
    """A resolved value and where it came from."""

    value: str
    source: str

    @property
    def configured(self) -> bool:
        return bool(self.value)


@dataclass(frozen=True)
class Resolved:
    coinbase_api_key: Secret
    coinbase_api_secret: Secret
    discord_webhook_url: Secret

    def get(self, key: str) -> Secret:
        return getattr(self, key)

    @property
    def has_coinbase(self) -> bool:
        return self.coinbase_api_key.configured and self.coinbase_api_secret.configured

    @property
    def api_secret_normalized(self) -> str:
        """The PEM key is stored single-line (with literal \\n) in .env, and may
        be pasted either way into the dashboard."""
        return self.coinbase_api_secret.value.replace("\\n", "\n")

    @property
    def discord_webhook(self) -> str:
        return self.discord_webhook_url.value


def _pick(stored: str, from_env: str) -> Secret:
    if stored:
        return Secret(stored, SOURCE_DASHBOARD)
    if from_env:
        return Secret(from_env, SOURCE_ENV)
    return Secret("", SOURCE_NONE)


def _resolve(row: Credentials) -> Resolved:
    return Resolved(
        **{
            key: _pick(getattr(row, key).strip(), getattr(config, key).strip())
            for key in KEYS
        }
    )


_cache: Resolved | None = None


def current() -> Resolved:
    """The secrets as they stand right now. Cached until something saves."""
    global _cache
    if _cache is None:
        with Session(engine) as session:
            _cache = _resolve(load_credentials(session))
    return _cache


def invalidate() -> None:
    global _cache
    _cache = None


def save(session: Session, values: dict[str, str]) -> Resolved:
    """Stores the given fields. An empty string clears that field, which hands
    it back to `.env` if one is configured there — never a way to lose a key
    silently, since the dashboard shows which of the two is in effect."""
    row = load_credentials(session)
    for key, value in values.items():
        if key not in KEYS:
            raise ValueError(f"Unknown credential field: {key}")
        setattr(row, key, value.strip())
    session.add(row)
    session.commit()
    session.refresh(row)
    invalidate()
    logger.info("Credentials updated: %s", ", ".join(sorted(values)) or "nothing")
    return current()


def mask(value: str) -> str:
    """Enough of a secret to recognise it, never enough to use it.

    What survives is what is already public about the value — the URL it posts
    to, the account path in a Coinbase key, the PEM header — plus the last four
    characters, so two keys can be told apart at a glance.
    """
    value = value.strip()
    if not value:
        return ""

    lines = value.replace("\\n", "\n").splitlines()
    head = lines[0]
    if len(lines) > 1:  # a PEM key: its header is the whole of what is safe
        return f"{head} {MASK}"

    if "/" in head:  # a URL or a Coinbase key path: keep everything but the tail
        head = head.rsplit("/", 1)[0] + "/"
    else:
        head = ""
    if len(head) > 36:
        head = f"{head[:16]}…{head[-16:]}"

    tail = value[-4:] if len(value) >= 12 else ""
    return f"{head}{MASK}{tail}"

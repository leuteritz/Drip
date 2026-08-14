"""Drip's own lock, and it is off until somebody asks for one.

The API had no authentication at all, on the reasoning that it sits on a home
LAN. Three endpoints made that reasoning too thin to keep: `/api/setup/backup`
hands over the whole database with the Coinbase private key inside it,
`DELETE /api/purchases` empties somebody's savings history, and `POST /api/bot/
buy` spends money. None of those is a thing a guest's phone on the same wifi
should be able to do by typing an address.

So: an **optional** password, and the word is the whole module. An empty one is
not a weak configuration - it is the configuration Drip has always had, byte for
byte, and it stays reachable that way for ever. Being locked out of the bot that
holds your own history is a worse failure than the one this guards against,
which is why `.env` keeps a way back in and why nothing here remembers a refusal
across a restart.

    a hash in the Credentials row  ->  that is the password
    otherwise DRIP_PASSWORD in .env ->  hashed here, once, and used
    neither                        ->  there is no lock

Read the state through `current()`. It is cached in-process and dropped by
`invalidate()` when the password changes or the database is replaced - the
`credentials.py` contract, for the same reason, and this module is modelled on
it line for line.

Four rules hold the rest of it together:

- **The lock is on `/api` and only on `/api`.** In the shipped deployment nginx
  serves the bundle and proxies only `/api/`, so the backend could not gate a
  static file even if it wanted to - and a bundle is public bytes in any browser
  regardless. That is also what leaves `main.py`'s SPA fallback, `lib/route.ts`
  and `/#tank` untouched.
- **The signing key is derived from the stored hash**, which buys revocation for
  free: change the password and every outstanding session dies, with no session
  table to keep and nothing to expire by hand. Restoring a backup reverts the
  lock *and* invalidates sessions issued under the newer one, which is correct
  and falls out rather than being coded.
- **Nothing is remembered across a restart.** No session table, and the
  rate-limit counter is a module dict. Both would be ways to be permanently
  locked out of your own Pi, and this module ranks that above the risk it
  guards against. The lock refuses; it does not remember.
- **Standard library only.** `hashlib.scrypt`, `hmac`, `secrets`. Nothing is
  added to `requirements.txt`: the ARM64 target stays light, and the `PyJWT`
  and `cryptography` that happen to be installed are transitive dependencies of
  the Coinbase client, which is not a thing to build on - the same discipline
  `signals.py` states about candidate indicators.
"""
import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from dataclasses import dataclass

from sqlmodel import Session

from .config import config
from .database import engine, load_credentials

logger = logging.getLogger(__name__)

COOKIE = "drip_session"

# The two doors that must open while the door is shut. Everything else under
# /api/ is behind the lock; everything outside it was never the backend's to
# hold. `/docs` and `/openapi.json` stay open deliberately - the schema is
# already inside the shipped JS, and a docs page that cannot load is a fault
# nobody can act on. "Try it out" 401s, which is the right answer.
OPEN_PATHS = ("/api/auth", "/api/auth/login")

SESSION_DAYS = 30
# A wall display cannot type a password. Ten years is not an exemption - it is
# the same signed token with a longer life, so there is still one lock, one kind
# of token and no ungated endpoint. It dies with a password change like any
# other session, and the login says so beside the checkbox.
KIOSK_DAYS = 3650

# scrypt at 16 MiB (128 * n * r). Deliberately under OpenSSL's 32 MiB `maxmem`
# default, which n=2**15 exceeds and which raises on some builds - a failure
# that would only ever show up on the Pi. Paid once at login, never per request.
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_DK_LEN = 32
_SCHEME = "scrypt"

# Five wrong tries, then a doubling wait. In-process on purpose: see the rules.
_MAX_TRIES = 5
_LOCKOUT_SECONDS = 60
_LOCKOUT_CAP = 900


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


# --- Hashing ----------------------------------------------------------------

def hash_password(password: str) -> str:
    """A stored hash, self-describing so a later parameter change can read it.

    `scrypt$n$r$p$salt$hash` - the same discipline as `Purchase.origin`: the
    column says what it is rather than being guessed at from its shape.
    """
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P,
        dklen=_DK_LEN,
    )
    return f"{_SCHEME}${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64(salt)}${_b64(derived)}"


def verify_password(password: str, stored: str) -> bool:
    """Whether `password` produces `stored`. Never raises on a damaged hash.

    A row this version cannot parse is treated as not matching rather than as an
    error: the honest reading of an unreadable lock is "that is not the
    password", and `.env` is still the way back in.
    """
    try:
        scheme, n, r, p, salt, expected = stored.split("$")
        if scheme != _SCHEME:
            return False
        derived = hashlib.scrypt(
            password.encode(), salt=_unb64(salt), n=int(n), r=int(r), p=int(p),
            dklen=len(_unb64(expected)),
        )
    except (ValueError, TypeError, MemoryError):
        return False
    return hmac.compare_digest(derived, _unb64(expected))


# --- The resolved state -----------------------------------------------------

@dataclass(frozen=True)
class Lock:
    """The password as it stands, and where it came from."""

    hash: str
    source: str  # "dashboard" | "env" | "none"

    @property
    def required(self) -> bool:
        return bool(self.hash)

    @property
    def signing_key(self) -> bytes:
        """Derived from the stored hash, which is what makes a password change
        revoke every outstanding session without a table to do it in."""
        return hashlib.sha256(b"drip-session-v1" + self.hash.encode()).digest()


_NO_LOCK = Lock("", "none")
_cache: Lock | None = None


def _resolve() -> Lock:
    with Session(engine) as session:
        stored = (load_credentials(session).password_hash or "").strip()
    if stored:
        return Lock(stored, "dashboard")
    # The bootstrap and the way back in. Hashed here rather than stored, so the
    # file stays the only place it lives and editing it takes effect on restart.
    from_env = (config.drip_password or "").strip()
    if from_env:
        return Lock(hash_password(from_env), "env")
    return _NO_LOCK


def current() -> Lock:
    """The lock as it stands right now. Cached until something changes it."""
    global _cache
    if _cache is None:
        _cache = _resolve()
    return _cache


def invalidate() -> None:
    global _cache
    _cache = None


def set_password(session: Session, password: str) -> Lock:
    """Stores a new password, or removes the lock when given an empty one.

    Removing writes an empty column, which hands the question back to `.env` -
    the `credentials.save` convention, and the reason an install bootstrapped
    from the file cannot be silently unlocked from the dashboard.
    """
    row = load_credentials(session)
    row.password_hash = hash_password(password) if password else ""
    session.add(row)
    session.commit()
    invalidate()
    logger.info("Password %s", "set" if password else "removed")
    return current()


# --- Sessions ---------------------------------------------------------------

def issue(lock: Lock, days: int = SESSION_DAYS) -> str:
    """A signed token. Stateless: there is nothing to store and nothing to leak.

    No user id, because there is one user. The payload carries only its own
    expiry, and the signature is what makes that expiry binding.
    """
    payload = _b64(json.dumps({"v": 1, "exp": int(time.time()) + days * 86400}).encode())
    signature = hmac.new(lock.signing_key, payload.encode(), hashlib.sha256).digest()
    return f"{payload}.{_b64(signature)}"


def valid(token: str | None, lock: Lock) -> bool:
    """Whether a token was signed by this lock and has not expired."""
    if not token:
        return False
    try:
        payload, signature = token.split(".", 1)
        expected = hmac.new(lock.signing_key, payload.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_unb64(signature), expected):
            return False
        return int(json.loads(_unb64(payload))["exp"]) > time.time()
    except (ValueError, TypeError, KeyError):
        return False


# --- Refusing, without remembering ------------------------------------------

_tries: dict[str, tuple[int, float]] = {}


def blocked_for(who: str) -> int:
    """Seconds left before `who` may try again. 0 when they may try now."""
    count, until = _tries.get(who, (0, 0.0))
    return max(int(until - time.time()), 0) if count >= _MAX_TRIES else 0


def note_failure(who: str) -> None:
    count, _ = _tries.get(who, (0, 0.0))
    count += 1
    wait = min(_LOCKOUT_SECONDS * 2 ** max(count - _MAX_TRIES, 0), _LOCKOUT_CAP)
    _tries[who] = (count, time.time() + wait)


def note_success(who: str) -> None:
    _tries.pop(who, None)


# --- The gate ---------------------------------------------------------------

def is_open(path: str) -> bool:
    """Whether a request may through without a session.

    Everything that is not `/api` is open here because it was never this
    module's to hold - see the rules in the module docstring.
    """
    return not path.startswith("/api/") or path.rstrip("/") in OPEN_PATHS


def allows(path: str, token: str | None) -> bool:
    """The whole decision, in one place: may this request through?"""
    lock = current()
    if not lock.required:
        return True
    return is_open(path) or valid(token, lock)

"""The lock: off by default, and unforgeable when it is on.

The first class is the one that matters most. Every install that has never set a
password must behave exactly as it did before this module existed — not "almost",
not "unless", byte for byte. Everything else here is about a token that cannot be
faked and a password change that genuinely revokes.

Nothing here goes near the middleware or a request; `auth.allows` is the whole
decision and it is a pure function of a path, a token and the stored hash.
"""
import time

import pytest

from app import auth


@pytest.fixture(autouse=True)
def no_stored_lock(monkeypatch):
    """Resolve the lock from nothing unless a test says otherwise.

    `auth.current()` reads the database and `backend/.env`; both are somebody
    else's state as far as these tests are concerned.
    """
    auth.invalidate()
    monkeypatch.setattr(auth, "_resolve", lambda: auth._NO_LOCK)
    yield
    auth.invalidate()


def locked(monkeypatch, password="hunter2", source="dashboard") -> auth.Lock:
    lock = auth.Lock(auth.hash_password(password), source)
    monkeypatch.setattr(auth, "_resolve", lambda: lock)
    auth.invalidate()
    return lock


class TestNoPasswordIsTodaysDrip:
    """The guarantee the whole feature rests on."""

    def test_no_lock_means_not_required(self):
        assert auth.current().required is False

    def test_every_path_is_allowed_with_no_token_at_all(self):
        for path in [
            "/api/bot/status",
            "/api/setup/backup",
            "/api/purchases",
            "/api/settings",
            "/",
            "/assets/index.js",
        ]:
            assert auth.allows(path, None) is True

    def test_a_nonsense_token_changes_nothing(self):
        assert auth.allows("/api/setup/backup", "not-a-token") is True


class TestHashing:
    def test_a_password_verifies_against_its_own_hash(self):
        stored = auth.hash_password("hunter2")
        assert auth.verify_password("hunter2", stored) is True

    def test_a_different_password_does_not(self):
        assert auth.verify_password("hunter3", auth.hash_password("hunter2")) is False

    def test_the_same_password_hashes_differently_every_time(self):
        # A salt per hash: two installs with the same password have nothing in
        # common on disk.
        assert auth.hash_password("hunter2") != auth.hash_password("hunter2")

    def test_the_stored_form_says_what_it_is(self):
        # Self-describing, so a later parameter change can still read old rows.
        stored = auth.hash_password("hunter2")
        scheme, n, r, p, salt, digest = stored.split("$")
        assert scheme == "scrypt"
        assert (int(n), int(r), int(p)) == (auth._SCRYPT_N, auth._SCRYPT_R, auth._SCRYPT_P)
        assert salt and digest

    def test_a_damaged_hash_is_not_a_match_and_not_a_crash(self):
        for rubbish in ["", "nonsense", "scrypt$$$$", "bcrypt$1$2$3$a$b", "a$b$c"]:
            assert auth.verify_password("hunter2", rubbish) is False

    def test_an_empty_password_is_never_a_match(self):
        assert auth.verify_password("", auth.hash_password("hunter2")) is False


class TestSessions:
    def test_a_freshly_issued_token_is_valid(self, monkeypatch):
        lock = locked(monkeypatch)
        assert auth.valid(auth.issue(lock), lock) is True

    def test_a_tampered_signature_is_refused(self, monkeypatch):
        lock = locked(monkeypatch)
        payload, signature = auth.issue(lock).split(".")
        flipped = ("A" if signature[0] != "A" else "B") + signature[1:]
        assert auth.valid(f"{payload}.{flipped}", lock) is False

    def test_a_tampered_payload_is_refused(self, monkeypatch):
        # The interesting case: a forged expiry is exactly what a signature is
        # for, so extending one must fail rather than being believed.
        lock = locked(monkeypatch)
        payload, signature = auth.issue(lock).split(".")
        forged = auth._b64(b'{"v": 1, "exp": 99999999999}')
        assert auth.valid(f"{forged}.{signature}", lock) is False

    def test_rubbish_is_refused_without_raising(self, monkeypatch):
        lock = locked(monkeypatch)
        for token in [None, "", "no-dot", "a.b", "....", "%%%.%%%"]:
            assert auth.valid(token, lock) is False

    def test_an_expired_token_is_refused(self, monkeypatch):
        lock = locked(monkeypatch)
        monkeypatch.setattr(time, "time", lambda: 0.0)
        token = auth.issue(lock, days=1)
        monkeypatch.undo()
        assert auth.valid(token, lock) is False

    def test_a_kiosk_token_outlives_a_normal_one(self, monkeypatch):
        lock = locked(monkeypatch)
        assert auth.valid(auth.issue(lock, auth.KIOSK_DAYS), lock) is True
        assert auth.KIOSK_DAYS > auth.SESSION_DAYS * 100

    def test_changing_the_password_revokes_every_session(self, monkeypatch):
        # No session table, and this is why: revocation falls out of deriving
        # the signing key from the stored hash.
        old = locked(monkeypatch, "hunter2")
        token = auth.issue(old)
        new = locked(monkeypatch, "different")
        assert auth.valid(token, old) is True
        assert auth.valid(token, new) is False

    def test_two_installs_with_the_same_password_do_not_share_sessions(self):
        # Different salts mean different hashes mean different signing keys.
        one = auth.Lock(auth.hash_password("hunter2"), "dashboard")
        two = auth.Lock(auth.hash_password("hunter2"), "dashboard")
        assert auth.valid(auth.issue(one), two) is False


class TestTheGate:
    def test_a_locked_install_refuses_an_api_request(self, monkeypatch):
        locked(monkeypatch)
        assert auth.allows("/api/bot/status", None) is False
        assert auth.allows("/api/setup/backup", None) is False

    def test_a_valid_session_gets_through(self, monkeypatch):
        lock = locked(monkeypatch)
        assert auth.allows("/api/setup/backup", auth.issue(lock)) is True

    def test_the_two_open_doors_stay_open(self, monkeypatch):
        locked(monkeypatch)
        assert auth.allows("/api/auth", None) is True
        assert auth.allows("/api/auth/login", None) is True

    def test_the_other_auth_routes_are_not_open(self, monkeypatch):
        locked(monkeypatch)
        assert auth.allows("/api/auth/logout", None) is False
        assert auth.allows("/api/auth/password", None) is False

    def test_a_trailing_slash_does_not_open_a_door(self, monkeypatch):
        locked(monkeypatch)
        assert auth.allows("/api/auth/", None) is True       # the same door
        assert auth.allows("/api/settings/", None) is False  # not one

    def test_the_bundle_is_never_gated(self, monkeypatch):
        # nginx serves it in the shipped deployment, and a bundle is public
        # bytes in any browser regardless.
        locked(monkeypatch)
        for path in ["/", "/index.html", "/assets/index-abc.js", "/#tank"]:
            assert auth.allows(path, None) is True

    def test_a_path_that_merely_starts_with_api_is_still_gated(self, monkeypatch):
        locked(monkeypatch)
        assert auth.allows("/api/auth-something/else", None) is False


class TestRefusingWithoutRemembering:
    @pytest.fixture(autouse=True)
    def clean_counter(self):
        auth._tries.clear()
        yield
        auth._tries.clear()

    def test_the_first_few_tries_are_free(self):
        for _ in range(auth._MAX_TRIES - 1):
            auth.note_failure("10.0.0.5")
        assert auth.blocked_for("10.0.0.5") == 0

    def test_enough_failures_start_a_wait(self):
        for _ in range(auth._MAX_TRIES):
            auth.note_failure("10.0.0.5")
        assert auth.blocked_for("10.0.0.5") > 0

    def test_the_wait_doubles_and_then_stops(self):
        for _ in range(40):
            auth.note_failure("10.0.0.5")
        assert auth.blocked_for("10.0.0.5") <= auth._LOCKOUT_CAP

    def test_a_success_clears_it(self):
        for _ in range(auth._MAX_TRIES):
            auth.note_failure("10.0.0.5")
        auth.note_success("10.0.0.5")
        assert auth.blocked_for("10.0.0.5") == 0

    def test_one_address_does_not_lock_out_another(self):
        for _ in range(auth._MAX_TRIES):
            auth.note_failure("10.0.0.5")
        assert auth.blocked_for("10.0.0.9") == 0

    def test_nothing_survives_a_restart(self):
        # In-process on purpose: a lockout that outlived the container is a way
        # to be permanently locked out of your own Pi.
        for _ in range(40):
            auth.note_failure("10.0.0.5")
        auth._tries.clear()  # what a restart is, to this module
        assert auth.blocked_for("10.0.0.5") == 0

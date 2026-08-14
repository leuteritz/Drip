"""Signing in, and the one place that writes the password.

`routers/setup.py` is the only writer of credentials; this is the only writer of
`Credentials.password_hash`, for the same reason. What the module refuses and
why it refuses it lives in `auth.py` — this is the door, not the lock.

Refusals are sentences the dialog prints as-is, `backup.RestoreError`'s rule: a
person who has just mistyped a password needs to be told which of the two things
went wrong, not given a status code.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import Session

from .. import auth
from ..database import get_session
from ..schemas import AuthState, LoginRequest, PasswordUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _who(request: Request) -> str:
    """Who is being rate-limited. The client address, or nothing to go on."""
    return request.client.host if request.client else "unknown"


def _set_cookie(response: Response, token: str, days: int) -> None:
    """The session cookie, and the two decisions in it that look like bugs.

    **No `secure`**: Drip is served over plain HTTP on a LAN, and `secure` means
    the browser never stores the cookie at all — the login would appear to
    succeed and silently never take. **`samesite="lax"` rather than `strict`**:
    `strict` drops the cookie when the dashboard is opened from a link somewhere
    else, and the Pi's address arriving in a Discord message is a real way people
    open this. `lax` still blocks the cross-site POST/DELETE that is the whole
    of the CSRF surface here.
    """
    response.set_cookie(
        auth.COOKIE,
        token,
        max_age=days * 86400,
        httponly=True,
        samesite="lax",
        path="/",
    )


def _state(request: Request) -> dict:
    lock = auth.current()
    return {
        "required": lock.required,
        "authenticated": not lock.required
        or auth.valid(request.cookies.get(auth.COOKIE), lock),
        "source": lock.source,
    }


@router.get("", response_model=AuthState)
def state(request: Request):
    """Whether there is a lock, and whether this browser is past it.

    Open, and it has to be: you cannot ask whether a door is locked from behind
    it. It says nothing a stranger could not learn by trying a request.
    """
    return _state(request)


@router.post("/login", response_model=AuthState)
def login(body: LoginRequest, request: Request, response: Response):
    """Trade a password for a session cookie."""
    lock = auth.current()
    if not lock.required:
        # Nothing to sign in to. Not an error: an install with no password is a
        # supported install, and the frontend never shows the screen anyway.
        return _state(request)

    who = _who(request)
    wait = auth.blocked_for(who)
    if wait:
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Try again in {max(wait // 60, 1)} minute"
                   f"{'s' if wait >= 120 else ''}.",
            headers={"Retry-After": str(wait)},
        )

    if not auth.verify_password(body.password, lock.hash):
        auth.note_failure(who)
        logger.warning("Failed sign-in from %s", who)
        raise HTTPException(status_code=401, detail="That is not the password.")

    auth.note_success(who)
    days = auth.KIOSK_DAYS if body.stay else auth.SESSION_DAYS
    _set_cookie(response, auth.issue(lock, days), days)
    return {"required": True, "authenticated": True, "source": lock.source}


@router.post("/logout", response_model=AuthState)
def logout(response: Response):
    """Drop this browser's session. The password is untouched."""
    response.delete_cookie(auth.COOKIE, path="/")
    lock = auth.current()
    return {"required": lock.required, "authenticated": not lock.required,
            "source": lock.source}


@router.put("/password", response_model=AuthState)
def set_password(
    body: PasswordUpdate,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
):
    """Set, change or remove the password.

    An empty `new` removes the lock — the dialog asks twice before sending that,
    with what it costs in the question. Changing it invalidates every other
    session by construction (`auth.Lock.signing_key`), so this hands back a fresh
    cookie: the browser standing in the dialog that just set the password must
    not be the first thing locked out by it.
    """
    lock = auth.current()
    if lock.required and not auth.verify_password(body.current, lock.hash):
        raise HTTPException(status_code=401, detail="That is not the current password.")
    if body.new and len(body.new) < 6:
        raise HTTPException(
            status_code=400,
            detail="Use at least six characters — this is the only thing in front of your keys.",
        )

    updated = auth.set_password(session, body.new)
    if not updated.required:
        response.delete_cookie(auth.COOKIE, path="/")
        return {"required": False, "authenticated": True, "source": updated.source}

    _set_cookie(response, auth.issue(updated), auth.SESSION_DAYS)
    return {"required": True, "authenticated": True, "source": updated.source}

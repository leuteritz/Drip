"""SQLite engine and session handling."""
from sqlmodel import Session, SQLModel, create_engine

from .config import DATA_DIR
from .models import BotSettings, Credentials, DigestSettings

DATA_DIR.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    f"sqlite:///{DATA_DIR / 'bot.db'}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    # Create default settings on first start
    with Session(engine) as session:
        if session.get(BotSettings, 1) is None:
            session.add(BotSettings(id=1))
            session.commit()


def get_session():
    with Session(engine) as session:
        yield session


def load_settings(session: Session) -> BotSettings:
    settings = session.get(BotSettings, 1)
    if settings is None:
        settings = BotSettings(id=1)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


def load_credentials(session: Session) -> Credentials:
    """The credentials singleton (id=1), created on first access.

    Blank on a fresh row, which is what makes `backend/.env` the fallback rather
    than something this row overrides — see `credentials.py`.
    """
    row = session.get(Credentials, 1)
    if row is None:
        row = Credentials(id=1)
        session.add(row)
        session.commit()
        session.refresh(row)
    return row


def load_digest_settings(session: Session) -> DigestSettings:
    """The digest's singleton row (id=1), created on first access.

    Created here rather than in `init_db` as well, so an existing database that
    only just gained the table gets its defaults the first time anything asks.
    """
    settings = session.get(DigestSettings, 1)
    if settings is None:
        settings = DigestSettings(id=1)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings

"""SQLite-Engine und Session-Handling"""
from sqlmodel import Session, SQLModel, create_engine, select

from .config import DATA_DIR
from .models import BotSettings

DATA_DIR.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    f"sqlite:///{DATA_DIR / 'bot.db'}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    # Default-Settings anlegen, falls noch keine existieren
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

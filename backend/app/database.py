"""SQLite engine, session handling, and the one small migration there is."""
import logging

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from .config import DATA_DIR
from .models import BotSettings, Credentials, DigestSettings

logger = logging.getLogger(__name__)

DATA_DIR.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    f"sqlite:///{DATA_DIR / 'bot.db'}",
    connect_args={"check_same_thread": False},
)


def _sql_literal(value: object) -> str | None:
    """A model default as SQLite would write it, or None if it has none.

    Only the scalar kinds a settings column can hold. Anything else — a
    callable default, a pydantic sentinel meaning "required", a list — returns
    None and the column is added nullable instead of guessed at.
    """
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return None


def _column_ddl(model: type, column) -> str:
    """`"name" TYPE DEFAULT x` for one column, taking the default from the model.

    The default has to come from the pydantic field rather than the SQLAlchemy
    column: SQLModel keeps a field default on the class and does not push it
    into the table, so the column alone cannot say what a fresh install would
    have had here.
    """
    ddl = f'"{column.name}" {column.type.compile(engine.dialect)}'
    field = getattr(model, "model_fields", {}).get(column.name)
    literal = _sql_literal(getattr(field, "default", None))
    if literal is not None:
        ddl += f" DEFAULT {literal}"
    return ddl


def _migrate_columns() -> None:
    """Add the columns `create_all` cannot.

    `SQLModel.metadata.create_all` creates tables that do not exist yet and then
    leaves every table that does entirely alone — so a field added to an
    existing model never reaches an install that has already run once. That is
    the whole reason the digest's settings and the credentials are tables of
    their own rather than columns on `BotSettings`: a new *table* does get
    created, and it used to be the only way a new setting could arrive at all.

    This is the ordinary answer instead: compare every mapped table against what
    SQLite actually holds, and `ALTER TABLE ADD COLUMN` the difference with the
    model's own default written in, so the rows already there read the same
    value a fresh install would. A field with no usable default lands nullable,
    because there is no honest value to give existing rows.

    Deliberately only that one operation. SQLite can append a column; dropping,
    renaming or re-typing one means rebuilding the table, and a bot that holds
    somebody's purchase history should not be rewriting tables behind their
    back. A removed field simply stays in the file, unread.

    Idempotent: on an up-to-date database it inspects and does nothing.
    """
    tables = set(inspect(engine).get_table_names())

    for mapper in SQLModel._sa_registry.mappers:
        table = mapper.local_table
        if table is None or table.name not in tables:
            continue

        have = {c["name"] for c in inspect(engine).get_columns(table.name)}
        missing = [c for c in table.columns if c.name not in have]
        if not missing:
            continue

        with engine.begin() as conn:
            for column in missing:
                ddl = _column_ddl(mapper.class_, column)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN {ddl}'))
                logger.info("Migration: added %s.%s", table.name, ddl)

        # An index declared alongside a column is created with the table, so a
        # column that arrives later arrives without it.
        known = {i["name"] for i in inspect(engine).get_indexes(table.name)}
        with engine.begin() as conn:
            for index in table.indexes:
                if index.name not in known:
                    index.create(conn)
                    logger.info("Migration: created index %s", index.name)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _migrate_columns()
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

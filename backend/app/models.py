"""SQLModel-Tabellen: Kaeufe, Bot-Einstellungen, Candle-Cache"""
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
    schedule_weekday: int = 0  # 0 = Montag ... 6 = Sonntag
    schedule_time: str = "09:00"
    dry_run: bool = True
    paused_until: Optional[date] = None
    discord_enabled: bool = True


class Candle(SQLModel, table=True):
    day: date = Field(primary_key=True)
    open: float
    high: float
    low: float
    close: float
    volume: float

"""Coinbase-Zugriff.

Marktdaten (Preis, Candles) laufen ueber die oeffentlichen Brokerage-Endpunkte
ohne API-Key - so funktionieren Dashboard und Dry-Run auch ohne Credentials.
Nur echte Kaeufe brauchen den authentifizierten SDK-Client.
"""
import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

import requests
from sqlmodel import Session, select

from .config import config
from .models import Candle

logger = logging.getLogger(__name__)

PUBLIC_API = "https://api.coinbase.com/api/v3/brokerage/market"
PRODUCT_ID = "BTC-EUR"
MAX_CANDLES_PER_REQUEST = 300  # API-Limit ist 350, mit Puffer


class CoinbaseError(Exception):
    pass


def get_current_price() -> float:
    """Aktueller BTC-EUR Preis (oeffentlicher Endpunkt)"""
    resp = requests.get(f"{PUBLIC_API}/products/{PRODUCT_ID}", timeout=15)
    resp.raise_for_status()
    return float(resp.json()["price"])


def _fetch_daily_candles(start: datetime, end: datetime) -> list[dict]:
    resp = requests.get(
        f"{PUBLIC_API}/products/{PRODUCT_ID}/candles",
        params={
            "start": int(start.timestamp()),
            "end": int(end.timestamp()),
            "granularity": "ONE_DAY",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("candles", [])


def ensure_candles(session: Session, days: int) -> list[Candle]:
    """Liefert Tages-Candles der letzten `days` Tage; fehlende werden von
    Coinbase geholt und in SQLite gecacht."""
    today = datetime.now(timezone.utc).date()
    start_day = today - timedelta(days=days)

    cached = {
        c.day: c
        for c in session.exec(select(Candle).where(Candle.day >= start_day)).all()
    }
    # Heutiger Candle aendert sich laufend -> immer neu holen
    missing_from = start_day
    have_days = sorted(d for d in cached if d < today)
    if have_days:
        # Nur den Bereich nach dem letzten gecachten Tag nachladen,
        # sofern der Cache am Anfang lueckenlos beginnt
        if have_days[0] <= start_day + timedelta(days=1):
            missing_from = have_days[-1]

    fetch_start = datetime.combine(missing_from, time.min, tzinfo=timezone.utc)
    fetch_end = datetime.now(timezone.utc)

    cursor = fetch_start
    while cursor < fetch_end:
        chunk_end = min(cursor + timedelta(days=MAX_CANDLES_PER_REQUEST), fetch_end)
        try:
            raw = _fetch_daily_candles(cursor, chunk_end)
        except requests.RequestException as exc:
            logger.warning("Candle-Abruf fehlgeschlagen: %s", exc)
            break
        for entry in raw:
            day = datetime.fromtimestamp(int(entry["start"]), tz=timezone.utc).date()
            candle = Candle(
                day=day,
                open=float(entry["open"]),
                high=float(entry["high"]),
                low=float(entry["low"]),
                close=float(entry["close"]),
                volume=float(entry["volume"]),
            )
            session.merge(candle)
        cursor = chunk_end
    session.commit()

    result = session.exec(
        select(Candle).where(Candle.day >= start_day).order_by(Candle.day)
    ).all()
    return list(result)


def place_market_buy(amount_eur: float) -> tuple[str, str]:
    """Fuehrt echten Market-Buy aus. Rueckgabe: (order_id, status).
    Wirft CoinbaseError bei Fehlern."""
    if not config.has_coinbase_credentials:
        raise CoinbaseError(
            "Keine Coinbase-Credentials in backend/.env konfiguriert "
            "(COINBASE_API_KEY / COINBASE_API_SECRET)"
        )

    from coinbase.rest import RESTClient

    client = RESTClient(
        api_key=config.coinbase_api_key,
        api_secret=config.api_secret_normalized,
    )
    order = client.market_order_buy(
        client_order_id=str(uuid.uuid4()),
        product_id=PRODUCT_ID,
        quote_size=f"{amount_eur:.2f}",
    )

    # CreateOrderResponse ist ein Objekt, kein Dict (Bug im Altcode)
    if getattr(order, "success", False):
        success = order.success_response
        order_id = getattr(success, "order_id", None) or (
            success.get("order_id") if isinstance(success, dict) else "unbekannt"
        )
        return str(order_id), "Erfolgreich"

    error = getattr(order, "error_response", None)
    raise CoinbaseError(f"Order fehlgeschlagen: {error}")

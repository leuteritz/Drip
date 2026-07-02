"""Shared CSV import logic for the legacy bitcoin_purchases.csv format.

Used by both the CLI script (scripts/import_csv.py) and the upload endpoint
(routers/purchases.py) so the parsing/dedup rules live in exactly one place.
"""
import csv
from datetime import datetime

from sqlmodel import Session, select

from .models import Purchase
from .strategy import determine_purchase_strategy

# The legacy bot logged German status values
STATUS_MAP = {"Erfolgreich": "Success", "Test": "Test"}


def import_purchases_csv(session: Session, text: str, include_errors: bool) -> dict:
    """Parses the legacy CSV text and inserts new Purchase rows.

    - Dedups by exact timestamp (existing rows are skipped).
    - Derives the multiplier from the score (legacy CSV never logged it).
    - ERROR rows are skipped unless ``include_errors`` is True.
    - Malformed rows are collected in ``errors`` instead of failing the import.
    """
    imported = skipped = 0
    errors: list[dict] = []

    reader = csv.reader(text.splitlines())
    rows = list(reader)
    total = 0

    for idx, row in enumerate(rows):
        # Skip the header row (first line, matched by its label)
        if idx == 0 and row and row[0].strip().lower() in {"timestamp", "zeitstempel"}:
            continue
        if not row or not any(cell.strip() for cell in row):
            continue  # blank line

        total += 1
        line_no = idx + 1

        if len(row) < 9:
            errors.append({"line": line_no, "message": f"Only {len(row)} columns, expected 10"})
            continue
        # Some legacy rows have 9 columns (missing order id)
        if len(row) == 9:
            row = row[:8] + ["", row[8]]

        (ts, price, amount, btc, fng, rsi, ma, score, order_id, status) = row[:10]

        if order_id == "ERROR" and not include_errors:
            skipped += 1
            continue

        try:
            timestamp = datetime.strptime(ts.strip(), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            errors.append({"line": line_no, "message": f"Invalid timestamp: {ts!r}"})
            continue

        exists = session.exec(
            select(Purchase).where(Purchase.timestamp == timestamp)
        ).first()
        if exists:
            skipped += 1
            continue

        try:
            score_int = int(float(score))
            purchase = Purchase(
                timestamp=timestamp,
                price_eur=float(price),
                amount_eur=float(amount),
                btc_amount=float(btc),
                fear_greed=int(float(fng)),
                rsi=float(rsi),
                ma_350=float(ma),
                score=score_int,
                # The legacy format did not log the multiplier -> derive from score
                multiplier=determine_purchase_strategy(score_int)["multiplier"],
                order_id=order_id,
                status=STATUS_MAP.get(status.strip(), status.strip()),
                dry_run=(status.strip().lower() == "test" or order_id == "DRY_RUN"),
            )
        except ValueError as exc:
            errors.append({"line": line_no, "message": f"Could not parse numbers: {exc}"})
            continue

        session.add(purchase)
        imported += 1

    session.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors, "total": total}

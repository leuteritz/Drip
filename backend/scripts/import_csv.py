"""Importiert die alte legacy/bitcoin_purchases.csv in die SQLite-Datenbank.

Aufruf (aus dem backend/-Ordner):
    python scripts/import_csv.py [--include-errors] [pfad/zur/datei.csv]
"""
import csv
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select

from app.database import engine, init_db
from app.models import Purchase
from app.strategy import determine_purchase_strategy


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    include_errors = "--include-errors" in sys.argv

    csv_path = Path(args[0]) if args else (
        Path(__file__).resolve().parent.parent.parent / "legacy" / "bitcoin_purchases.csv"
    )
    if not csv_path.exists():
        print(f"CSV nicht gefunden: {csv_path}")
        sys.exit(1)

    init_db()
    imported = skipped = 0

    with Session(engine) as session, open(csv_path, encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # Header
        for row in reader:
            if len(row) < 9:
                continue
            # Manche Alt-Zeilen haben 9 Spalten (Order_ID fehlt)
            if len(row) == 9:
                row = row[:8] + ["", row[8]]

            (ts, price, amount, btc, fng, rsi, ma, score, order_id, status) = row[:10]

            if order_id == "ERROR" and not include_errors:
                skipped += 1
                continue

            timestamp = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
            exists = session.exec(
                select(Purchase).where(Purchase.timestamp == timestamp)
            ).first()
            if exists:
                skipped += 1
                continue

            session.add(Purchase(
                timestamp=timestamp,
                price_eur=float(price),
                amount_eur=float(amount),
                btc_amount=float(btc),
                fear_greed=int(float(fng)),
                rsi=float(rsi),
                ma_350=float(ma),
                score=int(float(score)),
                # Multiplikator wurde im Altformat nicht geloggt -> aus Score ableiten
                multiplier=determine_purchase_strategy(int(float(score)))["multiplier"],
                order_id=order_id,
                status=status,
                dry_run=(status.strip().lower() == "test" or order_id == "DRY_RUN"),
            ))
            imported += 1
        session.commit()

    print(f"Import fertig: {imported} uebernommen, {skipped} uebersprungen")


if __name__ == "__main__":
    main()

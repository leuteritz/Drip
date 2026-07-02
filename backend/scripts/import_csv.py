"""Imports the old bitcoin_purchases.csv (legacy bot format) into SQLite.

Usage (from the backend/ folder):
    python scripts/import_csv.py [--include-errors] [path/to/file.csv]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session

from app.csv_import import import_purchases_csv
from app.database import engine, init_db


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    include_errors = "--include-errors" in sys.argv

    csv_path = Path(args[0]) if args else (
        Path(__file__).resolve().parent.parent / "data" / "bitcoin_purchases.csv"
    )
    if not csv_path.exists():
        print(f"CSV not found: {csv_path}")
        sys.exit(1)

    init_db()

    text = csv_path.read_text(encoding="utf-8-sig")
    with Session(engine) as session:
        result = import_purchases_csv(session, text, include_errors)

    print(f"Import done: {result['imported']} imported, {result['skipped']} skipped")
    if result["errors"]:
        print(f"{len(result['errors'])} rows had errors:")
        for err in result["errors"]:
            print(f"  line {err['line']}: {err['message']}")


if __name__ == "__main__":
    main()

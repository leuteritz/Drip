import csv
import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session, select

from .. import csv_import
from ..database import get_session
from ..models import Purchase
from ..schemas import DeleteResponse, ImportResponse, PurchaseResponse

router = APIRouter(prefix="/api/purchases", tags=["purchases"])


@router.get("", response_model=list[PurchaseResponse])
def list_purchases(session: Session = Depends(get_session)):
    stmt = select(Purchase).order_by(Purchase.timestamp.desc())
    return session.exec(stmt).all()


@router.get("/export")
def export_purchases(session: Session = Depends(get_session)):
    """Download the full history as a CSV that re-imports cleanly."""
    rows = session.exec(select(Purchase).order_by(Purchase.timestamp)).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    # The first ten columns are the legacy format and stay in that order, so a
    # file from here still reads anywhere the old one did. Fee and Filled are
    # appended rather than slotted in for the same reason — an older reader
    # ignores them, and Drip's own importer picks them up when they are there.
    writer.writerow(
        ["Timestamp", "Price", "Amount", "BTC", "FearGreed", "RSI", "MA350",
         "Score", "OrderID", "Status", "Fee", "Filled"]
    )
    for p in rows:
        writer.writerow([
            p.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            p.price_eur,
            p.amount_eur,
            p.btc_amount,
            p.fear_greed,
            p.rsi,
            p.ma_350,
            p.score,
            p.order_id,
            p.status,
            p.fee_eur,
            int(p.filled),
        ])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=drip_purchases.csv"},
    )


@router.post("/import", response_model=ImportResponse)
async def import_purchases(
    file: UploadFile = File(...),
    include_errors: bool = Form(True),
    session: Session = Depends(get_session),
):
    """Bulk-import purchases from a legacy bitcoin_purchases.csv upload."""
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File is not valid UTF-8 text")
    return csv_import.import_purchases_csv(session, text, include_errors)


def _delete_matching(session: Session, stmt) -> dict:
    """Deletes every Purchase the statement selects and reports the count."""
    rows = session.exec(stmt).all()
    for row in rows:
        session.delete(row)
    session.commit()
    return {"deleted": len(rows)}


@router.delete("", response_model=DeleteResponse)
def delete_all_purchases(session: Session = Depends(get_session)):
    """Delete every entry from the history."""
    return _delete_matching(session, select(Purchase))


@router.delete("/test-runs", response_model=DeleteResponse)
def delete_test_runs(session: Session = Depends(get_session)):
    """Delete every dry-run entry from the history."""
    return _delete_matching(
        session, select(Purchase).where(Purchase.dry_run == True)  # noqa: E712
    )


@router.delete("/{purchase_id}", response_model=DeleteResponse)
def delete_purchase(purchase_id: int, session: Session = Depends(get_session)):
    """Delete a single history entry."""
    purchase = session.get(Purchase, purchase_id)
    if purchase is None:
        raise HTTPException(status_code=404, detail="Purchase not found")
    session.delete(purchase)
    session.commit()
    return {"deleted": 1}

import csv
import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session, select

from .. import csv_import
from ..database import get_session
from ..models import Purchase

router = APIRouter(prefix="/api/purchases", tags=["purchases"])


@router.get("")
def list_purchases(session: Session = Depends(get_session)):
    stmt = select(Purchase).order_by(Purchase.timestamp.desc())
    return session.exec(stmt).all()


@router.get("/export")
def export_purchases(session: Session = Depends(get_session)):
    """Download the full history as a CSV that re-imports cleanly."""
    rows = session.exec(select(Purchase).order_by(Purchase.timestamp)).all()
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["Timestamp", "Price", "Amount", "BTC", "FearGreed", "RSI", "MA350",
         "Score", "OrderID", "Status"]
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
        ])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=drip_purchases.csv"},
    )


@router.post("/import")
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


@router.delete("")
def delete_all_purchases(session: Session = Depends(get_session)):
    """Delete every entry from the history."""
    rows = session.exec(select(Purchase)).all()
    for row in rows:
        session.delete(row)
    session.commit()
    return {"deleted": len(rows)}


@router.delete("/test-runs")
def delete_test_runs(session: Session = Depends(get_session)):
    """Delete every dry-run entry from the history."""
    rows = session.exec(select(Purchase).where(Purchase.dry_run == True)).all()  # noqa: E712
    for row in rows:
        session.delete(row)
    session.commit()
    return {"deleted": len(rows)}


@router.delete("/{purchase_id}")
def delete_purchase(purchase_id: int, session: Session = Depends(get_session)):
    """Delete a single history entry."""
    purchase = session.get(Purchase, purchase_id)
    if purchase is None:
        raise HTTPException(status_code=404, detail="Purchase not found")
    session.delete(purchase)
    session.commit()
    return {"deleted": 1}

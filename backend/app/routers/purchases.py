from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..database import get_session
from ..models import Purchase

router = APIRouter(prefix="/api/purchases", tags=["purchases"])


@router.get("")
def list_purchases(session: Session = Depends(get_session)):
    stmt = select(Purchase).order_by(Purchase.timestamp.desc())
    return session.exec(stmt).all()

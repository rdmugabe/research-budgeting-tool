from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import PriceMasterVersion, Procedure
from app.schemas.price_master import PriceMasterVersionRead, PriceMasterVersionDetail

router = APIRouter(prefix="/price-master", tags=["price-master"])


@router.get("/versions", response_model=list[PriceMasterVersionRead])
def list_versions(db: Session = Depends(get_db)):
    return (
        db.query(PriceMasterVersion)
        .order_by(PriceMasterVersion.created_at.desc())
        .all()
    )


@router.get("/versions/{version_id}", response_model=PriceMasterVersionDetail)
def get_version(version_id: int, db: Session = Depends(get_db)):
    version = (
        db.query(PriceMasterVersion)
        .options(joinedload(PriceMasterVersion.procedures).joinedload(Procedure.price))
        .filter(PriceMasterVersion.id == version_id)
        .first()
    )
    if not version:
        raise HTTPException(404, "Price master version not found")
    return version

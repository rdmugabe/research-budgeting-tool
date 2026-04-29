from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import (
    PriceMasterVersion,
    Procedure,
    ProcedurePrice,
    FixedFeeTemplate,
    FixedFee,
    FixedFeeKind,
)
from app.schemas.price_master import (
    PriceMasterVersionRead,
    PriceMasterVersionDetail,
    PriceMasterVersionCreate,
    ProcedureRead,
    ProcedureWrite,
    FixedFeeRead,
    FixedFeeWrite,
    FixedFeeTemplateRead,
    FixedFeeTemplateDetail,
)
from app.services import audit

router = APIRouter(prefix="/price-master", tags=["price-master"])


# ---------- Versions ----------

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


@router.post("/versions", response_model=PriceMasterVersionDetail)
def create_version(payload: PriceMasterVersionCreate, db: Session = Depends(get_db)):
    """Create a new (draft) price master version. Optionally clone procedures
    from an existing version so the user starts from a populated baseline.
    """
    new_version = PriceMasterVersion(
        label=payload.label,
        effective_date=payload.effective_date or date.today(),
        notes=payload.notes,
        is_published=False,
    )
    db.add(new_version)
    db.flush()

    if payload.clone_from_version_id:
        src = (
            db.query(PriceMasterVersion)
            .options(joinedload(PriceMasterVersion.procedures).joinedload(Procedure.price))
            .filter(PriceMasterVersion.id == payload.clone_from_version_id)
            .first()
        )
        if not src:
            raise HTTPException(404, "Source version not found")
        for p in src.procedures:
            np = Procedure(
                version_id=new_version.id,
                code=p.code,
                name=p.name,
                category=p.category,
                coverage_status=p.coverage_status,
                cpt_code=p.cpt_code,
            )
            np.price = ProcedurePrice(
                medicare_rate=p.price.medicare_rate,
                amc_base_charge=p.price.amc_base_charge,
                overhead_pct=p.price.overhead_pct,
                excluded_from_oh=p.price.excluded_from_oh,
                sponsor_share=p.price.sponsor_share,
                medicare_share=p.price.medicare_share,
            )
            db.add(np)

    audit.record(
        db,
        entity_type="price_master_version",
        entity_id=new_version.id,
        action="created",
        details=f"label={payload.label!r} clone_from={payload.clone_from_version_id}",
    )
    db.commit()
    db.refresh(new_version)
    return new_version


@router.post("/versions/{version_id}/publish", response_model=PriceMasterVersionRead)
def publish_version(version_id: int, db: Session = Depends(get_db)):
    v = db.get(PriceMasterVersion, version_id)
    if not v:
        raise HTTPException(404, "Price master version not found")
    v.is_published = True
    audit.record(
        db,
        entity_type="price_master_version",
        entity_id=version_id,
        action="published",
        details=f"label={v.label!r}",
    )
    db.commit()
    db.refresh(v)
    return v


# ---------- Procedures within a version ----------

@router.post("/versions/{version_id}/procedures", response_model=ProcedureRead)
def add_procedure(version_id: int, payload: ProcedureWrite, db: Session = Depends(get_db)):
    v = db.get(PriceMasterVersion, version_id)
    if not v:
        raise HTTPException(404, "Price master version not found")
    if v.is_published:
        raise HTTPException(409, "Cannot edit a published version. Clone it first.")
    proc = Procedure(
        version_id=version_id,
        code=payload.code,
        name=payload.name,
        category=payload.category,
        coverage_status=payload.coverage_status,
        cpt_code=payload.cpt_code,
    )
    proc.price = ProcedurePrice(
        medicare_rate=payload.medicare_rate,
        amc_base_charge=payload.amc_base_charge,
        overhead_pct=payload.overhead_pct,
        excluded_from_oh=payload.excluded_from_oh,
        sponsor_share=payload.sponsor_share,
        medicare_share=payload.medicare_share,
    )
    db.add(proc)
    db.commit()
    db.refresh(proc)
    return proc


@router.put(
    "/versions/{version_id}/procedures/{procedure_id}",
    response_model=ProcedureRead,
)
def update_procedure(
    version_id: int,
    procedure_id: int,
    payload: ProcedureWrite,
    db: Session = Depends(get_db),
):
    v = db.get(PriceMasterVersion, version_id)
    if not v:
        raise HTTPException(404, "Price master version not found")
    if v.is_published:
        raise HTTPException(409, "Cannot edit a published version. Clone it first.")
    proc = db.get(Procedure, procedure_id)
    if not proc or proc.version_id != version_id:
        raise HTTPException(404, "Procedure not found in this version")

    proc.code = payload.code
    proc.name = payload.name
    proc.category = payload.category
    proc.coverage_status = payload.coverage_status
    proc.cpt_code = payload.cpt_code
    proc.price.medicare_rate = payload.medicare_rate
    proc.price.amc_base_charge = payload.amc_base_charge
    proc.price.overhead_pct = payload.overhead_pct
    proc.price.excluded_from_oh = payload.excluded_from_oh
    proc.price.sponsor_share = payload.sponsor_share
    proc.price.medicare_share = payload.medicare_share

    audit.record(
        db,
        entity_type="procedure",
        entity_id=procedure_id,
        action="updated",
        details=f"version={version_id} code={payload.code!r} base={payload.amc_base_charge}",
    )
    db.commit()
    db.refresh(proc)
    return proc


@router.delete("/versions/{version_id}/procedures/{procedure_id}")
def delete_procedure(
    version_id: int, procedure_id: int, db: Session = Depends(get_db)
):
    v = db.get(PriceMasterVersion, version_id)
    if not v:
        raise HTTPException(404, "Price master version not found")
    if v.is_published:
        raise HTTPException(409, "Cannot edit a published version. Clone it first.")
    proc = db.get(Procedure, procedure_id)
    if not proc or proc.version_id != version_id:
        raise HTTPException(404, "Procedure not found in this version")
    db.delete(proc)
    db.commit()
    return {"deleted": procedure_id}


# ---------- Fixed fee templates ----------

@router.get("/fixed-fee-templates", response_model=list[FixedFeeTemplateRead])
def list_templates(db: Session = Depends(get_db)):
    return (
        db.query(FixedFeeTemplate)
        .order_by(FixedFeeTemplate.created_at.desc())
        .all()
    )


@router.get("/fixed-fee-templates/{template_id}", response_model=FixedFeeTemplateDetail)
def get_template(template_id: int, db: Session = Depends(get_db)):
    t = (
        db.query(FixedFeeTemplate)
        .options(joinedload(FixedFeeTemplate.fees))
        .filter(FixedFeeTemplate.id == template_id)
        .first()
    )
    if not t:
        raise HTTPException(404, "Template not found")
    return t


@router.put(
    "/fixed-fee-templates/{template_id}/fees/{fee_id}", response_model=FixedFeeRead
)
def update_fee(
    template_id: int,
    fee_id: int,
    payload: FixedFeeWrite,
    db: Session = Depends(get_db),
):
    t = db.get(FixedFeeTemplate, template_id)
    if not t:
        raise HTTPException(404, "Template not found")
    if t.is_published:
        raise HTTPException(409, "Cannot edit a published template. Clone it first.")
    fee = db.get(FixedFee, fee_id)
    if not fee or fee.template_id != template_id:
        raise HTTPException(404, "Fee not found in this template")

    try:
        kind = FixedFeeKind(payload.kind)
    except ValueError:
        raise HTTPException(400, f"Unknown kind: {payload.kind}")

    fee.name = payload.name
    fee.kind = kind
    fee.sponsor_proposed = payload.sponsor_proposed
    fee.site_default = payload.site_default
    fee.frequency = payload.frequency
    fee.sort_order = payload.sort_order
    audit.record(
        db,
        entity_type="fixed_fee",
        entity_id=fee_id,
        action="updated",
        details=f"template={template_id} name={payload.name!r} site_default={payload.site_default}",
    )
    db.commit()
    db.refresh(fee)
    return fee

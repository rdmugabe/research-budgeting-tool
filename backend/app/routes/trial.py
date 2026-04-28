from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    PriceMasterVersion,
    Procedure,
    FixedFeeTemplate,
    Trial,
    TrialSOACell,
    TrialQuantity,
)
from app.schemas.trial import (
    TrialCreate,
    TrialRead,
    SOAUploadResult,
    SOACellRead,
    TrialQuantityRead,
    TrialQuantitiesUpsert,
)
from app.services.soa_parser import parse_soa_bytes, match_against_price_master

router = APIRouter(prefix="/trials", tags=["trials"])


def _latest_price_master(db: Session) -> PriceMasterVersion:
    v = (
        db.query(PriceMasterVersion)
        .filter(PriceMasterVersion.is_published.is_(True))
        .order_by(PriceMasterVersion.created_at.desc())
        .first()
    )
    if not v:
        raise HTTPException(400, "No published price master version exists. Run the seed importer.")
    return v


def _latest_fixed_fee_template(db: Session) -> FixedFeeTemplate:
    t = (
        db.query(FixedFeeTemplate)
        .filter(FixedFeeTemplate.is_published.is_(True))
        .order_by(FixedFeeTemplate.created_at.desc())
        .first()
    )
    if not t:
        raise HTTPException(400, "No published fixed-fee template exists. Run the seed importer.")
    return t


@router.post("", response_model=TrialRead)
def create_trial(payload: TrialCreate, db: Session = Depends(get_db)):
    pmv_id = payload.price_master_version_id or _latest_price_master(db).id
    fft_id = payload.fixed_fee_template_id or _latest_fixed_fee_template(db).id

    trial = Trial(
        name=payload.name,
        sponsor=payload.sponsor,
        protocol_number=payload.protocol_number,
        price_master_version_id=pmv_id,
        fixed_fee_template_id=fft_id,
    )
    db.add(trial)
    db.commit()
    db.refresh(trial)
    return trial


@router.get("", response_model=list[TrialRead])
def list_trials(db: Session = Depends(get_db)):
    return db.query(Trial).order_by(Trial.created_at.desc()).all()


@router.get("/{trial_id}", response_model=TrialRead)
def get_trial(trial_id: int, db: Session = Depends(get_db)):
    trial = db.get(Trial, trial_id)
    if not trial:
        raise HTTPException(404, "Trial not found")
    return trial


@router.post("/{trial_id}/soa", response_model=SOAUploadResult)
async def upload_soa(
    trial_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    trial = db.get(Trial, trial_id)
    if not trial:
        raise HTTPException(404, "Trial not found")

    data = await file.read()
    try:
        parsed = parse_soa_bytes(data)
    except Exception as e:
        raise HTTPException(400, f"Could not parse SOA workbook: {e}")

    # Build code → [(id, name)] map for the trial's pegged price master version.
    procedures_by_code: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for proc in (
        db.query(Procedure)
        .filter(Procedure.version_id == trial.price_master_version_id)
        .all()
    ):
        procedures_by_code[proc.code].append((proc.id, proc.name))

    match = match_against_price_master(parsed, procedures_by_code)

    # Replace any existing cells for this trial — uploading is destructive by design.
    db.query(TrialSOACell).filter(TrialSOACell.trial_id == trial_id).delete()
    db.flush()

    seen: set[tuple[int, str]] = set()
    for m in match.matched_cells:
        key = (m["procedure_id"], m["visit_label"])
        if key in seen:
            continue
        seen.add(key)
        db.add(
            TrialSOACell(
                trial_id=trial_id,
                procedure_id=m["procedure_id"],
                visit_label=m["visit_label"],
            )
        )
    db.commit()

    cells = (
        db.query(TrialSOACell)
        .filter(TrialSOACell.trial_id == trial_id)
        .order_by(TrialSOACell.id)
        .all()
    )

    return SOAUploadResult(
        trial_id=trial_id,
        parsed_trial_name=parsed.trial_name,
        matched_count=len(cells),
        unmatched_codes=match.unmatched_codes,
        cells=[SOACellRead.model_validate(c) for c in cells],
    )


@router.get("/{trial_id}/soa", response_model=list[SOACellRead])
def list_soa_cells(trial_id: int, db: Session = Depends(get_db)):
    if not db.get(Trial, trial_id):
        raise HTTPException(404, "Trial not found")
    return (
        db.query(TrialSOACell)
        .filter(TrialSOACell.trial_id == trial_id)
        .order_by(TrialSOACell.id)
        .all()
    )


@router.put("/{trial_id}/quantities", response_model=list[TrialQuantityRead])
def upsert_quantities(
    trial_id: int,
    payload: TrialQuantitiesUpsert,
    db: Session = Depends(get_db),
):
    if not db.get(Trial, trial_id):
        raise HTTPException(404, "Trial not found")

    existing = {
        q.visit_label: q
        for q in db.query(TrialQuantity).filter(TrialQuantity.trial_id == trial_id).all()
    }
    for q in payload.quantities:
        row = existing.get(q.visit_label)
        if row:
            row.enrolled_count = q.enrolled_count
            row.completion_count = q.completion_count
        else:
            db.add(
                TrialQuantity(
                    trial_id=trial_id,
                    visit_label=q.visit_label,
                    enrolled_count=q.enrolled_count,
                    completion_count=q.completion_count,
                )
            )
    db.commit()

    return (
        db.query(TrialQuantity)
        .filter(TrialQuantity.trial_id == trial_id)
        .order_by(TrialQuantity.visit_label)
        .all()
    )


@router.get("/{trial_id}/quantities", response_model=list[TrialQuantityRead])
def list_quantities(trial_id: int, db: Session = Depends(get_db)):
    if not db.get(Trial, trial_id):
        raise HTTPException(404, "Trial not found")
    return (
        db.query(TrialQuantity)
        .filter(TrialQuantity.trial_id == trial_id)
        .order_by(TrialQuantity.visit_label)
        .all()
    )

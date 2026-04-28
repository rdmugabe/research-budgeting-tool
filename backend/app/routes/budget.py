from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import (
    Trial,
    BudgetRound,
    BudgetRoundOverride,
    Procedure,
    FixedFee,
)
from app.schemas.budget import (
    BudgetRoundCreate,
    BudgetRoundRead,
    OverrideCreate,
    OverrideRead,
    ComputedBudget,
)
from app.services.pricing import compute_budget

router = APIRouter(prefix="/trials/{trial_id}/rounds", tags=["budget-rounds"])


def _get_trial(db: Session, trial_id: int) -> Trial:
    trial = db.get(Trial, trial_id)
    if not trial:
        raise HTTPException(404, "Trial not found")
    return trial


def _get_round(db: Session, trial_id: int, round_id: int) -> BudgetRound:
    rd = (
        db.query(BudgetRound)
        .options(selectinload(BudgetRound.overrides))
        .filter(BudgetRound.id == round_id, BudgetRound.trial_id == trial_id)
        .first()
    )
    if not rd:
        raise HTTPException(404, "Budget round not found")
    return rd


@router.post("", response_model=BudgetRoundRead)
def create_round(trial_id: int, payload: BudgetRoundCreate, db: Session = Depends(get_db)):
    _get_trial(db, trial_id)
    next_num = (
        db.query(func.coalesce(func.max(BudgetRound.round_number), 0))
        .filter(BudgetRound.trial_id == trial_id)
        .scalar()
        + 1
    )
    rd = BudgetRound(
        trial_id=trial_id,
        round_number=next_num,
        label=payload.label,
        notes=payload.notes,
    )
    db.add(rd)
    db.commit()
    db.refresh(rd)
    return rd


@router.get("", response_model=list[BudgetRoundRead])
def list_rounds(trial_id: int, db: Session = Depends(get_db)):
    _get_trial(db, trial_id)
    return (
        db.query(BudgetRound)
        .filter(BudgetRound.trial_id == trial_id)
        .order_by(BudgetRound.round_number)
        .all()
    )


@router.get("/{round_id}", response_model=BudgetRoundRead)
def get_round(trial_id: int, round_id: int, db: Session = Depends(get_db)):
    return _get_round(db, trial_id, round_id)


@router.post("/{round_id}/freeze", response_model=BudgetRoundRead)
def freeze_round(trial_id: int, round_id: int, db: Session = Depends(get_db)):
    rd = _get_round(db, trial_id, round_id)
    rd.is_frozen = True
    db.commit()
    db.refresh(rd)
    return rd


@router.post("/{round_id}/overrides", response_model=OverrideRead)
def add_override(
    trial_id: int,
    round_id: int,
    payload: OverrideCreate,
    db: Session = Depends(get_db),
):
    rd = _get_round(db, trial_id, round_id)
    if rd.is_frozen:
        raise HTTPException(409, "Round is frozen; cannot add overrides")

    if payload.target_kind == "procedure_price":
        if payload.procedure_id is None:
            raise HTTPException(400, "procedure_id required for procedure_price override")
        if not db.get(Procedure, payload.procedure_id):
            raise HTTPException(404, "Procedure not found")
    elif payload.target_kind == "fixed_fee":
        if payload.fixed_fee_id is None:
            raise HTTPException(400, "fixed_fee_id required for fixed_fee override")
        if not db.get(FixedFee, payload.fixed_fee_id):
            raise HTTPException(404, "Fixed fee not found")
    else:
        raise HTTPException(400, f"Unknown target_kind: {payload.target_kind}")

    ov = BudgetRoundOverride(
        round_id=round_id,
        target_kind=payload.target_kind,
        procedure_id=payload.procedure_id,
        fixed_fee_id=payload.fixed_fee_id,
        new_amc_base_charge=payload.new_amc_base_charge,
        new_overhead_pct=payload.new_overhead_pct,
        new_amount=payload.new_amount,
        reason=payload.reason,
    )
    db.add(ov)
    db.commit()
    db.refresh(ov)
    return ov


@router.get("/{round_id}/overrides", response_model=list[OverrideRead])
def list_overrides(trial_id: int, round_id: int, db: Session = Depends(get_db)):
    rd = _get_round(db, trial_id, round_id)
    return rd.overrides


@router.delete("/{round_id}/overrides/{override_id}")
def delete_override(
    trial_id: int, round_id: int, override_id: int, db: Session = Depends(get_db)
):
    rd = _get_round(db, trial_id, round_id)
    if rd.is_frozen:
        raise HTTPException(409, "Round is frozen; cannot delete overrides")
    ov = (
        db.query(BudgetRoundOverride)
        .filter(
            BudgetRoundOverride.id == override_id,
            BudgetRoundOverride.round_id == round_id,
        )
        .first()
    )
    if not ov:
        raise HTTPException(404, "Override not found")
    db.delete(ov)
    db.commit()
    return {"deleted": override_id}


@router.get("/{round_id}/compute", response_model=ComputedBudget)
def compute(trial_id: int, round_id: int, db: Session = Depends(get_db)):
    trial = _get_trial(db, trial_id)
    rd = _get_round(db, trial_id, round_id)
    return compute_budget(db, trial, rd)

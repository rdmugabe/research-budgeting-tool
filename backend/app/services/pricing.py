"""Pricing engine.

Inputs: a trial + one of its budget rounds.
Output: a fully-computed budget — every applicable (procedure × visit) line,
weighted by visit completion counts, with sponsor/medicare split, plus the
fixed-fee + pass-through tables — applying any overrides defined on the round.

Rules:
- AMC total per occurrence = `amc_base × (1 + overhead_pct)`, unless the
  procedure is `excluded_from_oh` (e.g. stipends), in which case OH is skipped.
- For SHARED coverage, the line's total is split using the procedure's
  `sponsor_share` / `medicare_share` (stored values).
- For QCT-Covered, sponsor_share defaults to 0 and Medicare bears the cost.
- For Research-Required, sponsor bears all of it.
- A line's contribution to the trial = `unit_total × completion_count` for that
  visit (default 0 if no quantity row exists yet — keeps the math defensive).
- Overrides on the round can replace `amc_base_charge` and/or `overhead_pct`
  for a procedure, or replace the dollar amount of a fixed fee.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session

from app.models import (
    Trial,
    Procedure,
    ProcedurePrice,
    TrialSOACell,
    TrialQuantity,
    BudgetRound,
    BudgetRoundOverride,
    FixedFee,
    FixedFeeKind,
    CoverageStatus,
)
from app.schemas.budget import (
    ComputedBudget,
    ComputedProcedureLine,
    ComputedVisit,
    ComputedFixedFee,
)


def _round2(x: float) -> float:
    return round(x, 2)


def compute_budget(db: Session, trial: Trial, round_: BudgetRound) -> ComputedBudget:
    # --- Load procedure overrides keyed by procedure_id ---
    overrides_by_proc: dict[int, BudgetRoundOverride] = {}
    overrides_by_fee: dict[int, BudgetRoundOverride] = {}
    for ov in round_.overrides:
        if ov.target_kind == "procedure_price" and ov.procedure_id is not None:
            overrides_by_proc[ov.procedure_id] = ov
        elif ov.target_kind == "fixed_fee" and ov.fixed_fee_id is not None:
            overrides_by_fee[ov.fixed_fee_id] = ov

    # --- Load procedures with prices for the trial's pegged price master ---
    procs = (
        db.query(Procedure)
        .filter(Procedure.version_id == trial.price_master_version_id)
        .all()
    )
    proc_by_id: dict[int, Procedure] = {p.id: p for p in procs}

    # --- Load the SOA cells (procedure × visit) and visit quantities ---
    cells: list[TrialSOACell] = (
        db.query(TrialSOACell).filter(TrialSOACell.trial_id == trial.id).all()
    )
    quantities: dict[str, TrialQuantity] = {
        q.visit_label: q
        for q in db.query(TrialQuantity).filter(TrialQuantity.trial_id == trial.id).all()
    }

    procedure_lines: list[ComputedProcedureLine] = []
    visit_agg: dict[str, dict] = defaultdict(
        lambda: {"line_count": 0, "total": 0.0, "sponsor": 0.0, "medicare": 0.0}
    )

    for cell in cells:
        proc = proc_by_id.get(cell.procedure_id)
        if proc is None or proc.price is None:
            continue
        price: ProcedurePrice = proc.price

        ov = overrides_by_proc.get(proc.id)
        unit_base = price.amc_base_charge if not ov or ov.new_amc_base_charge is None else ov.new_amc_base_charge
        oh_pct = price.overhead_pct if not ov or ov.new_overhead_pct is None else ov.new_overhead_pct

        unit_total = unit_base if price.excluded_from_oh else unit_base * (1 + oh_pct)

        q = quantities.get(cell.visit_label)
        completion_count = q.completion_count if q else 0
        line_total = unit_total * completion_count

        if proc.coverage_status == CoverageStatus.QCT_COVERED:
            sponsor_portion = 0.0
            medicare_portion = line_total
        elif proc.coverage_status == CoverageStatus.RESEARCH_REQUIRED:
            sponsor_portion = line_total
            medicare_portion = 0.0
        else:  # SHARED
            sponsor_portion = line_total * price.sponsor_share
            medicare_portion = line_total * price.medicare_share

        procedure_lines.append(
            ComputedProcedureLine(
                procedure_id=proc.id,
                code=proc.code,
                name=proc.name,
                category=proc.category,
                coverage_status=proc.coverage_status.value,
                visit_label=cell.visit_label,
                unit_amc_base=_round2(unit_base),
                unit_overhead_pct=oh_pct,
                unit_total_with_oh=_round2(unit_total),
                completion_count=completion_count,
                line_total=_round2(line_total),
                sponsor_portion=_round2(sponsor_portion),
                medicare_portion=_round2(medicare_portion),
                overridden=ov is not None,
            )
        )

        agg = visit_agg[cell.visit_label]
        agg["line_count"] += 1
        agg["total"] += line_total
        agg["sponsor"] += sponsor_portion
        agg["medicare"] += medicare_portion

    visits: list[ComputedVisit] = []
    for visit_label, agg in sorted(visit_agg.items()):
        q = quantities.get(visit_label)
        visits.append(
            ComputedVisit(
                visit_label=visit_label,
                enrolled_count=q.enrolled_count if q else 0,
                completion_count=q.completion_count if q else 0,
                line_count=agg["line_count"],
                visit_total=_round2(agg["total"]),
                sponsor_total=_round2(agg["sponsor"]),
                medicare_total=_round2(agg["medicare"]),
            )
        )

    procedures_subtotal = sum(v.visit_total for v in visits)
    sponsor_subtotal = sum(v.sponsor_total for v in visits)
    medicare_subtotal = sum(v.medicare_total for v in visits)

    # --- Fixed fees (site fees + pass-throughs) ---
    fees = (
        db.query(FixedFee)
        .filter(FixedFee.template_id == trial.fixed_fee_template_id)
        .order_by(FixedFee.kind, FixedFee.sort_order, FixedFee.id)
        .all()
    )

    site_fees: list[ComputedFixedFee] = []
    pass_throughs: list[ComputedFixedFee] = []
    site_fees_subtotal = 0.0
    pass_throughs_subtotal = 0.0
    for fee in fees:
        ov = overrides_by_fee.get(fee.id)
        amount = fee.site_default if not ov or ov.new_amount is None else ov.new_amount
        line = ComputedFixedFee(
            fixed_fee_id=fee.id,
            name=fee.name,
            kind=fee.kind.value,
            sponsor_proposed=fee.sponsor_proposed,
            site_amount=_round2(amount),
            frequency=fee.frequency,
            overridden=ov is not None,
        )
        if fee.kind == FixedFeeKind.SITE_FEE:
            site_fees.append(line)
            site_fees_subtotal += amount
        else:
            pass_throughs.append(line)
            pass_throughs_subtotal += amount

    # Site fees and pass-throughs are sponsor-borne in this model.
    sponsor_grand_total = sponsor_subtotal + site_fees_subtotal + pass_throughs_subtotal
    medicare_grand_total = medicare_subtotal
    grand_total = procedures_subtotal + site_fees_subtotal + pass_throughs_subtotal

    return ComputedBudget(
        trial_id=trial.id,
        round_id=round_.id,
        round_label=round_.label,
        round_number=round_.round_number,
        is_frozen=round_.is_frozen,
        visits=visits,
        procedure_lines=procedure_lines,
        site_fees=site_fees,
        pass_throughs=pass_throughs,
        procedures_subtotal=_round2(procedures_subtotal),
        site_fees_subtotal=_round2(site_fees_subtotal),
        pass_throughs_subtotal=_round2(pass_throughs_subtotal),
        grand_total=_round2(grand_total),
        sponsor_grand_total=_round2(sponsor_grand_total),
        medicare_grand_total=_round2(medicare_grand_total),
    )

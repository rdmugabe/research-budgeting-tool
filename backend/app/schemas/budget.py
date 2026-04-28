from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BudgetRoundCreate(BaseModel):
    label: str
    notes: Optional[str] = None


class BudgetRoundRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trial_id: int
    round_number: int
    label: str
    notes: Optional[str]
    is_frozen: bool
    created_at: datetime


class OverrideCreate(BaseModel):
    target_kind: str  # "procedure_price" | "fixed_fee"
    procedure_id: Optional[int] = None
    fixed_fee_id: Optional[int] = None
    new_amc_base_charge: Optional[float] = None
    new_overhead_pct: Optional[float] = None
    new_amount: Optional[float] = None
    reason: Optional[str] = None


class OverrideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    round_id: int
    target_kind: str
    procedure_id: Optional[int]
    fixed_fee_id: Optional[int]
    new_amc_base_charge: Optional[float]
    new_overhead_pct: Optional[float]
    new_amount: Optional[float]
    reason: Optional[str]


# --- Computed budget output ---

class ComputedProcedureLine(BaseModel):
    procedure_id: int
    code: str
    name: str
    category: Optional[str]
    coverage_status: str
    visit_label: str
    unit_amc_base: float
    unit_overhead_pct: float
    unit_total_with_oh: float
    completion_count: int
    line_total: float
    sponsor_portion: float
    medicare_portion: float
    overridden: bool


class ComputedVisit(BaseModel):
    visit_label: str
    enrolled_count: int
    completion_count: int
    line_count: int
    visit_total: float
    sponsor_total: float
    medicare_total: float


class ComputedFixedFee(BaseModel):
    fixed_fee_id: int
    name: str
    kind: str
    sponsor_proposed: Optional[float]
    site_amount: float
    frequency: str
    overridden: bool


class ComputedBudget(BaseModel):
    trial_id: int
    round_id: int
    round_label: str
    round_number: int
    is_frozen: bool

    visits: list[ComputedVisit]
    procedure_lines: list[ComputedProcedureLine]
    site_fees: list[ComputedFixedFee]
    pass_throughs: list[ComputedFixedFee]

    procedures_subtotal: float
    site_fees_subtotal: float
    pass_throughs_subtotal: float
    grand_total: float
    sponsor_grand_total: float
    medicare_grand_total: float

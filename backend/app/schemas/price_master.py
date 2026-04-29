from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.price_master import CoverageStatus


class ProcedurePriceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    medicare_rate: Optional[float]
    amc_base_charge: float
    overhead_pct: float
    excluded_from_oh: bool
    sponsor_share: float
    medicare_share: float
    total_with_oh: float


class ProcedureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    category: Optional[str]
    coverage_status: CoverageStatus
    cpt_code: Optional[str]
    price: ProcedurePriceRead


class PriceMasterVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    effective_date: date
    is_published: bool
    notes: Optional[str]
    created_at: datetime


class PriceMasterVersionDetail(PriceMasterVersionRead):
    procedures: list[ProcedureRead] = []


class PriceMasterVersionCreate(BaseModel):
    label: str
    effective_date: Optional[date] = None
    notes: Optional[str] = None
    clone_from_version_id: Optional[int] = None


class ProcedureWrite(BaseModel):
    code: str
    name: str
    category: Optional[str] = None
    coverage_status: CoverageStatus
    cpt_code: Optional[str] = None
    medicare_rate: Optional[float] = None
    amc_base_charge: float
    overhead_pct: float = 0.40
    excluded_from_oh: bool = False
    sponsor_share: float = 1.0
    medicare_share: float = 0.0


class FixedFeeWrite(BaseModel):
    name: str
    kind: str  # "SITE_FEE" | "PASS_THROUGH"
    sponsor_proposed: Optional[float] = None
    site_default: float
    frequency: str
    sort_order: int = 0


class FixedFeeRead(FixedFeeWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int


class FixedFeeTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    effective_date: date
    is_published: bool
    notes: Optional[str]
    created_at: datetime


class FixedFeeTemplateDetail(FixedFeeTemplateRead):
    fees: list[FixedFeeRead] = []

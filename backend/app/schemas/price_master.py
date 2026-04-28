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

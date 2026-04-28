from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.trial import TrialStatus


class TrialCreate(BaseModel):
    name: str
    sponsor: Optional[str] = None
    protocol_number: Optional[str] = None
    price_master_version_id: Optional[int] = Field(
        default=None,
        description="Defaults to the latest published price-master version.",
    )
    fixed_fee_template_id: Optional[int] = Field(
        default=None,
        description="Defaults to the latest published fixed-fee template.",
    )


class TrialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sponsor: Optional[str]
    protocol_number: Optional[str]
    status: TrialStatus
    price_master_version_id: int
    fixed_fee_template_id: int
    created_at: datetime
    updated_at: datetime


class SOACellRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    procedure_id: int
    visit_label: str


class SOAUploadResult(BaseModel):
    trial_id: int
    parsed_trial_name: Optional[str]
    matched_count: int
    unmatched_codes: list[dict]
    cells: list[SOACellRead]


class TrialQuantityWrite(BaseModel):
    visit_label: str
    enrolled_count: int = 0
    completion_count: int = 0


class TrialQuantityRead(TrialQuantityWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int


class TrialQuantitiesUpsert(BaseModel):
    quantities: list[TrialQuantityWrite]

from __future__ import annotations

import enum
from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    String,
    Float,
    ForeignKey,
    DateTime,
    Date,
    Boolean,
    Enum as SAEnum,
    Integer,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class FixedFeeKind(str, enum.Enum):
    SITE_FEE = "SITE_FEE"
    PASS_THROUGH = "PASS_THROUGH"


class FixedFeeTemplate(Base):
    """Versioned template of standard site fees and pass-through costs.

    These are identical across clients in MVP, so the template applies to every
    trial. Negotiated changes happen via BudgetRoundOverride, not edits here.
    """

    __tablename__ = "fixed_fee_template"

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    fees: Mapped[list["FixedFee"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )


class FixedFee(Base):
    __tablename__ = "fixed_fee"

    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("fixed_fee_template.id"), nullable=False)

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    kind: Mapped[FixedFeeKind] = mapped_column(SAEnum(FixedFeeKind), nullable=False)
    sponsor_proposed: Mapped[Optional[float]] = mapped_column(Float)
    site_default: Mapped[float] = mapped_column(Float, nullable=False)
    frequency: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    template: Mapped[FixedFeeTemplate] = relationship(back_populates="fees")

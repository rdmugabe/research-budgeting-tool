from __future__ import annotations

import enum
from datetime import datetime, date
from typing import Optional

from sqlalchemy import (
    String,
    Integer,
    Float,
    ForeignKey,
    DateTime,
    Date,
    Boolean,
    Enum as SAEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class CoverageStatus(str, enum.Enum):
    QCT_COVERED = "QCT_COVERED"
    RESEARCH_REQUIRED = "RESEARCH_REQUIRED"
    SHARED = "SHARED"


class PriceMasterVersion(Base):
    """Immutable snapshot of all procedures + prices.

    A new version is created whenever the price master is edited and published.
    Trials peg to a specific version so historical budgets stay reproducible.
    """

    __tablename__ = "price_master_version"

    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    procedures: Mapped[list["Procedure"]] = relationship(
        back_populates="version", cascade="all, delete-orphan"
    )


class Procedure(Base):
    """A line item in the price master (procedure / service / personnel role).

    Belongs to exactly one PriceMasterVersion — when a new version is cut, all
    procedures are copied so each version is fully self-contained.
    """

    __tablename__ = "procedure"
    __table_args__ = (
        UniqueConstraint("version_id", "code", "name", name="uq_procedure_version_code_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("price_master_version.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    coverage_status: Mapped[CoverageStatus] = mapped_column(
        SAEnum(CoverageStatus), nullable=False
    )
    cpt_code: Mapped[Optional[str]] = mapped_column(String(20))

    version: Mapped[PriceMasterVersion] = relationship(back_populates="procedures")
    price: Mapped["ProcedurePrice"] = relationship(
        back_populates="procedure", uselist=False, cascade="all, delete-orphan"
    )


class ProcedurePrice(Base):
    """Pricing detail for a procedure.

    AMC base × (1 + overhead_pct) = total inclusive of OH (unless `excluded_from_oh`).
    For SHARED items, sponsor_share + medicare_share should sum to 1.0.
    """

    __tablename__ = "procedure_price"

    id: Mapped[int] = mapped_column(primary_key=True)
    procedure_id: Mapped[int] = mapped_column(
        ForeignKey("procedure.id"), nullable=False, unique=True
    )

    medicare_rate: Mapped[Optional[float]] = mapped_column(Float)
    amc_base_charge: Mapped[float] = mapped_column(Float, nullable=False)
    overhead_pct: Mapped[float] = mapped_column(Float, default=0.40, nullable=False)
    excluded_from_oh: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    sponsor_share: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    medicare_share: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    procedure: Mapped[Procedure] = relationship(back_populates="price")

    @property
    def total_with_oh(self) -> float:
        if self.excluded_from_oh:
            return self.amc_base_charge
        return round(self.amc_base_charge * (1 + self.overhead_pct), 2)

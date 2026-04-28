from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String,
    Integer,
    Float,
    ForeignKey,
    DateTime,
    Boolean,
    Enum as SAEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TrialStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    NEGOTIATING = "NEGOTIATING"
    AWARDED = "AWARDED"
    ARCHIVED = "ARCHIVED"


class Trial(Base):
    """A single client engagement (a clinical trial we're budgeting for)."""

    __tablename__ = "trial"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sponsor: Mapped[Optional[str]] = mapped_column(String(200))
    protocol_number: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[TrialStatus] = mapped_column(
        SAEnum(TrialStatus), default=TrialStatus.DRAFT, nullable=False
    )

    price_master_version_id: Mapped[int] = mapped_column(
        ForeignKey("price_master_version.id"), nullable=False
    )
    fixed_fee_template_id: Mapped[int] = mapped_column(
        ForeignKey("fixed_fee_template.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    soa_cells: Mapped[list["TrialSOACell"]] = relationship(
        back_populates="trial", cascade="all, delete-orphan"
    )
    quantities: Mapped[list["TrialQuantity"]] = relationship(
        back_populates="trial", cascade="all, delete-orphan"
    )
    rounds: Mapped[list["BudgetRound"]] = relationship(  # type: ignore[name-defined]
        back_populates="trial", cascade="all, delete-orphan"
    )


class TrialSOACell(Base):
    """A single (procedure × visit) cell from the client's uploaded SOA.

    Presence in this table = the client marked it applicable (the X in the
    visit grid). Absence = not applicable. Prices are looked up from the
    pegged PriceMasterVersion at compute time.
    """

    __tablename__ = "trial_soa_cell"
    __table_args__ = (
        UniqueConstraint("trial_id", "procedure_id", "visit_label", name="uq_soa_cell"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    trial_id: Mapped[int] = mapped_column(ForeignKey("trial.id"), nullable=False)
    procedure_id: Mapped[int] = mapped_column(ForeignKey("procedure.id"), nullable=False)
    visit_label: Mapped[str] = mapped_column(String(100), nullable=False)

    trial: Mapped[Trial] = relationship(back_populates="soa_cells")


class TrialQuantity(Base):
    """Per-visit quantity assumptions for a trial.

    visit_label uses a controlled set per trial (e.g. V1A, V1B, V1, V2, … EOT, EOS).
    enrolled_count is the total subjects that reach this visit; completion_count
    is how many actually complete it (some visits drop off).
    """

    __tablename__ = "trial_quantity"
    __table_args__ = (
        UniqueConstraint("trial_id", "visit_label", name="uq_trial_quantity_visit"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    trial_id: Mapped[int] = mapped_column(ForeignKey("trial.id"), nullable=False)
    visit_label: Mapped[str] = mapped_column(String(100), nullable=False)
    enrolled_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    trial: Mapped[Trial] = relationship(back_populates="quantities")

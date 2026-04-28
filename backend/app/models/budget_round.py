from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String,
    Integer,
    Float,
    ForeignKey,
    DateTime,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class BudgetRound(Base):
    """A negotiation round snapshot for a trial.

    Round 1 is typically "Sponsor Proposed" (default prices), subsequent rounds
    are counter-offers with overrides. Once frozen, a round is immutable so the
    exported xlsx is always reproducible.
    """

    __tablename__ = "budget_round"
    __table_args__ = (
        UniqueConstraint("trial_id", "round_number", name="uq_round_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    trial_id: Mapped[int] = mapped_column(ForeignKey("trial.id"), nullable=False)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(2000))
    is_frozen: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    trial: Mapped["Trial"] = relationship(back_populates="rounds")  # type: ignore[name-defined]
    overrides: Mapped[list["BudgetRoundOverride"]] = relationship(
        back_populates="round", cascade="all, delete-orphan"
    )


class BudgetRoundOverride(Base):
    """A line-item override applied within a single negotiation round.

    target_kind discriminates what's being overridden:
      - 'procedure_price' → procedure_id is set; new amc_base_charge / oh_pct
      - 'fixed_fee'       → fixed_fee_id is set; new amount
    Stored as nullable columns rather than JSON to keep things queryable.
    """

    __tablename__ = "budget_round_override"

    id: Mapped[int] = mapped_column(primary_key=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("budget_round.id"), nullable=False)

    target_kind: Mapped[str] = mapped_column(String(40), nullable=False)
    procedure_id: Mapped[Optional[int]] = mapped_column(ForeignKey("procedure.id"))
    fixed_fee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("fixed_fee.id"))

    new_amc_base_charge: Mapped[Optional[float]] = mapped_column(Float)
    new_overhead_pct: Mapped[Optional[float]] = mapped_column(Float)
    new_amount: Mapped[Optional[float]] = mapped_column(Float)

    reason: Mapped[Optional[str]] = mapped_column(String(1000))

    round: Mapped[BudgetRound] = relationship(back_populates="overrides")

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AuditLog(Base):
    """Append-only log of meaningful edits across the system.

    user_id is nullable for now (no auth in MVP); will be required once auth lands.
    """

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(Integer)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    details: Mapped[Optional[str]] = mapped_column(String(2000))

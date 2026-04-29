"""Tiny helper to record audit-log entries.

The user_id is plumbed through but stays None until auth lands.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models import AuditLog


def record(
    db: Session,
    *,
    entity_type: str,
    action: str,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    details: Optional[str] = None,
) -> None:
    db.add(
        AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            user_id=user_id,
            details=details,
        )
    )
    # No commit — caller controls the transaction so audit + business write are atomic.

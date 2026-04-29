from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    user_id: Optional[int]
    entity_type: str
    entity_id: Optional[int]
    action: str
    details: Optional[str]

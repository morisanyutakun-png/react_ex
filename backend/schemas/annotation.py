from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class AnnotationCreate(BaseModel):
    segment_id: int
    payload: Dict[str, Any] = Field(default_factory=dict)
    schema_version: str
    created_by: Optional[str] = None


class AnnotationRead(BaseModel):
    id: int
    segment_id: int
    revision: int
    payload: Dict[str, Any]
    schema_version: str
    created_by: Optional[str] = None
    created_at: datetime
    is_latest: bool

    class Config:
        orm_mode = True

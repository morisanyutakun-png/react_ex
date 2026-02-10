from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True)
    segment_id = Column(Integer, ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)
    revision = Column(Integer, nullable=False)
    payload = Column(JSONB, nullable=False, default={})
    schema_version = Column(String, nullable=False)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_latest = Column(Boolean, default=True, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "segment_id": self.segment_id,
            "revision": self.revision,
            "payload": self.payload,
            "schema_version": self.schema_version,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            "is_latest": self.is_latest,
        }

from datetime import datetime

from sqlalchemy import Column, Integer, ForeignKey, SmallInteger, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class GenerationEval(Base):
    __tablename__ = "generation_evals"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("generation_runs.id", ondelete="CASCADE"), nullable=False)
    axes = Column(JSONB, nullable=False, default={})
    overall = Column(SmallInteger, nullable=True)
    notes = Column(Text, nullable=True)
    is_usable = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "run_id": self.run_id,
            "axes": self.axes,
            "overall": self.overall,
            "notes": self.notes,
            "is_usable": self.is_usable,
            "created_at": self.created_at,
        }

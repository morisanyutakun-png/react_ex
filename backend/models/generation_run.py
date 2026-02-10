from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class GenerationRun(Base):
    __tablename__ = "generation_runs"

    id = Column(Integer, primary_key=True)
    rag_run_id = Column(Integer, nullable=True)
    input_params = Column(JSONB, nullable=False, default={})
    retrieved_segment_ids = Column(ARRAY(Integer), nullable=True)
    output_text = Column(Text, nullable=True)
    model_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "rag_run_id": self.rag_run_id,
            "input_params": self.input_params,
            "retrieved_segment_ids": self.retrieved_segment_ids,
            "output_text": self.output_text,
            "model_name": self.model_name,
            "created_at": self.created_at,
        }

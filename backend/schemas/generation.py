from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class GenerationRunCreate(BaseModel):
    input_params: Dict[str, Any] = Field(default_factory=dict)
    retrieved_segment_ids: Optional[List[int]] = None
    output_text: Optional[str] = None
    model_name: Optional[str] = None
    rag_run_id: Optional[int] = None


class GenerationRunRead(BaseModel):
    id: int
    input_params: Dict[str, Any]
    retrieved_segment_ids: Optional[List[int]]
    output_text: Optional[str]
    model_name: Optional[str]
    rag_run_id: Optional[int]
    created_at: datetime

    class Config:
        orm_mode = True


class GenerationEvalCreate(BaseModel):
    axes: Dict[str, Any] = Field(default_factory=dict)
    overall: Optional[int] = None
    notes: Optional[str] = None
    is_usable: Optional[bool] = None


class GenerationEvalRead(BaseModel):
    id: int
    run_id: int
    axes: Dict[str, Any]
    overall: Optional[int]
    notes: Optional[str]
    is_usable: Optional[bool]
    created_at: datetime

    class Config:
        orm_mode = True

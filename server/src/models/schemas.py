import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Project ──

class ProjectCreate(BaseModel):
    name: str
    path: str


class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    path: str
    status: str = "created"  # created | indexing | ready | error
    chunk_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


# ── Chat ──

class ChatRequest(BaseModel):
    question: str
    history: list[dict] = Field(default_factory=list)
    context: Optional["ChatContext"] = None


class ChatContext(BaseModel):
    current_file: Optional[str] = None
    selected_code: Optional[str] = None
    cursor_line: Optional[int] = None


# ── Chunk ──

class CodeChunk(BaseModel):
    id: str
    content: str
    file_path: str
    start_line: int
    end_line: int
    symbol_name: Optional[str] = None
    language: str = "unknown"


# ── Search ──

class SearchResult(BaseModel):
    chunk: CodeChunk
    score: float


# ── SSE Events ──

class SSEEvent(BaseModel):
    event: str
    data: dict

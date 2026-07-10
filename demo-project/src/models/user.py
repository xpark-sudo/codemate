"""
User and data models.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class User:
    id: str
    username: str
    password_hash: str
    email: str
    role: str = "viewer"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
        }


@dataclass
class Document:
    id: str
    title: str
    content: str
    owner_id: str
    created_at: str = ""
    tags: list[str] = field(default_factory=list)


@dataclass
class SearchQuery:
    keywords: list[str]
    filters: Optional[dict] = None
    limit: int = 20
    offset: int = 0

import uuid
import os
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
)
from src.config import settings
from src.models.schemas import CodeChunk, SearchResult


# Default vector dimensions for known models
MODEL_DIMS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
    "all-MiniLM-L6-v2": 384,
    "all-mpnet-base-v2": 768,
}


class Retriever:
    def __init__(self):
        self._client = None

    def _get_vector_size(self) -> int:
        if settings.openai_api_key and not settings.openai_base_url:
            # Using OpenAI embeddings
            return MODEL_DIMS.get(settings.openai_embedding_model, 1536)
        else:
            # Using local model
            return MODEL_DIMS.get(settings.local_embedding_model, 384)

    @property
    def client(self):
        if self._client is None:
            if settings.qdrant_url:
                self._client = QdrantClient(
                    url=settings.qdrant_url,
                    api_key=settings.qdrant_api_key or None,
                )
            else:
                os.makedirs(settings.qdrant_local_path, exist_ok=True)
                self._client = QdrantClient(path=settings.qdrant_local_path)
        return self._client

    def _collection_name(self, project_id: str) -> str:
        return f"project_{project_id}"

    def ensure_collection(self, project_id: str):
        """Create collection if it doesn't exist."""
        name = self._collection_name(project_id)
        collections = [
            c.name
            for c in self.client.get_collections().collections
        ]
        if name not in collections:
            self.client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(
                    size=self._get_vector_size(), distance=Distance.COSINE
                ),
            )

    async def upsert(
        self, project_id: str, chunks: list[CodeChunk], vectors: list[list[float]]
    ):
        """Insert or update chunks and their vectors."""
        self.ensure_collection(project_id)
        name = self._collection_name(project_id)

        points = []
        for chunk, vector in zip(chunks, vectors):
            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "chunk_id": chunk.id,
                        "file_path": chunk.file_path,
                        "start_line": chunk.start_line,
                        "end_line": chunk.end_line,
                        "symbol_name": chunk.symbol_name or "",
                        "content": chunk.content,
                        "language": chunk.language,
                    },
                )
            )

        self.client.upsert(collection_name=name, points=points)

    async def search(
        self, project_id: str, query_vector: list[float], top_k: int = 5
    ) -> list[SearchResult]:
        """Search for similar code chunks."""
        name = self._collection_name(project_id)

        response = self.client.query_points(
            collection_name=name, query=query_vector, limit=top_k
        )

        search_results = []
        for r in response.points:
            payload = r.payload or {}
            chunk = CodeChunk(
                id=payload.get("chunk_id", ""),
                content=payload.get("content", ""),
                file_path=payload.get("file_path", ""),
                start_line=payload.get("start_line", 1),
                end_line=payload.get("end_line", 1),
                symbol_name=payload.get("symbol_name") or None,
                language=payload.get("language", "unknown"),
            )
            search_results.append(SearchResult(chunk=chunk, score=r.score))

        return search_results

    def get_chunk_count(self, project_id: str) -> int:
        """Return total number of indexed chunks for a project."""
        name = self._collection_name(project_id)
        try:
            info = self.client.get_collection(collection_name=name)
            return info.points_count or 0
        except Exception:
            return 0

    def delete_project(self, project_id: str):
        """Delete a project's collection."""
        name = self._collection_name(project_id)
        try:
            self.client.delete_collection(collection_name=name)
        except Exception:
            pass


# Singleton
retriever = Retriever()

from openai import AsyncOpenAI
from src.config import settings


class Embedder:
    def __init__(self):
        self._local_model = None
        self._dim = None
        # Try API client
        if settings.openai_api_key:
            kwargs = {"api_key": settings.openai_api_key}
            if settings.openai_base_url:
                kwargs["base_url"] = settings.openai_base_url
            self._api_client = AsyncOpenAI(**kwargs)
        else:
            self._api_client = None
        self._api_model = settings.openai_embedding_model

    @property
    def dim(self) -> int:
        """Vector dimension (lazy-detected on first embed)."""
        if self._dim is None:
            raise RuntimeError("Embedder not initialized. Call embed() first.")
        return self._dim

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings, preferring API, falling back to local model."""
        # Try API first
        if self._api_client:
            try:
                response = await self._api_client.embeddings.create(
                    model=self._api_model, input=texts
                )
                vectors = [item.embedding for item in response.data]
                if vectors:
                    self._dim = len(vectors[0])
                return vectors
            except Exception as e:
                print(f"[embedder] API embedding failed ({e}), falling back to local model")

        # Fall back to local sentence-transformers
        return self._embed_local(texts)

    def _embed_local(self, texts: list[str]) -> list[list[float]]:
        from sentence_transformers import SentenceTransformer

        if self._local_model is None:
            model_name = settings.local_embedding_model
            print(f"[embedder] Loading local model: {model_name}")
            self._local_model = SentenceTransformer(model_name)

        embeddings = self._local_model.encode(texts, show_progress_bar=False)
        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)
        if len(embeddings) > 0:
            self._dim = embeddings.shape[1]
        return embeddings.tolist()

    async def embed_single(self, text: str) -> list[float]:
        results = await self.embed([text])
        return results[0]


# Singleton
embedder = Embedder()

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM (OpenAI-compatible: DeepSeek, etc.)
    openai_api_key: str = ""
    openai_base_url: str = ""          # Empty = OpenAI default. DeepSeek: https://api.deepseek.com
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"
    # Local embedding fallback (used when API embedding fails or isn't configured)
    local_embedding_model: str = "all-MiniLM-L6-v2"  # 384-dim, lightweight

    # Qdrant
    qdrant_url: str = ""           # Remote URL (e.g. http://localhost:6333). Empty = local mode.
    qdrant_api_key: str = ""
    qdrant_local_path: str = "data/qdrant"  # Local mode storage path

    # Debug
    debug_http: bool = False  # Log HTTP request/response details

    # Server
    server_host: str = "0.0.0.0"
    server_port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()

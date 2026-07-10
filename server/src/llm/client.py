import time, sys
from typing import AsyncIterator
from openai import AsyncOpenAI
from src.config import settings


def _log_request(kind: str, url: str, model: str, input_preview: str):
    if not settings.debug_http:
        return
    print(
        f"\n{'='*60}\n"
        f"[HTTP] {kind}\n"
        f"  URL:   {url}\n"
        f"  Model: {model}\n"
        f"  Input: {input_preview[:300]}...\n"
        f"{'='*60}",
        file=sys.stderr, flush=True,
    )


def _log_response(kind: str, status: str, tokens: int, elapsed_ms: int):
    if not settings.debug_http:
        return
    print(
        f"[HTTP] {kind} ← {status} | {tokens} tokens | {elapsed_ms}ms\n",
        file=sys.stderr, flush=True,
    )


class LLMClient:
    def __init__(self):
        kwargs = {"api_key": settings.openai_api_key}
        if settings.openai_base_url:
            kwargs["base_url"] = settings.openai_base_url
        self.client = AsyncOpenAI(**kwargs)
        self.model = settings.openai_model
        self._base = settings.openai_base_url or "https://api.openai.com"

    async def chat(self, system_prompt: str, user_prompt: str) -> str:
        url = f"{self._base}/v1/chat/completions"
        t0 = time.monotonic()
        _log_request("Chat", url, self.model, user_prompt)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
        )

        usage = response.usage
        tokens = usage.total_tokens if usage else 0
        elapsed = int((time.monotonic() - t0) * 1000)
        _log_response("Chat", "200", tokens, elapsed)
        return response.choices[0].message.content or ""

    async def chat_stream(
        self, system_prompt: str, user_prompt: str
    ) -> AsyncIterator[str]:
        url = f"{self._base}/v1/chat/completions"
        t0 = time.monotonic()
        _log_request("Chat (stream)", url, self.model, user_prompt)

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            stream=True,
        )
        chunk_count = 0
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                chunk_count += 1
                yield delta

        elapsed = int((time.monotonic() - t0) * 1000)
        _log_response("Chat (stream)", "200", chunk_count, elapsed)

    async def chat_json(self, system_prompt: str, user_prompt: str) -> dict:
        url = f"{self._base}/v1/chat/completions"
        t0 = time.monotonic()
        _log_request("Chat (JSON)", url, self.model, user_prompt)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        import json

        usage = response.usage
        tokens = usage.total_tokens if usage else 0
        elapsed = int((time.monotonic() - t0) * 1000)
        _log_response("Chat (JSON)", "200", tokens, elapsed)
        return json.loads(response.choices[0].message.content or "{}")


# Singleton
llm_client = LLMClient()

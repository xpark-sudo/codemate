from src.llm.client import llm_client
from src.llm.prompts import build_reflect_prompt


class Reflector:
    async def reflect(self, question: str, chunks: list) -> dict:
        """
        Evaluate whether retrieved chunks are sufficient to answer the question.

        Returns: {
            "sufficient": bool,
            "missing": "what's missing",
            "followup_queries": [...]
        }
        """
        system_prompt, user_prompt = build_reflect_prompt(question, chunks)

        result = await llm_client.chat_json(system_prompt, user_prompt)
        return {
            "sufficient": result.get("sufficient", True),
            "missing": result.get("missing", ""),
            "followup_queries": result.get("followup_queries", []),
        }


reflector = Reflector()

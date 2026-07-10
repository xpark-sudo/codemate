from src.llm.client import llm_client
from src.llm.prompts import build_plan_prompt


class Planner:
    async def plan(self, question: str, existing_chunks: list) -> dict:
        """
        Analyze the question and generate search queries.

        Returns: {"queries": ["q1", "q2"], "reasoning": "..."}
        """
        system_prompt, user_prompt = build_plan_prompt(question, existing_chunks)

        result = await llm_client.chat_json(system_prompt, user_prompt)
        return {
            "queries": result.get("queries", [question]),
            "reasoning": result.get("reasoning", ""),
        }


planner = Planner()

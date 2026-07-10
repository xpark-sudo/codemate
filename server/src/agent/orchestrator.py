from src.agent.planner import planner
from src.agent.reflector import reflector
from src.rag.embedder import embedder
from src.rag.retriever import retriever
from src.llm.client import llm_client
from src.llm.prompts import build_rag_prompt
from src.models.schemas import CodeChunk

MAX_ITERATIONS = 3
TOP_K_PER_QUERY = 5


class Orchestrator:
    async def run(self, question: str, project_id: str):
        """
        Plan-Execute-Reflect loop. Async generator yielding SSE-formatted strings.

        SSE events: plan → search (multiple) → reflect → answer (streaming) → done
        """
        all_chunks: list[CodeChunk] = []
        seen_ids: set[str] = set()
        final_iteration = 0

        try:
            for iteration in range(MAX_ITERATIONS):
                final_iteration = iteration

                # ── Plan ──
                plan = await planner.plan(question, all_chunks)
                yield _sse("plan", {
                    "queries": plan["queries"],
                    "reasoning": plan["reasoning"],
                    "iteration": iteration + 1,
                })

                # ── Execute ──
                new_in_round = 0
                for query in plan["queries"]:
                    query_vector = await embedder.embed_single(query)
                    results = await retriever.search(
                        project_id, query_vector, top_k=TOP_K_PER_QUERY
                    )

                    files_found = []
                    for r in results:
                        if r.chunk.id not in seen_ids:
                            seen_ids.add(r.chunk.id)
                            all_chunks.append(r.chunk)
                            new_in_round += 1
                        if r.chunk.file_path not in files_found:
                            files_found.append(r.chunk.file_path)

                    yield _sse("search", {
                        "query": query,
                        "results_count": len(results),
                        "new_chunks": len([r for r in results if r.chunk.id in seen_ids]),
                        "files": files_found,
                    })

                # ── Reflect ──
                reflection = await reflector.reflect(question, all_chunks)
                yield _sse("reflect", {
                    "sufficient": reflection["sufficient"],
                    "missing": reflection["missing"],
                    "followup_queries": reflection["followup_queries"],
                    "total_chunks": len(all_chunks),
                    "iteration": iteration + 1,
                })

                if reflection["sufficient"]:
                    break

                if new_in_round == 0:
                    # No new results, no point continuing
                    break

            # ── Answer ──
            if not all_chunks:
                yield _sse("answer", {
                    "delta": "No relevant code found in the indexed codebase."
                })
                yield _sse("done", {
                    "iterations": final_iteration + 1,
                    "chunks_found": 0,
                })
                return

            system_prompt, user_prompt = build_rag_prompt(question, all_chunks)
            references = [
                {"file": c.file_path, "line": c.start_line, "symbol": c.symbol_name}
                for c in all_chunks
            ]

            first = True
            async for delta in llm_client.chat_stream(system_prompt, user_prompt):
                if first:
                    yield _sse("answer", {"delta": delta, "references": references})
                    first = False
                else:
                    yield _sse("answer", {"delta": delta})

            yield _sse("done", {
                "iterations": final_iteration + 1,
                "chunks_found": len(all_chunks),
            })

        except Exception as e:
            yield _sse("error", {"message": str(e)})


def _sse(event: str, data: dict) -> str:
    import json
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


orchestrator = Orchestrator()

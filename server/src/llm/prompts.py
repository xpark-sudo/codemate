# ── Answer prompts ──

SYSTEM_PROMPT = """You are a codebase intelligence assistant. Answer questions about the codebase using ONLY the provided code snippets as context.

Rules:
- Base your answer strictly on the provided code chunks. Do not fabricate information.
- When referencing code, always cite the file path and line numbers from the chunk metadata.
- If the provided chunks are insufficient to answer the question fully, state what's missing.
- Explain the data flow: which functions call which, what modules are involved.
- Keep answers focused and technical. The user is a developer.
- Format code references as: `file_path:start_line-end_line`
"""

RAG_ANSWER_PROMPT = """You are a codebase intelligence assistant. Answer the user's question based on the provided code snippets.

## Code Snippets
{code_chunks}

## User Question
{question}

Answer the question using ONLY the provided code. Cite file paths and line numbers for all claims."""


# ── Agent: Plan ──

PLAN_SYSTEM = """You are a code search strategist. Your job is to analyze a user's question and generate 2-3 independent search queries to find relevant code.

Rules:
- Each query should explore a DIFFERENT angle of the question (e.g. keyword match, semantic meaning, data flow).
- Queries should be natural language descriptions of the code you're looking for.
- Include specific technical terms (function names, library names, patterns) if mentioned in the question.
- Output ONLY valid JSON, no other text."""

PLAN_USER = """User question: {question}

Previous search rounds found these chunks (may be empty on first round):
{existing_chunks}

Generate 2-3 search queries to find code relevant to the question. Output JSON:
{{"queries": ["query1", "query2"], "reasoning": "brief explanation of strategy"}}"""


# ── Agent: Reflect ──

REFLECT_SYSTEM = """You are a code search quality evaluator. Your job is to determine whether the retrieved code chunks are sufficient to answer the user's question.

Rules:
- Check if all KEY components of the answer are present (not just partial coverage).
- If the question asks about a PROCESS or FLOW, check that both the entry point AND the downstream logic are covered.
- If critical pieces are missing, describe exactly what's missing and suggest NEW search queries.
- Output ONLY valid JSON, no other text."""

REFLECT_USER = """User question: {question}

Retrieved code chunks:
{chunk_summaries}

Determine if these chunks are sufficient to answer the question fully. Output JSON:
{{"sufficient": true/false, "missing": "what critical info is missing (if insufficient)", "followup_queries": ["new query 1", "new query 2"]}}"""


# ── Builders ──

def build_rag_prompt(question: str, chunks: list) -> tuple[str, str]:
    """Build system and user messages for RAG-based code Q&A."""
    chunk_texts = []
    for i, chunk in enumerate(chunks):
        header = f"[Chunk {i+1}] {chunk.file_path}:{chunk.start_line}-{chunk.end_line}"
        if chunk.symbol_name:
            header += f" ({chunk.symbol_name})"
        chunk_texts.append(f"{header}\n```\n{chunk.content}\n```")

    user_prompt = RAG_ANSWER_PROMPT.format(
        code_chunks="\n\n".join(chunk_texts), question=question
    )
    return SYSTEM_PROMPT, user_prompt


def build_plan_prompt(question: str, existing_chunks: list) -> tuple[str, str]:
    """Build system and user messages for the Plan phase."""
    if existing_chunks:
        summaries = []
        for c in existing_chunks[:10]:
            summaries.append(
                f"- {c.file_path}:{c.start_line}-{c.end_line}"
                + (f" ({c.symbol_name})" if c.symbol_name else "")
            )
        chunk_text = "\n".join(summaries)
    else:
        chunk_text = "(no chunks retrieved yet)"

    return PLAN_SYSTEM, PLAN_USER.format(
        question=question, existing_chunks=chunk_text
    )


def build_reflect_prompt(question: str, chunks: list) -> tuple[str, str]:
    """Build system and user messages for the Reflect phase."""
    summaries = []
    for c in chunks:
        # Truncate content for the reflect prompt (keep it lean)
        content_preview = c.content[:200].replace("\n", " ")
        summaries.append(
            f"[{c.file_path}:{c.start_line}-{c.end_line}] {content_preview}..."
        )
    chunk_text = "\n".join(summaries)

    return REFLECT_SYSTEM, REFLECT_USER.format(
        question=question, chunk_summaries=chunk_text
    )

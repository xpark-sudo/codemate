from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from src.models.schemas import ChatRequest, Project
from src.rag.retriever import retriever
from src.agent.orchestrator import orchestrator
from src.api.projects import _projects

router = APIRouter(prefix="/api/projects", tags=["chat"])


@router.post("/{project_id}/chat")
async def chat(project_id: str, body: ChatRequest):
    # Check project exists (memory, disk, or Qdrant)
    project = _projects.get(project_id)
    if not project:
        if retriever.get_chunk_count(project_id) == 0:
            raise HTTPException(
                status_code=404,
                detail="Project not found. Create and index it first.",
            )
        project = Project(
            id=project_id, name=project_id, path="(recovered)", status="ready"
        )
        _projects[project_id] = project
    elif project.status != "ready":
        if retriever.get_chunk_count(project_id) == 0:
            raise HTTPException(
                status_code=400, detail="Project not indexed. Call /index first."
            )
        project.status = "ready"

    return StreamingResponse(
        orchestrator.run(body.question, project_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

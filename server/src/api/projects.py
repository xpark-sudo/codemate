import json
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from src.models.schemas import ProjectCreate, Project
from src.rag.chunker import walk_project, chunk_file
from src.rag.embedder import embedder
from src.rag.retriever import retriever

router = APIRouter(prefix="/api/projects", tags=["projects"])

PROJECTS_FILE = "data/projects.json"

_projects: dict[str, Project] = {}


def _load_projects():
    """Load project metadata from disk."""
    global _projects
    try:
        if os.path.exists(PROJECTS_FILE):
            data = json.loads(Path(PROJECTS_FILE).read_text())
            _projects = {}
            for item in data:
                p = Project(**item)
                # Recover status from Qdrant if data exists
                db_chunks = retriever.get_chunk_count(p.id)
                if db_chunks > 0 and p.status not in ("indexing",):
                    p.status = "ready"
                    p.chunk_count = max(p.chunk_count, db_chunks)
                _projects[p.id] = p
    except Exception:
        pass


def _save_projects():
    """Persist project metadata to disk."""
    os.makedirs(os.path.dirname(PROJECTS_FILE), exist_ok=True)
    data = [p.model_dump() for p in _projects.values()]
    Path(PROJECTS_FILE).write_text(json.dumps(data, indent=2))


# Load on module init
_load_projects()


@router.post("", response_model=Project)
async def create_project(body: ProjectCreate):
    project = Project(name=body.name, path=body.path)
    _projects[project.id] = project
    _save_projects()
    return project


@router.post("/{project_id}/index")
async def index_project(project_id: str):
    project = _projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.status = "indexing"
    _save_projects()
    chunk_count = 0

    try:
        files = walk_project(project.path)
        for file_info in files:
            chunks = chunk_file(file_info["file_path"], file_info["content"])
            if not chunks:
                continue

            texts = [c.content for c in chunks]
            vectors = await embedder.embed(texts)
            await retriever.upsert(project_id, chunks, vectors)
            chunk_count += len(chunks)

        project.status = "ready"
        project.chunk_count = chunk_count
        _save_projects()
    except Exception as e:
        project.status = "error"
        _save_projects()
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "status": project.status,
        "chunk_count": project.chunk_count,
    }


@router.get("/{project_id}/status")
async def get_project_status(project_id: str):
    project = _projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db_chunks = retriever.get_chunk_count(project_id)
    return {
        "id": project.id,
        "name": project.name,
        "path": project.path,
        "status": project.status,
        "chunk_count": max(project.chunk_count, db_chunks),
    }


@router.get("")
async def list_projects():
    return [
        {
            "id": p.id,
            "name": p.name,
            "path": p.path,
            "status": p.status,
            "chunk_count": p.chunk_count,
        }
        for p in _projects.values()
    ]


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")

    retriever.delete_project(project_id)
    del _projects[project_id]
    _save_projects()
    return {"deleted": True}

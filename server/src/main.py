from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api.projects import router as projects_router
from src.api.chat import router as chat_router

app = FastAPI(title="Codebase Intelligence Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router)
app.include_router(chat_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}

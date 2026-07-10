import re
import uuid
from pathlib import Path
from src.models.schemas import CodeChunk

# File extensions we can meaningfully chunk
CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs",
    ".java", ".rb", ".php", ".swift", ".kt", ".scala",
    ".c", ".cpp", ".h", ".hpp", ".cs",
}

# Regex patterns for detecting boundaries
PATTERNS = {
    # Python, Ruby, etc.
    "indented": re.compile(
        r"^(\s*)(def |class |async def )", re.MULTILINE
    ),
    # JavaScript/TypeScript
    "brace": re.compile(
        r"^(\s*)(function |class |export (?:async )?function |export (?:default )?class |const \w+ = (?:async )?\(|const \w+ = (?:async )?function)",
        re.MULTILINE,
    ),
    # Go
    "go": re.compile(
        r"^(\s*)(func |type \w+ struct)", re.MULTILINE
    ),
}


def _detect_language(file_path: str) -> str:
    ext = Path(file_path).suffix
    mapping = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".jsx": "javascript",
        ".go": "go",
        ".rs": "rust",
        ".java": "java",
    }
    return mapping.get(ext, ext.lstrip("."))


def _find_boundaries(file_path: str, content: str) -> list[int]:
    """Find line numbers where function/class definitions start."""
    ext = Path(file_path).suffix

    if ext == ".go":
        pattern = PATTERNS["go"]
    elif ext in {".py", ".rb"}:
        pattern = PATTERNS["indented"]
    else:
        pattern = PATTERNS["brace"]

    lines = content.split("\n")
    boundaries = []

    for i, line in enumerate(lines):
        if pattern.match(line):
            # Check indentation: top-level only (indent 0-2 spaces)
            match = pattern.match(line)
            indent = len(match.group(1))
            if indent <= 2:
                boundaries.append(i + 1)  # 1-indexed line numbers

    return boundaries


def _split_into_chunks(
    file_path: str, content: str, boundaries: list[int]
) -> list[CodeChunk]:
    """Split file content at function/class boundaries."""
    lines = content.split("\n")
    total_lines = len(lines)
    chunks = []
    language = _detect_language(file_path)

    # If no boundaries found or only one, chunk the whole file
    if len(boundaries) < 2:
        chunks.append(
            CodeChunk(
                id=str(uuid.uuid4())[:8],
                content=content,
                file_path=file_path,
                start_line=1,
                end_line=total_lines,
                language=language,
            )
        )
        return chunks

    # Add preamble (everything before first boundary)
    if boundaries[0] > 1:
        preamble = "\n".join(lines[: boundaries[0] - 1])
        if preamble.strip():
            chunks.append(
                CodeChunk(
                    id=str(uuid.uuid4())[:8],
                    content=preamble,
                    file_path=file_path,
                    start_line=1,
                    end_line=boundaries[0] - 1,
                    language=language,
                )
            )

    # Chunk at each boundary
    for i, start in enumerate(boundaries):
        end = boundaries[i + 1] - 1 if i + 1 < len(boundaries) else total_lines
        chunk_text = "\n".join(lines[start - 1 : end])
        if not chunk_text.strip():
            continue

        # Extract symbol name from the first line
        symbol_match = re.match(r"^\s*(?:export\s+)?(?:async\s+)?(?:function|class|def|func|type)\s+(\w+)",
                                chunk_text.strip())
        symbol_name = symbol_match.group(1) if symbol_match else None

        chunks.append(
            CodeChunk(
                id=str(uuid.uuid4())[:8],
                content=chunk_text,
                file_path=file_path,
                start_line=start,
                end_line=end,
                symbol_name=symbol_name,
                language=language,
            )
        )

    return chunks


def chunk_file(file_path: str, content: str) -> list[CodeChunk]:
    """Chunk a single file into code blocks at function/class boundaries."""
    boundaries = _find_boundaries(file_path, content)
    return _split_into_chunks(file_path, content, boundaries)


def walk_project(project_path: str) -> list[dict]:
    """Walk a project directory and return list of {file_path, content} for all code files."""
    files = []
    root = Path(project_path)
    for path in root.rglob("*"):
        if path.is_file() and path.suffix in CODE_EXTENSIONS:
            # Skip common non-source dirs
            parts = path.parts
            if any(p in parts for p in ("node_modules", ".git", "__pycache__", "dist", "build", ".venv", "venv")):
                continue
            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
                files.append({"file_path": str(path), "content": content})
            except Exception:
                continue
    return files

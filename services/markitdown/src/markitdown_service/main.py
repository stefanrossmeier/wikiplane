from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from . import __version__

app = FastAPI(title="Wikiplane MarkItDown Service", version=__version__)


class ConvertRequest(BaseModel):
    input_path: str
    output_dir: str


def workspace_root() -> Path:
    return Path(os.environ.get("WORKSPACE_ROOT", "/workspace")).resolve()


def safe_path(raw: str, *, must_exist: bool = False) -> Path:
    root = workspace_root()
    path = Path(raw).resolve()
    if path != root and root not in path.parents:
        raise ValueError(f"Path must remain under WORKSPACE_ROOT ({root})")
    if must_exist and not path.is_file():
        raise ValueError(f"Input artifact does not exist: {path}")
    return path


def result_markdown(result: Any) -> str:
    for attribute in ("markdown", "text_content"):
        value = getattr(result, attribute, None)
        if isinstance(value, str):
            return value
    if isinstance(result, str):
        return result
    raise RuntimeError("MarkItDown result did not contain Markdown text")


def result_title(result: Any, input_path: Path) -> str:
    direct = getattr(result, "title", None)
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    metadata = getattr(result, "metadata", None)
    if isinstance(metadata, dict):
        title = metadata.get("title")
        if isinstance(title, str) and title.strip():
            return title.strip()
    return input_path.stem.replace("-", " ").replace("_", " ")


def safe_stem(path: Path) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", path.stem).strip("-.")
    return value[:160] or "source"


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "markitdown",
        "version": __version__,
    }


@app.post("/convert")
def convert(request: ConvertRequest) -> dict[str, Any]:
    try:
        input_path = safe_path(request.input_path, must_exist=True)
        output_dir = safe_path(request.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        from markitdown import MarkItDown

        converter = MarkItDown()
        convert_local = getattr(converter, "convert_local", None)
        result = convert_local(str(input_path)) if callable(convert_local) else converter.convert(str(input_path))
        markdown = result_markdown(result).strip() + "\n"

        markdown_path = output_dir / f"{safe_stem(input_path)}.md"
        result_path = output_dir / f"{safe_stem(input_path)}.result.json"
        markdown_path.write_text(markdown, encoding="utf-8")
        diagnostics = {
            "input_suffix": input_path.suffix.lower(),
            "markdown_characters": len(markdown),
        }
        result_path.write_text(
            json.dumps(
                {
                    "markdown_path": str(markdown_path),
                    "diagnostics": diagnostics,
                    "version": __version__,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        return {
            "status": "success",
            "markdown_path": str(markdown_path),
            "result_path": str(result_path),
            "title": result_title(result, input_path),
            "diagnostics": diagnostics,
            "version": __version__,
        }
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

# Adapted for Wikiplane in 2026 from Safeplane model-gateway (Apache-2.0).
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI, HTTPException

app = FastAPI(title="Wikiplane Model Gateway", version="0.1.0")
logger = logging.getLogger("wikiplane.model_gateway")


def _secret(path_env: str, value_env: str, default_path: str) -> str | None:
    path = Path(os.environ.get(path_env, default_path))
    try:
        value = path.read_text(encoding="utf-8").strip()
        if value:
            return value
    except FileNotFoundError:
        pass
    value = os.environ.get(value_env, "").strip()
    return value or None


def openrouter_api_key() -> str | None:
    return _secret(
        "OPENROUTER_API_KEY_FILE",
        "OPENROUTER_API_KEY",
        "/run/secrets/openrouter_api_key",
    )


def load_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    alias_file = Path(os.environ.get("MODEL_ALIASES_FILE", "/app/config/models.yaml"))
    if alias_file.exists():
        raw = yaml.safe_load(alias_file.read_text(encoding="utf-8")) or {}
        mapping = raw.get("aliases", raw) if isinstance(raw, dict) else {}
        if isinstance(mapping, dict):
            aliases.update(
                {str(key): str(value) for key, value in mapping.items() if value}
            )

    inline = os.environ.get("MODEL_ALIASES_JSON", "").strip()
    if inline:
        parsed = json.loads(inline)
        if not isinstance(parsed, dict):
            raise ValueError("MODEL_ALIASES_JSON must be a JSON object")
        aliases.update({str(key): str(value) for key, value in parsed.items()})

    for alias in (
        "wikiplane-integrate",
        "wikiplane-crosslink",
        "wikiplane-query",
        "wikiplane-judge",
    ):
        env = "MODEL_ALIAS_" + alias.upper().replace("-", "_")
        value = os.environ.get(env, "").strip()
        if value:
            aliases[alias] = value
    return aliases


def resolve_model(requested: str) -> str:
    aliases = load_aliases()
    if requested in aliases:
        return aliases[requested]
    if os.environ.get("ALLOW_DIRECT_MODEL_IDS", "0") == "1":
        return requested
    if os.environ.get("MODEL_GATEWAY_MODE", "fake").lower() == "fake":
        return requested
    raise ValueError(f"Unknown model alias: {requested}")


def normalize_response(response: Any, requested_model: str, actual_model: str) -> dict[str, Any]:
    if hasattr(response, "model_dump"):
        data = response.model_dump()
    elif isinstance(response, dict):
        data = response
    else:
        data = dict(response)

    choices = data.get("choices") if isinstance(data.get("choices"), list) else []
    first = choices[0] if choices and isinstance(choices[0], dict) else {}
    message = first.get("message") if isinstance(first.get("message"), dict) else {}
    hidden = data.get("_hidden_params") if isinstance(data.get("_hidden_params"), dict) else {}
    usage = dict(data.get("usage")) if isinstance(data.get("usage"), dict) else {}
    response_cost = hidden.get("response_cost") or data.get("response_cost")
    if response_cost is not None:
        usage["cost"] = response_cost
    provider = (
        data.get("provider")
        or data.get("llm_provider")
        or hidden.get("provider")
        or hidden.get("custom_llm_provider")
    )
    return {
        "id": data.get("id"),
        "object": "chat.completion",
        "created": data.get("created"),
        "model": requested_model,
        "actual_model": data.get("model") or actual_model,
        "provider": provider,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": message.get("content", ""),
                },
                "finish_reason": first.get("finish_reason"),
            }
        ],
        "usage": usage,
    }


def fake_response(body: dict[str, Any], requested_model: str) -> dict[str, Any]:
    response_format = body.get("response_format")
    json_mode = isinstance(response_format, dict) and response_format.get("type") == "json_object"
    if json_mode:
        content = json.dumps(
            {"knowledge": [], "contradictions": [], "links": []},
            ensure_ascii=False,
        )
    else:
        content = f"[fake {requested_model}] model gateway is running"
    return {
        "id": "fake-wikiplane",
        "object": "chat.completion",
        "model": requested_model,
        "actual_model": f"fake/{requested_model}",
        "provider": "wikiplane-fake",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "cost": 0.0,
        },
    }


def real_completion(body: dict[str, Any], requested_model: str, actual_model: str) -> dict[str, Any]:
    try:
        from litellm import completion
    except Exception as exc:  # pragma: no cover - container dependency failure
        raise RuntimeError(f"LiteLLM import failed: {exc}") from exc

    messages = body.get("messages")
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must be a non-empty array")

    kwargs: dict[str, Any] = {
        "model": actual_model,
        "messages": messages,  # preserve multimodal OpenAI-compatible content verbatim
        "timeout": min(float(body.get("timeout", 120)), 3600),
        "num_retries": int(os.environ.get("MODEL_GATEWAY_RETRIES", "2")),
    }
    if actual_model.startswith("openrouter/"):
        key = openrouter_api_key()
        if not key:
            raise RuntimeError("OPENROUTER_API_KEY is required for OpenRouter models")
        kwargs["api_key"] = key

    for key in ("temperature", "max_tokens", "response_format", "tools", "tool_choice"):
        if key in body and body[key] is not None:
            kwargs[key] = body[key]

    response = completion(**kwargs)
    return normalize_response(response, requested_model, actual_model)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "model-gateway",
        "mode": os.environ.get("MODEL_GATEWAY_MODE", "fake").lower(),
        "aliases": sorted(load_aliases().keys()),
    }


@app.get("/v1/models")
def models() -> dict[str, Any]:
    aliases = load_aliases()
    return {
        "object": "list",
        "data": [
            {"id": alias, "object": "model", "owned_by": "wikiplane"}
            for alias in sorted(aliases)
        ],
    }


@app.post("/v1/chat/completions")
def chat_completions(body: dict[str, Any]) -> dict[str, Any]:
    requested_model = str(body.get("model") or "").strip()
    if not requested_model:
        raise HTTPException(status_code=422, detail="model is required")
    try:
        actual_model = resolve_model(requested_model)
        mode = os.environ.get("MODEL_GATEWAY_MODE", "fake").lower()
        logger.info(
            "model request alias=%s actual=%s mode=%s messages=%s",
            requested_model,
            actual_model,
            mode,
            len(body.get("messages", [])) if isinstance(body.get("messages"), list) else 0,
        )
        if mode == "fake":
            return fake_response(body, requested_model)
        if mode == "real":
            return real_completion(body, requested_model, actual_model)
        raise ValueError(f"Unsupported MODEL_GATEWAY_MODE: {mode}")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("model request failed alias=%s error_type=%s", requested_model, type(exc).__name__)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

import os
from fastapi.testclient import TestClient

os.environ["MODEL_GATEWAY_MODE"] = "fake"

from model_gateway.main import app  # noqa: E402

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_openai_compatible_fake_json_response():
    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "wikiplane-integrate",
            "messages": [{"role": "user", "content": "hello"}],
            "response_format": {"type": "json_object"},
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["choices"][0]["message"]["role"] == "assistant"
    assert payload["model"] == "wikiplane-integrate"


def test_real_completion_preserves_structured_and_multimodal_payload(monkeypatch):
    import sys
    import types
    from model_gateway.main import real_completion

    captured = {}

    class FakeResponse:
        def model_dump(self):
            return {
                "id": "x",
                "model": "provider/model",
                "choices": [{"message": {"content": "{}"}, "finish_reason": "stop"}],
                "usage": {"total_tokens": 4},
            }

    def completion(**kwargs):
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setitem(sys.modules, "litellm", types.SimpleNamespace(completion=completion))
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "transcribe"},
                {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}},
            ],
        }
    ]
    body = {
        "messages": messages,
        "response_format": {"type": "json_object"},
        "tools": [{"type": "function", "function": {"name": "noop", "parameters": {"type": "object"}}}],
    }
    result = real_completion(body, "alias", "provider/model")
    assert captured["messages"] == messages
    assert captured["response_format"] == {"type": "json_object"}
    assert captured["tools"] == body["tools"]
    assert result["choices"][0]["message"]["content"] == "{}"

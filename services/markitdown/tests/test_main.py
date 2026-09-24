import os
from pathlib import Path

import pytest

from markitdown_service.main import safe_path


def test_safe_path_rejects_escape(tmp_path: Path):
    os.environ["WORKSPACE_ROOT"] = str(tmp_path)
    with pytest.raises(ValueError):
        safe_path("/etc/passwd")


def test_safe_path_accepts_workspace_child(tmp_path: Path):
    os.environ["WORKSPACE_ROOT"] = str(tmp_path)
    child = tmp_path / "in" / "file.pdf"
    child.parent.mkdir()
    child.write_bytes(b"x")
    assert safe_path(str(child), must_exist=True) == child.resolve()


def test_convert_wires_ocr_to_openai_compatible_gateway(tmp_path: Path, monkeypatch):
    import sys
    import types
    from markitdown_service.main import ConvertRequest, convert

    os.environ["WORKSPACE_ROOT"] = str(tmp_path)
    os.environ["MODEL_GATEWAY_OPENAI_BASE_URL"] = "http://gateway.test/v1"
    input_path = tmp_path / "in" / "scan.pdf"
    output_dir = tmp_path / "out"
    input_path.parent.mkdir()
    input_path.write_bytes(b"%PDF-synthetic")
    captured = {}

    class FakeOpenAI:
        def __init__(self, **kwargs):
            captured["openai"] = kwargs

    class FakeResult:
        markdown = "# Transcribed\n\nHello"

    class FakeMarkItDown:
        def __init__(self, **kwargs):
            captured["markitdown"] = kwargs

        def convert_local(self, path):
            captured["path"] = path
            return FakeResult()

    monkeypatch.setitem(sys.modules, "openai", types.SimpleNamespace(OpenAI=FakeOpenAI))
    monkeypatch.setitem(sys.modules, "markitdown", types.SimpleNamespace(MarkItDown=FakeMarkItDown))
    payload = convert(ConvertRequest(input_path=str(input_path), output_dir=str(output_dir), use_ocr=True))
    assert captured["markitdown"]["enable_plugins"] is True
    assert captured["markitdown"]["llm_model"] == "wikiplane-ocr"
    assert captured["openai"]["base_url"] == "http://gateway.test/v1"
    assert Path(payload["markdown_path"]).read_text(encoding="utf-8").startswith("# Transcribed")

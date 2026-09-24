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


def test_convert_uses_plain_markitdown(tmp_path: Path, monkeypatch):
    import sys
    import types
    from markitdown_service.main import ConvertRequest, convert

    os.environ["WORKSPACE_ROOT"] = str(tmp_path)
    input_path = tmp_path / "in" / "document.pdf"
    output_dir = tmp_path / "out"
    input_path.parent.mkdir()
    input_path.write_bytes(b"%PDF-synthetic")
    captured = {}

    class FakeResult:
        markdown = "# Converted\n\nHello"

    class FakeMarkItDown:
        def __init__(self, **kwargs):
            captured["markitdown"] = kwargs

        def convert_local(self, path):
            captured["path"] = path
            return FakeResult()

    monkeypatch.setitem(sys.modules, "markitdown", types.SimpleNamespace(MarkItDown=FakeMarkItDown))
    payload = convert(ConvertRequest(input_path=str(input_path), output_dir=str(output_dir)))
    assert captured["markitdown"] == {}
    assert captured["path"] == str(input_path)
    assert Path(payload["markdown_path"]).read_text(encoding="utf-8").startswith("# Converted")

"""Statische Pruefung der Web-Dateien gegen die Datenschutzregeln."""
import re
from pathlib import Path

import pytest

WEB = Path(__file__).resolve().parents[2] / "web"
FILES = [p for p in WEB.rglob("*") if p.suffix in (".html", ".js", ".css")]


def test_webdateien_vorhanden():
    names = {p.name for p in FILES}
    assert {"operator.html", "listener.html", "mic-test.html"} <= names


@pytest.mark.parametrize("p", FILES, ids=lambda p: str(p.relative_to(WEB)))
def test_keine_externen_adressen(p):
    # Erlaubt sind nur Platzhalter-Beispiele im Text fuer lokale Adressen (localhost, private Netze).
    pattern = r"https?://(?!(localhost|127\.|192\.168\.|10\.))|//cdn|@import\s+url\("
    assert not re.search(pattern, p.read_text(encoding="utf-8")), "externe Adresse gefunden (Regel 1: alles lokal)"


@pytest.mark.parametrize("p", FILES, ids=lambda p: str(p.relative_to(WEB)))
def test_kein_speichern_kein_tracking(p):
    code = p.read_text(encoding="utf-8")
    for bad in ("document.cookie", "localStorage", "sessionStorage", "indexedDB", "sendBeacon",
                "innerHTML", "eval(", "new Function"):
        assert bad not in code, f"{bad} verboten in {p.name}"


@pytest.mark.parametrize("name", ["operator.html", "listener.html"])
def test_html_ohne_inline_skript_und_stil(name):
    html = (WEB / name).read_text(encoding="utf-8")
    assert not re.search(r"<script(?![^>]*\bsrc=)[^>]*>\s*\S", html)
    assert "<style" not in html and 'style="' not in html
    assert not re.search(r"\son\w+=", html)         # keine Inline-Handler

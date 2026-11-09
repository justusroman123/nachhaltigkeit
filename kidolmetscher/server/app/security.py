"""Sicherheits-Header und Content-Security-Policy (Regel 1).

Alles wird lokal ausgeliefert, keine externen Quellen. Inline-Skripte sind
verboten; Ausnahme: Seiten mit eingebettetem Skript/Stil (mic-test.html) bekommen
den SHA-256-Hash genau dieser Bloecke, nie 'unsafe-inline'.
"""
from __future__ import annotations

import base64
import hashlib
import re
from pathlib import Path

_SCRIPT = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S | re.I)
_STYLE = re.compile(r"<style[^>]*>(.*?)</style>", re.S | re.I)


def _sha(text: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode() + "'"


def inline_hashes(html: str) -> tuple[list[str], list[str]]:
    scripts = [_sha(m) for m in _SCRIPT.findall(html) if m.strip()]
    styles = [_sha(m) for m in _STYLE.findall(html) if m.strip()]
    return scripts, styles


def build_csp(script_hashes: list[str] = (), style_hashes: list[str] = ()) -> str:
    return "; ".join([
        "default-src 'none'",
        "script-src 'self' " + " ".join(script_hashes),
        "style-src 'self' " + " ".join(style_hashes),
        "img-src 'self' data:",
        "media-src 'self' blob: data:",
        "connect-src 'self'",
        "font-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
    ]).replace("  ", " ").replace(" ;", ";")


def collect_page_hashes(web_dir: Path) -> dict[str, tuple[list[str], list[str]]]:
    out = {}
    if web_dir.is_dir():
        for f in web_dir.glob("*.html"):
            h = inline_hashes(f.read_text(encoding="utf-8"))
            if h[0] or h[1]:
                out["/" + f.name] = h
    return out


BASE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Permissions-Policy": "microphone=(self), camera=(), geolocation=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Frame-Options": "DENY",
}

"""Sicherheits-Header und Content-Security-Policy (Regel 1).

Alles wird lokal ausgeliefert, keine externen Quellen. Inline-Skripte sind
verboten; Ausnahme: Seiten mit eingebettetem Skript/Stil (mic-test.html) bekommen
den SHA-256-Hash genau dieser Bloecke, nie 'unsafe-inline'.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from collections import deque
from pathlib import Path
from typing import Callable

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


def client_of(conn) -> str:
    """Absender einer Anfrage/Verbindung. Hinter dem Reverse Proxy (Caddy, gleicher Rechner) steht die echte Adresse in
    X-Forwarded-For; dem Header wird NUR vertraut, wenn die Verbindung von diesem Rechner (loopback) kommt."""
    host = conn.client.host if getattr(conn, "client", None) else ""
    if host in ("127.0.0.1", "::1"):
        xff = conn.headers.get("x-forwarded-for", "")
        if xff:
            return xff.split(",")[0].strip()
    return host


class FailureLimiter:
    """Bremst das Raten des Bedienschluessels: Nach `max_fails` Fehlversuchen innerhalb von `window_s` Sekunden ist der
    Absender fuer `block_s` Sekunden gesperrt (auch mit richtigem Schluessel, damit Raten nichts bringt).
    Datenschutz (Regel 1): Absender werden nur als HMAC-Hash mit zufaelligem Salz gefuehrt, das beim Start neu gewuerfelt wird
    (keine IP-Adressen im Klartext, nichts wird gespeichert oder geloggt, alles nur im Arbeitsspeicher und kurzlebig)."""

    def __init__(self, max_fails: int, window_s: float, block_s: float, clock: Callable[[], float]):
        self.max_fails, self.window_s, self.block_s, self._clock = max_fails, window_s, block_s, clock
        self._salt = secrets.token_bytes(16)
        self._fails: dict[str, deque] = {}
        self._blocked: dict[str, float] = {}

    def _id(self, client: str) -> str:
        return hmac.new(self._salt, client.encode("utf-8"), "sha256").hexdigest()[:16]

    def blocked_for(self, client: str) -> int:
        """Restliche Sperrzeit in Sekunden (0 = nicht gesperrt)."""
        i, now = self._id(client), self._clock()
        until = self._blocked.get(i)
        if until is None:
            return 0
        if now >= until:
            self._blocked.pop(i, None)
            self._fails.pop(i, None)
            return 0
        return int(until - now) + 1

    def failure(self, client: str) -> bool:
        """Fehlversuch melden; True, wenn der Absender dadurch gesperrt wurde."""
        i, now = self._id(client), self._clock()
        q = self._fails.setdefault(i, deque())
        q.append(now)
        while q and now - q[0] > self.window_s:
            q.popleft()
        if len(q) >= self.max_fails:
            self._blocked[i] = now + self.block_s
            q.clear()
            return True
        return False

    def success(self, client: str) -> None:
        self._fails.pop(self._id(client), None)

    def purge(self) -> None:
        now = self._clock()
        for i in [k for k, t in self._blocked.items() if now >= t]:
            self._blocked.pop(i, None)
        for i in [k for k, q in self._fails.items() if not q or now - q[-1] > self.window_s]:
            self._fails.pop(i, None)

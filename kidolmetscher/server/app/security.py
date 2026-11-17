"""Sicherheits-Header und Content-Security-Policy (Regel 1).

Alles wird lokal ausgeliefert, keine externen Quellen. Inline-Skripte sind
verboten; Ausnahme: Seiten mit eingebettetem Skript/Stil (mic-test.html) bekommen
den SHA-256-Hash genau dieser Bloecke, nie 'unsafe-inline'.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
import re
import secrets
import time
from collections import deque
from pathlib import Path
from typing import Callable, Iterable

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
    "Strict-Transport-Security": "max-age=31536000",      # nur ueber HTTPS wirksam (Browser ignorieren ihn ueber HTTP); ohne includeSubDomains/preload
    "Permissions-Policy": "microphone=(self), camera=(), geolocation=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Frame-Options": "DENY",
}


def _nets(trusted: Iterable[str]) -> list:
    out = []
    for t in trusted:
        try:
            out.append(ipaddress.ip_network(t, strict=False))
        except ValueError:
            continue
    return out


def _is_trusted(host: str, nets: list) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(ip in n for n in nets)


def normalize_client(host: str) -> str:
    """Absender-Kennung: IPv4 ganz, IPv6 auf das /64-Praefix gekuerzt (ein Angreifer mit einem Praefix hat sonst unzaehlige Adressen)."""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return host[:64]
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped:
            return str(ip.ipv4_mapped)
        return str(ipaddress.ip_network(f"{ip}/64", strict=False).network_address) + "/64"
    return str(ip)


def client_of(conn, trusted: Iterable[str] = ("127.0.0.1", "::1")) -> str:
    """Absender einer Anfrage/Verbindung. Hinter dem Reverse Proxy (Caddy) steht die echte Adresse in X-Forwarded-For;
    dem Header wird NUR vertraut, wenn die Verbindung von einem vertrauenswuerdigen Proxy kommt (Standard: dieser Rechner),
    und er wird von RECHTS gelesen: der letzte Eintrag, der nicht selbst ein vertrauenswuerdiger Proxy ist. Was ein Absender
    selbst links anhaengt, zaehlt nicht (sonst koennte er seine Kennung frei waehlen)."""
    host = conn.client.host if getattr(conn, "client", None) else ""
    nets = _nets(trusted)
    if _is_trusted(host, nets):
        xff = [x.strip() for x in conn.headers.get("x-forwarded-for", "").split(",") if x.strip()]
        for entry in reversed(xff):
            if not _is_trusted(entry, nets):
                return normalize_client(entry)
        if xff:
            return normalize_client(xff[0])
    return normalize_client(host)


class RateBucket:
    """Token-Bucket (nur Arbeitsspeicher): `capacity` Einheiten Vorrat, `per_s` Einheiten Nachschub je Sekunde.
    Dient der Begrenzung von Steuernachrichten und Audio-Zufluss je Verbindung."""

    def __init__(self, capacity: float, per_s: float, clock: Callable[[], float] = time.monotonic):
        self.capacity, self.per_s, self._clock = float(capacity), float(per_s), clock
        self._level, self._at = float(capacity), clock()

    def allow(self, cost: float = 1.0) -> bool:
        now = self._clock()
        self._level = min(self.capacity, self._level + (now - self._at) * self.per_s)
        self._at = now
        if self._level >= cost:
            self._level -= cost
            return True
        return False


class BodyLimitMiddleware:
    """Reine ASGI-Schranke: HTTP-Koerper groesser als `max_bytes` werden mit 413 abgewiesen, bevor sie gelesen oder geparst
    werden (vor der Pruefung des Bedienschluessels koennte sonst jeder beliebig grosse Koerper Speicher belegen)."""

    def __init__(self, app, max_bytes: int = 16_384):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        cl = dict(scope.get("headers") or []).get(b"content-length")
        if cl is not None and (not cl.isdigit() or int(cl) > self.max_bytes):
            return await self._reject(send)
        total = 0
        started = False

        async def limited_receive():
            nonlocal total
            msg = await receive()
            if msg["type"] == "http.request":
                total += len(msg.get("body", b""))
                if total > self.max_bytes:
                    raise _TooLarge()
            return msg

        async def tracking_send(msg):
            nonlocal started
            if msg["type"] == "http.response.start":
                started = True
            await send(msg)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _TooLarge:
            if not started:
                await self._reject(send)

    @staticmethod
    async def _reject(send):
        body = b'{"detail":"Anfrage zu gross"}'
        await send({"type": "http.response.start", "status": 413,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})


class _TooLarge(Exception):
    pass


class FailureLimiter:
    """Bremst das Raten des Bedienschluessels: Nach `max_fails` Fehlversuchen innerhalb von `window_s` Sekunden ist der
    Absender fuer `block_s` Sekunden gesperrt (auch mit richtigem Schluessel, damit Raten nichts bringt).
    Datenschutz (Regel 1): Absender werden nur als HMAC-Hash mit zufaelligem Salz gefuehrt, das beim Start neu gewuerfelt wird
    (keine IP-Adressen im Klartext, nichts wird gespeichert oder geloggt, alles nur im Arbeitsspeicher und kurzlebig)."""

    MAX_TRACKED = 20_000          # so viele Absender hoechstens gleichzeitig verfolgen (aelteste fliegen raus), Schutz des Arbeitsspeichers

    def __init__(self, max_fails: int, window_s: float, block_s: float, clock: Callable[[], float]):
        self.max_fails, self.window_s, self.block_s, self._clock = max_fails, window_s, block_s, clock
        self._salt = secrets.token_bytes(16)
        self._fails: dict[str, deque] = {}
        self._blocked: dict[str, float] = {}

    def _id(self, client: str) -> str:
        return hmac.new(self._salt, client.encode("utf-8", "surrogatepass"), "sha256").hexdigest()[:16]

    def ident(self, client: str) -> str:
        """Pseudonyme Absender-Kennung (HMAC mit zufaelligem Salz): fuer alle Zaehler, die Absender unterscheiden muessen, ohne die Adresse zu halten."""
        return self._id(client)

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
        if i not in self._fails and len(self._fails) >= self.MAX_TRACKED:
            self._fails.pop(next(iter(self._fails)))              # aeltester Absender (Einfuegereihenfolge) fliegt raus
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
        """Richtiger Schluessel. Fehlversuche bleiben stehen und verfallen nur mit dem Fenster: Sonst koennte ein Angreifer hinter
        derselben Absender-Kennung (gemeinsames Netz) mit jedem Erfolg des Bedienplatzes seinen Zaehler zuruecksetzen."""
        return None

    def purge(self) -> None:
        now = self._clock()
        for i in [k for k, t in self._blocked.items() if now >= t]:
            self._blocked.pop(i, None)
        for i in [k for k, q in self._fails.items() if not q or now - q[-1] > self.window_s]:
            self._fails.pop(i, None)

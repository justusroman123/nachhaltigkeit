"""Datenschutz-Nachweis: Der Anwendungscode baut selbst keine ausgehenden Verbindungen auf.

Geprueft wird nur server/app (Messskripte unter scripts/ duerfen z. B. mit dem eigenen Server sprechen).
Das ersetzt keine Netzwerkpruefung auf dem Server (siehe docs/firewall-vorschlag.md), belegt aber: im Code der
Anwendung steht kein Aufruf an Fremdserver, auch keine Telemetrie.
"""
import ast
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "app"
VERBOTEN = {"requests", "httpx", "aiohttp", "urllib3", "http.client", "urllib.request", "ftplib", "smtplib",
            "telnetlib", "websockets", "socket", "xmlrpc", "poplib", "imaplib", "paramiko"}


def importe(path: Path) -> set[str]:
    out = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            out |= {a.name for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            out.add(node.module)
            out |= {f"{node.module}.{a.name}" for a in node.names}
    return out


def test_app_importiert_keine_netzwerk_clients():
    gefunden = {}
    for p in APP.rglob("*.py"):
        bad = {i for i in importe(p) if i in VERBOTEN or i.split(".")[0] in {"requests", "httpx", "aiohttp", "urllib3"}}
        if bad:
            gefunden[str(p.relative_to(APP))] = sorted(bad)
    assert not gefunden, f"Ausgehende Verbindungen im Anwendungscode: {gefunden}"


def test_app_enthaelt_keine_fremden_adressen():
    import re
    for p in APP.rglob("*.py"):
        text = p.read_text(encoding="utf-8")
        # nur Adressen in Code/Strings, die auf Fremdserver zeigen koennten (Kommentarlinks mit Doku ausgenommen)
        treffer = [m for m in re.findall(r"https?://[^\s\"')]+", text)
                   if not m.startswith(("http://localhost", "http://127.0.0.1", "http://testserver"))]
        assert not treffer, f"{p.name}: {treffer}"

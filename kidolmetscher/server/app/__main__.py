"""Startet den Server mit sicheren Voreinstellungen: im Ordner server/ `python -m app` (liest die Einstellungen aus der Umgebung).

Eine einzige Stelle statt fuenf Startskripten. Die Optionen sind aus dem Sicherheitsgutachten:
- kein Zugriffslog und Stufe "warning": uvicorn schreibt sonst je Verbindung eine Zeile mit der Adresse des Besuchers
  (Datenschutz-Regel 1: im Log stehen nur Zaehler und Zeiten);
- keine Proxy-Header-Auswertung durch uvicorn: X-Forwarded-For liest die Anwendung selbst (security.client_of), und nur von
  vertrauenswuerdigen Proxys (TRUSTED_PROXIES);
- kleine WebSocket-Frames (Audio-Bloecke sind hoechstens 64 000 Byte), Obergrenze fuer gleichzeitige Verbindungen,
  tote Verbindungen nach etwa 20 s erkennen (frei werdende Gaeste-Plaetze), kurze Keep-Alive-Zeit.
"""
from __future__ import annotations

import uvicorn

from .config import Settings


def main() -> None:
    s = Settings.from_env()          # prueft die Konfiguration (Schluessel, HOST) vor dem Start; bricht mit klarer Meldung ab
    uvicorn.run(
        "app.main:create_app", factory=True, host=s.host, port=s.port,
        access_log=False, log_level="warning", proxy_headers=False,
        ws_max_size=65_536, ws_ping_interval=10, ws_ping_timeout=10,
        limit_concurrency=300, timeout_keep_alive=5, h11_max_incomplete_event_size=16_384,
    )


if __name__ == "__main__":
    main()

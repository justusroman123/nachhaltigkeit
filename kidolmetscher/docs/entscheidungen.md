# Entscheidungen und Lizenzen (Stand 09.11.2026)

## Entscheidungen

| Nr. | Entscheidung | Begründung | Status |
| --- | --- | --- | --- |
| E1 | Server in Python/FastAPI, WebSocket für Audio und Untertitel | passt zu den geplanten Modellen (Python); wenig Abhängigkeiten | entschieden |
| E2 | Browser sendet PCM16/16 kHz/mono über AudioWorklet | kein Container-Overhead, keine Dekodierung auf dem Server | entschieden, **Latenz unbekannt** |
| E3 | Jede Stufe hinter Protocol, Mock + echt, Auswahl per Umgebung | ohne GPU entwickeln, Stufen austauschbar | entschieden |
| E4 | Zuhörer-Token im URL-Fragment, Hash im Server | Token landet nicht in Logs/Referrer | entschieden |
| E5 | Nur Sprachen mit Zuhörern übersetzen | spart GPU-Zeit | entschieden |
| E6 | Keine externen Ressourcen, CSP ohne `unsafe-inline` | Datenschutz-Regel | entschieden |
| E7 | `mic-test.html` bleibt Einzeldatei, CSP-Hash statt Lockerung | Etappe-0-Vorgabe (1 Datei) bei strenger CSP | entschieden |
| E8 | Aufnahme im Mikrofontest über ScriptProcessorNode (roh, WAV) | läuft ohne Zusatzdatei; veraltete API, nur für Test | entschieden, bei Browser-Änderung ersetzen |
| E9 | ASR: SimulStreaming oder WhisperLiveKit | Latenz, Lizenz, Sprachwechsel, Wartbarkeit | **offen** (messen auf GPU) |
| E10 | TTS: Piper | Lizenz noch offen | **offen** |
| E11 | TLS für Bedienplatz (Secure Context) | siehe Architektur, Grenzen | **offen**, Rückfrage nötig (Kosten/Konto) |

## Lizenztabelle

Spalte „Geprüft“: **ja** = aus den installierten Paket-Metadaten gelesen (09.11.2026); **nein** = nicht geprüft,
nicht aus dem Gedächtnis eintragen.

| Komponente | Verwendung | Lizenz | Geprüft | Anmerkung |
| --- | --- | --- | --- | --- |
| FastAPI 0.162.2 | Server | MIT | ja | |
| Starlette 1.10.0 | Server (Basis von FastAPI) | BSD-3-Clause | ja | |
| Uvicorn 0.54.0 | Server | BSD-3-Clause | ja | |
| Pydantic 2.14.3 | Server | MIT | ja | |
| websockets 17.4 | Server (über uvicorn[standard]) | BSD-3-Clause | ja | |
| pytest 9.2.0 | Tests | MIT | ja | nur Entwicklung |
| httpx 0.28.1 | Tests | BSD-3-Clause | ja | nur Entwicklung |
| Whisper large-v3 (Modellgewichte) | ASR | unbekannt | nein | Quelle des Modells festlegen, dann Lizenz lesen |
| SimulStreaming | ASR-Streaming | unbekannt | nein | |
| WhisperLiveKit | ASR-Streaming | unbekannt | nein | |
| TranslateGemma 12B | MT | unbekannt | nein | Nutzungsbedingungen des Herstellers lesen, auch Vorgaben zur Weitergabe |
| Piper (Programm) | TTS | unbekannt | nein | Projektlage und Lizenz aktuell prüfen (Lizenz „noch offen“) |
| Piper-Stimmen je Sprache (uk, ar, en, tr, fa) | TTS | unbekannt | nein | jede Stimme hat eigene Lizenz; Verfügbarkeit je Sprache unbekannt |
| Chromium/Playwright | nur Testwerkzeug im Entwicklungs-Container | unbekannt | nein | nicht Teil des Produkts |

## Offene Fragen (Antwort unbekannt)

1. Werden alle vier Zielsprachen (und fa) von TranslateGemma 12B in brauchbarer Qualität abgedeckt?
2. Gibt es für jede Zielsprache eine Piper-Stimme mit passender Lizenz?
3. Welche CUDA-/Treiberversion hat der gemietete Server (bestimmt das Basis-Image)?
4. Wie viele Zuhörer pro Raum sind realistisch (Netz, Audio-Datenmenge)?
5. Reicht die Verzögerung von 3–5 s? Messpunkte stehen im Messprotokoll.

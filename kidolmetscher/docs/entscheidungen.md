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
| E12 | Ein Sammel-Link/QR-Code für alle; Zuhörer wählen die Sprache selbst und können wechseln | einfachste Bedienung für Veranstalter und Zuhörer; Einzel-Links bleiben möglich | entschieden |
| E13 | QR-Code serverseitig mit `segno` als SVG | keine eigene QR-Implementierung, keine Browser-Bibliothek | entschieden |
| E14 | Sprachen: `TARGET_LANGS` (wählbar, inkl. fa) und `DEFAULT_LANGS` (vorab angehakt, ohne fa) | Persisch optional | entschieden |
| E15 | Segmentierer zwischen ASR und Übersetzung (Satzende oder höchstens N Wörter, Standard 12, bevorzugt an Komma) | Plan Phase 3: nur stabile Teile übersetzen | entschieden, Verhalten mit echtem Whisper unbekannt |
| E16 | Je Zielsprache eigene Warteschlange und eigener Arbeiter; Rückstau: erst Ton weglassen, dann älteste Segmente verwerfen | Plan: langsame Sprache soll andere nicht bremsen, Untertitel weiter liefern | entschieden, Schwellen sind Platzhalter |
| E17 | Token und Sprache des Zuhörers in der ersten WebSocket-Nachricht statt in `/ws/listener/{token}?lang=` | Adressen landen in Proxy-/Server-Protokollen | entschieden (Abweichung vom Plan) |
| E18 | Messskripte schreiben bei Mock-Backend nicht ins Messprotokoll | Attrappen-Werte dürfen nicht als Messwerte gelten | entschieden |
| E19 | Kein Backup-Mitschnitt für Netzausfall | widerspricht „keine Speicherung“; Alternative Folien | entschieden, auf Wunsch neu bewerten |
| E20 | Kosten-Anzeige zeigt Laufzeit der Anwendung, nicht der Maschine | die Anwendung kennt die Abrechnung des Anbieters nicht | entschieden |
| E9 | ASR: SimulStreaming oder WhisperLiveKit | Latenz, Lizenz, Sprachwechsel, Wartbarkeit | **offen** (messen auf GPU) |
| E10 | TTS: Piper | Lizenz noch offen | **offen** |
| E11 | TLS für Bedienplatz (Secure Context) | siehe Architektur, Grenzen | **offen**, Rückfrage nötig (Kosten/Konto) |

## Lizenztabelle

Spalte „Geprüft“: **ja** = aus den installierten Paket-Metadaten gelesen (09.11.2026); **gelesen** = am 11.11.2026 auf der Projektseite (GitHub) gelesen,
Sekundärquelle, Details in `docs/lizenzen-recherche.md`; **nein** = nicht geprüft,
nicht aus dem Gedächtnis eintragen.

| Komponente | Verwendung | Lizenz | Geprüft | Anmerkung |
| --- | --- | --- | --- | --- |
| FastAPI 0.162.2 | Server | MIT | ja | |
| Starlette 1.10.0 | Server (Basis von FastAPI) | BSD-3-Clause | ja | |
| Uvicorn 0.54.0 | Server | BSD-3-Clause | ja | |
| Pydantic 2.14.3 | Server | MIT | ja | |
| websockets 17.4 | Server (über uvicorn[standard]) | BSD-3-Clause | ja | |
| segno 1.6.6 | Server (QR-Code) | BSD (Klassifizierung in Paket-Metadaten) | ja | |
| opencv-python-headless 5.0.0.93 | nur optionaler QR-Lesetest | Apache 2.0 (Paket-Metadaten) | ja | nicht im Produkt |
| pytest 9.2.0 | Tests | MIT | ja | nur Entwicklung |
| httpx 0.28.1 | Tests | BSD-3-Clause | ja | nur Entwicklung |
| Whisper large-v3 (Modellgewichte) | ASR | unbekannt | nein | Quelle des Modells festlegen, dann Lizenz lesen |
| SimulStreaming | ASR-Streaming | MIT | gelesen | Autoren bitten kommerzielle Nutzer um einen Fragebogen |
| WhisperLiveKit | ASR-Streaming | Apache-2.0 | gelesen | Deutsch dort nicht ausdrücklich bestätigt |
| TranslateGemma 12B | MT | unbekannt | nein | Nutzungsbedingungen des Herstellers lesen, auch Vorgaben zur Weitergabe |
| Piper (Programm) | TTS | Nachfolger piper1-gpl: GPL-3.0; Original rhasspy/piper: MIT, archiviert 06.10.2025 | gelesen | Pflichten der GPL für unseren Einsatz klären; Projekt sucht Maintainer |
| Piper-Stimmen je Sprache (uk, ar, en, tr, fa) | TTS | je Stimme verschieden (uk lada Apache 2.0, ukrainian_tts CC0, en_GB alba CC BY 4.0, de thorsten medium CC0; ryan/lessac nicht-kommerziell) | teilweise (Sekundärquelle) | ar_JO und tr_TR in den gelesenen Dokumenten nicht genannt: **ungeklärt**; MODEL_CARDs nicht gelesen (Netzsperre); für fa nennt der Plan keine Piper-Stimme |
| Chromium/Playwright | nur Testwerkzeug im Entwicklungs-Container | unbekannt | nein | nicht Teil des Produkts |

## Offene Fragen (Antwort unbekannt)

1. Werden alle vier Zielsprachen (und fa) von TranslateGemma 12B in brauchbarer Qualität abgedeckt?
2. Gibt es für jede Zielsprache eine Piper-Stimme mit passender Lizenz?
3. Welche CUDA-/Treiberversion hat der gemietete Server (bestimmt das Basis-Image)?
4. Wie viele Zuhörer pro Raum sind realistisch (Netz, Audio-Datenmenge)?
5. Reicht die Verzögerung von 3–5 s? Messpunkte stehen im Messprotokoll.

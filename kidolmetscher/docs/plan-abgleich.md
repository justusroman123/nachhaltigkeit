# Abgleich mit dem „Plan Prototyp KI-Dolmetscher“ (Stand 11.11.2026)

Quelle: Google-Dokument „Plan Prototyp KI-Dolmetscher: Aufgaben, Prüfungen und Prompts (Stand 09.11.2026)“.
Legende: **✔** umgesetzt und getestet (Art des Tests steht dabei) · **◐** teilweise · **○** offen, braucht Sie, Hardware, ein Konto, Geld oder Netzzugang · **≠** bewusst anders gelöst.
„Getestet“ heißt hier: in der Entwicklungsumgebung mit Attrappen (Mock) und Chromium mit Fake-Mikrofon. Nichts davon wurde auf den echten Geräten oder mit echten Modellen geprüft.

## Phase 0: Klärungen

| Aufgabe | Status | Stand |
| --- | --- | --- |
| DJI am Chromebook prüfen | ○ | Hardware nötig. Werkzeug vorhanden: `web/mic-test.html` (✔ in Chromium mit Fake-Gerät). Anleitung in der README. |
| Fallback 3,5-mm-Weg | ○ | Hardware. |
| Tablets vorbereiten (Gastprofil, Updates, Kopfhörer-Anschluss), 2. Tablet, Kopfhörer | ○ | Checkliste in `docs/vorfuehrung.md`. |
| Lizenzen klären (Piper-Stimmen, Gemma, NLLB) | ◐ | Gelesen (MODEL_CARDs, Metadaten, Gemma-Bedingungen): `docs/lizenzen-recherche.md`. **Ergebnis: Türkisch-Stimme nicht-kommerziell, Arabisch-Stimme ungeklärt, NLLB nicht-kommerziell.** Rechtliche Bewertung und Entscheidung 3 offen. |
| centron schriftlich fragen, STACKIT | ◐ | centron-Seiten gelesen (Preis bestätigt, **gestoppt kostet laut Seite weiter**, Hallstadt, C5 Typ 1); AVV nicht gefunden. Fragenliste in `docs/kosten.md`, nichts versendet. STACKIT nicht gelesen. |
| Muttersprachler anfragen | ○ | Bewertungsbogen vorbereitet: `docs/bewertungsbogen.md`. |

## Phase 1: Server aufsetzen (erst nach Abnahme Phase 0)

| Aufgabe | Status | Stand |
| --- | --- | --- |
| Konto, Zahlungsweg, Instanz, SSH | ○ | Macht Jonas, nicht Claude. |
| Docker/NVIDIA-Toolkit, Modelle laden, HF-Token | ○ | Nichts installiert. Vorbereitet: `docker/Dockerfile.gpu`, `docker/docker-compose.yml` (Profil `gpu`: Dienst `gpu`, Modelle als Nur-lese-Volume `/models`, Port nur intern, davor Caddy mit TLS; Syntax mit `docker compose config` geprüft, nicht gebaut). |
| Firewall nur SSH und HTTPS | ◐ | Vorschlag ohne Aktivierung: `docs/firewall-vorschlag.md`. |
| Domain und Zertifikat | ○ | Domain offen (Entscheidung 4). Caddy-Konfiguration vorbereitet (`docker/Caddyfile`). |
| `scripts/smoke_test.sh` | ✔ | Läuft mit Mock; meldet echte Stufen klar als „nicht implementiert“ (pytest). Auf der GPU ungetestet. |
| Server nach Sitzung beenden | ◐ | Erinnerung beim Sitzungsende am Bedienplatz; Laufzeit-/Kostenanzeige (`SERVER_HOURLY_EUR`, `BUDGET_EUR`, Warnung ab 80 %). Gezählt wird die Laufzeit der Anwendung, nicht der Maschine. |

## Phase 2: Bausteine messen

| Aufgabe | Status | Stand |
| --- | --- | --- |
| 8 erfundene Testsätze | ✔ | `tests/audio/testsaetze.txt` (kurz, lang, Zahlen, Eigennamen, Fachwort). Einsprechen steht aus (○). |
| `bench_asr.py`, `bench_mt.py`, `bench_tts.py`, `bench_load.py` | ✔ | Laufen mit Mock und Platzhalter-Audio (`make_placeholder_audio.py`). Wortfehlerrate, zwei MT-Wege (direkt / Umweg über Englisch), VRAM über `nvidia-smi`, Markierung „ZU HOCH“. Schreiben mit Mock **nicht** ins Messprotokoll (pytest). |
| Prompt aus dem Report | ✔ | `app/pipeline/mt_prompt.py`, wortgleich zum Plan (pytest). |
| Messungen mit GPU, Go/No-Go | ○ | Server nötig. |

## Phase 3: Streaming-Backend

| Aufgabe | Status | Stand |
| --- | --- | --- |
| WebSocket für Audio (16 kHz, mono, 16 Bit), Operator-Schlüssel | ✔ | pytest + Browser. |
| Segmentierung (Satzende oder höchstens N Wörter, Standard 12) | ✔ | `pipeline/segmenter.py`, Konfiguration `SEGMENT_MAX_WORDS` (23 Tests). Verhalten mit echtem Whisper-Ausgabestrom: unbekannt. |
| Zuhörer per Link mit Zufalls-Token und Ablaufzeit | ✔ | |
| `/api/session` (Sitzung + Links je Sprache) | ✔ | zusätzlich zu den bisherigen Endpunkten. |
| Zeitstempel je Stufe, keine Inhalts-Logs | ✔ | pytest (u. a. Log-Test). |
| Rückstau je Sprache (Ton entfällt, Untertitel bleiben; älteste Segmente werden verworfen) | ✔ | pytest: langsame Sprache bremst andere nicht. Schwellen sind Platzhalter, nicht gemessen. |
| Mocks, Sitzungsende löscht Puffer | ✔ | |
| `/ws/listener/{token}?lang=uk` | ≠ | Token und Sprache kommen in der ersten WebSocket-Nachricht, nicht in der Adresse. Grund: Adressen landen in Protokollen von Proxy/Server. |
| `scripts/fake_speaker.py` | ✔ | Rundlauf gegen laufenden Server, siehe Testbericht. |

## Phase 4: Webseiten

| Aufgabe | Status | Stand |
| --- | --- | --- |
| Bedienplatz: Mikrofonwahl, Pegel, Start/Stopp, Sprachen, QR + Link | ✔ | Browser. DJI wird automatisch vorgewählt. QR serverseitig mit `segno` (keine externe Bibliothek), mit Decoder gegengelesen. |
| QR und Link **je Sprache** | ✔ | Einzel-Links im Bedienplatz; zusätzlich ein Sammel-Link für alle (einfacher). |
| Zuhörer: „Tippen zum Starten“, große Untertitel, Lautstärke, Ton aus/ein, Wiederverbinden, rechts-nach-links, Warteschlange ohne Überlappung | ✔ | Browser (Prüflauf F). Ton hörbar: nicht prüfbar (kein Lautsprecher). |
| Keine Cookies/Tracking/externe Ressourcen, strenge Header | ✔ | pytest + Prüflauf F (Fremdanfragen: keine; Speicher: leer). |
| Test auf beiden Tablets und dem Chromebook | ○ | Hardware. Layout nur in Chromium-Fenstergrößen geprüft. |

## Phase 5 bis 7

| Aufgabe | Status | Stand |
| --- | --- | --- |
| Gesamttest mit Hardware, Bewertungsbogen, Hotspot-Test, Routerentscheidung | ○ | Bewertungsbogen: ✔ vorbereitet. |
| Messpunkt t1 „Audio im Browser bis Server“ | ◐ | Ping-Messung und Schätzung am Bedienplatz (Annahme, keine Messung der echten Strecke); Zielwert < 0,3 s. |
| AVV, Behörden-Einsätze | ○ | Bei Ihnen / Fachleute. |
| Hinweis auf KI-Übersetzung (Art. 50 KI-VO) | ◐ | Auf der Zuhörerseite in 6 Sprachen. **Texte in uk, ar, tr, fa nicht von Muttersprachlern geprüft.** Rechtliche Wirkung: nicht geprüft. |
| Datenschutz-Merkblatt (eine Seite) | ◐ | `web/datenschutz.html`, **Entwurf**; Angaben zu Verantwortlichem und Anbieter fehlen (Platzhalter), rechtliche Prüfung steht aus. |
| Vorführungs-Skript, Ablauf, Packliste | ✔ | `docs/vorfuehrung.md` (erfundene Texte). |
| Backup-Aufnahme für Netzausfall | ○ | Nicht gebaut: eine Aufnahme zu speichern widerspricht „keine Speicherung“. Entscheidung nötig. |

## Prompts E bis G (Browser-Plugin)

| Prompt | Status | Stand |
| --- | --- | --- |
| E Recherche | ◐ | Gelesen: GitHub, Hugging Face (Piper-MODEL_CARDs, Modell-Metadaten), Gemma-Bedingungen, centron. Nicht gelesen: STACKIT, TranslateGemma-Modellkarte (gesperrt), Prohibited-Use-Policy (nicht ausgewertet), lessac-Lizenztext. |
| F Webseiten testen | ✔ | Automatisiert mit Chromium, Ergebnis im Testbericht (19 Punkte ok). Echtes WLAN aus/an am Tablet: ○. |
| G Vorführung vorbereiten | ◐ | Checkliste in `docs/vorfuehrung.md`; die automatisierbaren Schritte laufen im Browser-Test. |

## Entscheidungen aus Abschnitt 9 des Plans (bei Ihnen)

1. Wo läuft Claude Code? · 2. Sprachen im ersten Test (Empfehlung des Plans: Ukrainisch und Englisch zuerst) · 3. Piper-Stimmen mit Einschränkung nutzen oder anderes TTS? · 4. Domain (Subdomain von kischub.de?) · 5. Budgetgrenze (Vorschlag 50 €).

# Architektur KI-Dolmetscher (Stand 09.11.2026, mit dem Code abgeglichen am 17.11.2026)

**Hinweis zum Stand:** Abschnitte, die der Code überholt hat, sind mit „Überholt seit TT.MM.JJJJ“ gekennzeichnet und bleiben als Geschichte stehen. Standardwerte stehen in `server/app/config.py` und `.env.example`; hier werden sie nur genannt, wo sie die Aussage tragen.

Prototyp für KI-SCHUB: Ein deutscher Sprecher wird live in bis zu vier Zielsprachen
(uk, ar, en, tr; fa optional) übersetzt. Ausgabe im Browser der Zuhörer: Untertitel
und Ton, je Gerät eine Sprache. Ziel-Verzögerung 3–5 s (Ist-Wert: **unbekannt**, siehe Messprotokoll).
Zwei Betriebsarten (Vorgabe des Nutzers): **Vortrag** (einseitig, durchgehend sprechen) und **Gespräch** (abwechselnd mit Sperre; Gäste sprechen in ihrer Sprache, der Mitarbeiter liest und hört das Deutsche). Ergänzt am 15.–17.11.2026, Einzelheiten: `docs/gespraechsmodus-entwurf.md` und Protokoll Abschnitte 27 bis 32.

## Überblick

```
Bedienplatz (Chromebook, Browser)             Server (FastAPI, GPU-VM)             Zuhörer (Browser)
 DJI Mic Mini -> getUserMedia
 AudioWorklet: PCM16, 16 kHz, mono, 50 ms
        |  WebSocket /ws/operator (binär)
        +----------------------------------> Orchestrator (je Raum)
                                              ASR  -> Endsegment (Deutsch)
                                              je aktiver Sprache parallel:
                                                MT  -> TTS (optional)
                                              Raum.publish(Sprache)
                                                       |  WebSocket /ws/listener (JSON)
                                                       +--------------------------------> Untertitel + Ton
```

- **Stufen** ASR, MT, TTS liegen hinter Protokollen (`server/app/pipeline/base.py`).
  Je Stufe gibt es `*_mock.py` (läuft ohne GPU) und `*_real.py`. ~~`*_real.py`: nur Gerüst mit TODO.~~ **Überholt seit 12.11.2026:**
  die echten Stufen sind umgesetzt (faster-whisper, TranslateGemma über Transformers, Piper) und am 15.11.2026 auf der Test-VM gelaufen
  (RTX A4000, Modell 4B; Verzögerung und Qualität: unbekannt, nicht gemessen). Alte „TODO“-Kommentare in `server/app/main.py` und `docker/Dockerfile.gpu` stehen noch im Code.
  Auswahl über `ASR_BACKEND`, `MT_BACKEND`, `TTS_BACKEND` (`mock` | `real`).
- **Nur aktive Sprachen** werden übersetzt: Sprachen ohne verbundenen Zuhörer kosten keine GPU-Zeit.
- **Ein Bedienplatz je Raum**, beliebig viele Zuhörer (Obergrenze `MAX_LISTENERS_PER_ROOM`, Platzhalter, nicht gemessen).

## Module

| Datei | Aufgabe |
| --- | --- |
| `server/app/__main__.py` | **einziger Startweg:** `python -m app` (kein Zugriffslog, Stufe „warning“, keine Proxy-Header-Auswertung durch uvicorn, kleine WebSocket-Frames, Verbindungsobergrenze); seit 17.11.2026 |
| `server/app/config.py` | Einstellungen aus Umgebungsvariablen, Prüfung, Offline-Voreinstellungen der Modell-Bibliotheken |
| `server/app/messages.py` | Nachrichtenformat, Zeitstempel, Schließcodes |
| `server/app/rooms.py` | Räume, Betriebsart, Zuhörer-Tokens mit Ablauf, Ringpuffer, Warteschlangen, Aufräumen |
| `server/app/orchestrator.py` | ASR -> MT -> TTS je Raum, setzt Zeitstempel (zusätzlich zur Vorgabe) |
| `server/app/turns.py` | Gespräch: Sperrlogik „wer ist dran“ (frei, spricht, übersetzt, Wiedergabe), Zeitgrenzen; Vortrag: nur Zähler für die Anzeige |
| `server/app/conversation.py` | Gespräch, Richtung Gast zum Mitarbeiter: Sprache des Gastes erkennen, ins Deutsche übersetzen, an den Bedienplatz senden |
| `server/app/security.py` | CSP und Sicherheits-Header, Sperre nach falschen Schlüsseln (`FailureLimiter`), Größen- und Mengenbegrenzungen, Absenderkennung hinter dem Proxy |
| `server/app/main.py` | HTTP/WebSocket-Endpunkte, statische Dateien, Zeitgeber (Zeitgrenzen, Verlauf kürzen, Räume schließen) |
| `server/app/benchmarks.py` | Hilfen für die Messskripte (kein Netz, keine Modelle) |
| `server/app/pipeline/` | Stufen hinter Protokollen (`base.py`), je Stufe `*_mock.py` und `*_real.py`, `segmenter.py`, `text_clean.py`, `mt_prompt.py` |
| `web/operator.html`, `listener.html`, `mic-test.html` | Oberflächen, alles lokal ausgeliefert |
| `docs/betrieb.md` | Bedienung, Hosting-Empfehlung |
| `scripts/` | Einrichtung (`server_setup.sh`, `cloud-init-gpu.sh`), Dienst (`server_ctl.sh`), Messskripte; Skripte erzeugen die produktiven Caddyfiles |

## Ablauf einer Sitzung

1. Bedienplatz: `POST /api/rooms` mit Header `X-Operator-Key` (Wert aus Umgebung `OPERATOR_KEY`) und Betriebsart (`vortrag` oder `gespraech`). Es sind höchstens `MAX_ROOMS` Räume offen (Standard 20).
2. Bedienplatz erzeugt einen **Sammel-Link** (`POST /api/rooms/{id}/listener-links` ohne Sprache) und zeigt ihn als QR-Code
   (`POST /api/qr`, SVG, nichts wird gespeichert). Optional gibt es Einzel-Links je Sprache (`lang` angegeben, Link endet auf `&l=uk`).
   Der Token (192 Bit Zufall) steht im **Fragment** der URL (`/listener.html#t=…`), damit er nie in
   Server-Logs oder Referrer auftaucht. Der Server hält nur den SHA-256-Hash.
3. Zuhörer öffnet den Link, die Seite sendet den Token als erste WebSocket-Nachricht und wählt dann die Sprache
   (`{"type":"select","lang":"uk"}`, jederzeit wechselbar). Token und Auswahl stehen in der Adresse der Seite (`#t=…&l=…`, das Fragment geht nicht an den Server) und damit im Browserverlauf des Geräts; am Sitzungsende entfernt die Seite sie aus der Adresszeile. Es gibt weder Cookies noch Web-Storage.
   Erst nach der Wahl zählt der Zuhörer für die Übersetzung.
4. Bedienplatz verbindet `/ws/operator` (erste Nachricht: Raum und Schlüssel) und sendet Audio.
5. Sitzungsende: `DELETE /api/rooms/{id}`, Raum-Ablauf `ROOM_TTL_S` (Standard 43200 s) oder ein Raum ohne verbundenen Bedienplatz nach `ROOM_IDLE_S` (Standard 3600 s):
   Tokens, Zuhörer, Ringpuffer und die Warteschlange zum Bedienplatz werden gelöscht, Zuhörer erhalten `session_end`.
6. **Zugang (seit 17.11.2026, E50/E51):** Jeder Beitritt und jeder Weggang eines Zuhörers geht sofort als `listeners` an den Bedienplatz (Art, Sprache, Anzahl, keine Kennung). Der Bedienplatz zeigt „Verbunden: N“ und hat **einen** Knopf „Alle trennen, neuen Link erzeugen“ (`POST /api/rooms/{id}/disconnect-all`, nur mit Bedienschlüssel): alle Links des Raums werden ungültig, alle verbundenen Zuhörer erhalten `removed` und werden mit Code 4403 getrennt (die Seite verbindet sich nicht neu). Gäste sehen im Zustand der Sperre (`turn.who`, `turn.waiting`) nur `staff`, ihre eigene Kennung oder `gast`, nie die Kennung eines anderen Gastes.
   Je Raum gibt es höchstens `MAX_TOKENS_PER_ROOM` Zuhörer-Links (Standard 200).

### Ablauf im Gespräch (Betriebsart `gespraech`, seit 15.11.2026)

Im Gespräch spricht immer nur **eine** Person (Sperre `turns.py`): frei → spricht → übersetzt → Wiedergabe → frei. Die Sperre wird erst frei, wenn alle Geräte „fertig“ melden
(Ton zu Ende oder Text angezeigt) oder eine Zeitgrenze greift (`TURN_PROCESS_MAX_S` 90 s, `TURN_PLAY_MAX_S` 15 s plus Tonlänge, `TURN_GRACE_S` 0,5 s). Die Redezeit ist nicht begrenzt; nur
~~`TURN_IDLE_S` (120 s) ohne hörbare Sprache gibt das Wort frei.~~ **Überholt seit 17.11.2026 (E47):** `TURN_IDLE_S` ist standardmäßig 0 (aus); nur „Fertig“ oder der Stopp des Mitarbeiters beenden eine Aussage. Wer die Stille-Frist einschalten will, setzt 10 bis 3600 Sekunden. Der Mitarbeiter hat Vorrang (kann andere stoppen), Gäste können sich nur melden (`TURN_PICKUP_S` 30 s).
Bis zu `MAX_GUESTS` (3) Gäste gleichzeitig. Gäste senden ihr Mikrofon über `/ws/listener`; `conversation.py` erkennt die Sprache des Gastes, übersetzt ins Deutsche und sendet `guest_message`
an den Bedienplatz (Text und optional deutsche Sprachausgabe). Fehler gehen als `problem` an Mitarbeiter und Gast, nichts geht still verloren. Alles nur im Arbeitsspeicher.

## Nachrichtenformat (Version 1)

Server -> Zuhörer (`type: "translation"`):

```json
{"type":"translation","v":1,"seq":0,"lang":"uk","text":"…","final":true,
 "audio":{"format":"wav","sample_rate":22050,"data_b64":"…"} ,
 "t":{"t_audio_in":0,"t_asr":0,"t_mt":0,"t_tts":0,"t_out":0}}
```

- Bedienplatz erhält dieselbe Nachricht zusätzlich mit `text_src` (deutscher Quelltext).
- `audio` ist `null`, wenn TTS aus ist oder für die Sprache keine Stimme existiert; `t_tts` ist dann `null`.
- Steuernachrichten: `ready` (mit `lang`, `langs`, `rtl`, `mode`, `turn`, `device`, `operator_online`, `expires_in_s`), `session_end`, `token_expired`, `error` (`token_invalid`, `room_full`, `lang_invalid`).
  ~~Nur `ready`, `session_end`, `token_expired`, `error`.~~ **Überholt seit 15.11.2026:** zusätzlich `turn` (Zustand der Sperre im Gespräch, nur Zustand und Rolle), `busy` (Sprechen gerade nicht möglich), `problem` (Fehler ohne Inhalt, z. B. Erkennung oder Übersetzung gescheitert, Audio oder Nachrichten verworfen), `operator` (Bedienplatz verbunden oder nicht, an die Gäste), `delivery` (Zustellstand je Nachricht, nur Zähler, an den Bedienplatz), `flow` (Vortrag: ob noch etwas in Arbeit ist), `guest_message` (Gast-Aussage ins Deutsche übersetzt, an den Bedienplatz, mit `text`, `text_src` und optional Ton), `pong` (Antwort auf `ping` des Bedienplatzes).
- Nachrichten aus dem Ringpuffer tragen `"replay": true` und kein Audio.

### Zeitstempel (Regel 4)

Alle Werte sind ganze Millisekunden seit Unix-Epoche, **gemessen auf dem Server**.

| Feld | Bedeutung |
| --- | --- |
| `t_audio_in` | Server-Empfang des ersten Audio-Blocks, der zum Segment gehört |
| `t_asr` | Endsegment der Spracherkennung liegt vor |
| `t_mt` | Übersetzung dieser Sprache liegt vor |
| `t_tts` | Sprachausgabe liegt vor (`null`, wenn aus) |
| `t_out` | unmittelbar vor der Verteilung an die Zuhörer |

Reihenfolge `t_audio_in <= t_asr <= t_mt <= t_tts <= t_out` wird beim Erzeugen geprüft.
**Nicht enthalten:** Strecke Mikrofon -> Browser -> Server und Server -> Zuhörer-Browser -> Lautsprecher.
Dafür gibt es noch keinen Messpunkt (siehe Messprotokoll, Abschnitt „Offene Messpunkte“).

## Datenschutz und Sicherheit (Regel 1)

| Maßnahme | Umsetzung |
| --- | --- |
| Keine dauerhafte Speicherung von Audio/Text | nur Arbeitsspeicher (flüchtig); Ringpuffer nur Text, klein (`RING_BUFFER_SIZE` = 40 je Sprache, 0 = aus); Einträge älter als `HISTORY_S` (120 s) werden aktiv gelöscht (etwa alle 5 s, auch ohne Abruf); Löschung von Tokens, Zuhörern, Ringpuffer und Warteschlange zum Bedienplatz bei Sitzungsende |
| Keine Inhalts-Logs | Logs enthalten Sequenznummer, Sprache, Dauern, Zähler; Test `test_keine_inhalte_in_logs` |
| Server ohne Zugriffsprotokoll, ohne Adressen im Log | Start über `python -m app` (`server/app/__main__.py`: kein Zugriffslog, Stufe „warning“, keine Proxy-Header-Auswertung durch uvicorn, kleine WebSocket-Frames, Verbindungsobergrenze); zusätzlich Log-Filter für Verbindungszeilen; Test startet den echten Server |
| Keine Cookies, kein Tracking | Web-Dateien ohne Cookies/Storage; Test `test_web_static.py`; Token und Sprache stehen aber in der Adresse der Zuhörerseite (Browserverlauf) |
| Nichts extern | keine CDNs/Schriften/Skripte; CSP `default-src 'none'`, `script-src 'self'`, kein `unsafe-inline`; Test prüft alle Web-Dateien |
| Header | CSP, `nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `Strict-Transport-Security: max-age=31536000` (wird immer gesendet, ohne `includeSubDomains`/`preload`), `Permissions-Policy`, COOP/CORP, `X-Frame-Options` |
| Zuhörer-Links | Zufalls-Token, Ablaufzeit (gilt zum Beitreten), nur Hash im Speicher; ~~auch bei laufender Verbindung wird bei Ablauf getrennt~~ **Überholt seit 17.11.2026:** wer verbunden ist, bleibt bis zum Ende der Sitzung (`ROOM_TTL_S`) verbunden, damit nichts mitten im Gespräch abgeschnitten wird |
| Bedienplatz | Schlüssel aus Umgebung (`OPERATOR_KEY`, ≥ 16 Zeichen, ≥ 8 verschiedene Zeichen), Vergleich zeitkonstant; **Sperre gegen Raten (seit 16.11.2026):** 10 Fehlversuche in 600 s, dann 900 s Sperre je Absender (IPv4-Adresse bzw. IPv6-/64-Präfix, nur als Hash mit zufälligem Salz im Arbeitsspeicher), auch für den richtigen Schlüssel (HTTP 429, WebSocket-Code 4430); ein Erfolg löscht Fehlversuche nicht; die Zahlen sind Annahmen (`AUTH_MAX_FAILS`, `AUTH_WINDOW_S`, `AUTH_BLOCK_S`) |
| WebSocket | Herkunftsprüfung gegen fremde Webseiten im Browser: Origin muss zum Host passen. Clients **ohne** Origin-Header (kein Browser) werden nicht abgewiesen und müssen sich mit dem Bedienschlüssel anmelden; die Prüfung ist mit `ORIGIN_CHECK=false` abschaltbar (nur für Vorschau-Tests). Größengrenzen vor der Anmeldung, Begrenzung von Steuernachrichten und Audio-Zufluss je Verbindung |
| `mic-test.html` | einzige Seite mit Inline-Skript; bekommt in der CSP den Hash genau dieser Blöcke |

## Grenzen / Risiken (Stand Etappe 1)

- Mikrofonzugriff braucht einen **sicheren Kontext**: `localhost`, `file://` oder HTTPS. Der Bedienplatz auf dem
  Chromebook gegen einen entfernten GPU-Server braucht daher **HTTPS**. ~~TLS-Zertifikat/Reverse Proxy: offen.~~ **Überholt seit 15.11.2026:** HTTPS läuft auf der Test-VM über Caddy mit automatischem Zertifikat für `dolmetscher.kischub.de`. Offen: TLS-Versionen und Chiffren sind nicht geprüft; Protokolle von Caddy und Journal sind nicht auf Adressen geprüft.
- Browser-Verhalten auf Zuhörergeräten (Safari/iPad: WebSocket unter `connect-src 'self'`, Audio-Autoplay) ist **ungetestet**.
- ~~Kein Schutz gegen Dauer-Raten des Bedienschlüssels (nur Länge ≥ 16 Zeichen).~~ **Überholt seit 16.11.2026:** Sperre nach 10 Fehlversuchen in 10 Minuten für 15 Minuten (siehe Tabelle oben; Annahmen, nicht durch einen Penetrationstest geprüft). Offen bleiben: nur ein gemeinsamer Schlüssel ohne Rollen, Audit und Mehrfaktor-Anmeldung; ein Fremder hinter derselben öffentlichen Adresse kann den Bediener aussperren; Zuhörer-Links sind bis zum Ablauf nicht widerrufbar.
- Zuhörer-Obergrenze (`MAX_LISTENERS_PER_ROOM` = 100) und Warteschlangengrößen sind Platzhalter, keine Messwerte.
- Zeitstempel sind Wanduhr-Zeit des Servers (NTP-Sprünge möglich).

## Ergänzungen vom 11.11.2026 (Abgleich mit dem Plan, siehe `docs/plan-abgleich.md`)

- **Segmentierer** (`pipeline/segmenter.py`): nur bestätigte ASR-Textstücke; Schnitt am Satzende (Abkürzungen und ein-/zweistellige Ordnungszahlen zählen nicht)
  oder nach `SEGMENT_MAX_WORDS` Wörtern, bevorzugt an Komma/Semikolon/Doppelpunkt. **Überholt seit 15.11.2026:** Standard von `SEGMENT_MAX_WORDS` ist 40 (vorher 12); ein Rest ohne Satzzeichen wartet höchstens `SEGMENT_TAIL_HOLD_MS` (2200 ms) auf die Fortsetzung.
- **Rückstau je Sprache** (`orchestrator.py`): eigene Warteschlange und eigener Arbeiter je Sprache (`LANG_QUEUE_MAX` = 500; darüber werden die ältesten Segmente verworfen und gezählt).
  Der Ton entfällt erst ab `TTS_SKIP_BACKLOG` = 100000 wartenden Segmenten, praktisch nie; die Zuhörerseite lässt keinen Ton aus (`MAX_AUDIO_BACKLOG_S` = 3600). **Vollständigkeit geht vor Latenz.**
  Zähler: `audio_skipped_backpressure`, `segments_dropped_backpressure`, `audio_dropped`.
  ~~Ab `TTS_SKIP_BACKLOG` (damals 2) entfällt der Ton, `LANG_QUEUE_MAX` (damals 8); Zuhörerseite lässt Ton nach mehr als 6 s Rückstau aus.~~ **Überholt seit 15.11.2026** (Protokoll Abschnitt 25: Untertitel ohne Ton und verworfene Sätze). ASR und MT haben je eine Sperre (eine Rechnung zur Zeit für alle Sprachen).
- **Netzmessung:** Bedienplatz sendet alle 2 s `ping`, Server antwortet `pong` mit demselben Zeitwert. Die Seite zeigt Ping und eine Schätzung für „Mikrofon bis Server“ (Plan-Messpunkt t1).
- **Wiederverbinden des Bedienplatzes:** bei Verbindungsabbruch während des Sendens neuer Aufbau mit steigender Wartezeit, das Mikrofon läuft weiter.
- **`POST /api/session`:** legt Sitzung an und liefert Sammel-Link sowie Links je Sprache (für Skripte und Plan-Prompt D).
- **Kosten-Anzeige:** `GET /api/rooms/{id}/stats` enthält Laufzeit der Anwendung und optional `SERVER_HOURLY_EUR`/`BUDGET_EUR` (nur Bedienplatz).
- **Zuhörerseite:** „Tippen zum Starten“ nach der Sprachwahl (einmalig, mit „Nur Untertitel“), Lautstärkeregler, KI-Hinweis in der gewählten Sprache, Link zum Datenschutz-Merkblatt.
- **Abweichung vom Plan:** Token und Sprache der Zuhörer stehen in der ersten WebSocket-Nachricht (nicht in der WebSocket-Adresse), damit sie in keinem Protokoll landen. Auf der Seite selbst stehen sie im Fragment der Adresse und damit im Browserverlauf des Geräts (siehe Ablauf, Schritt 3).

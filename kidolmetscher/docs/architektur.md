# Architektur KI-Dolmetscher (Stand 09.11.2026)

Prototyp für KI-SCHUB: Ein deutscher Sprecher wird live in bis zu vier Zielsprachen
(uk, ar, en, tr; fa optional) übersetzt. Ausgabe im Browser der Zuhörer: Untertitel
und Ton, je Gerät eine Sprache. Ziel-Verzögerung 3–5 s (Ist-Wert: **unbekannt**, siehe Messprotokoll).

## Überblick

```
Bedienplatz (Chromebook, Browser)             Server (FastAPI, später GPU)             Zuhörer (Browser)
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
  Je Stufe gibt es `*_mock.py` (läuft ohne GPU) und `*_real.py` (nur Gerüst mit TODO).
  Auswahl über `ASR_BACKEND`, `MT_BACKEND`, `TTS_BACKEND` (`mock` | `real`).
- **Nur aktive Sprachen** werden übersetzt: Sprachen ohne verbundenen Zuhörer kosten keine GPU-Zeit.
- **Ein Bedienplatz je Raum**, beliebig viele Zuhörer (Obergrenze `MAX_LISTENERS_PER_ROOM`, Platzhalter, nicht gemessen).

## Module

| Datei | Aufgabe |
| --- | --- |
| `server/app/config.py` | Einstellungen aus Umgebungsvariablen, Prüfung |
| `server/app/messages.py` | Nachrichtenformat, Zeitstempel, Schließcodes |
| `server/app/rooms.py` | Räume, Zuhörer-Tokens mit Ablauf, Ringpuffer, Aufräumen |
| `server/app/orchestrator.py` | ASR -> MT -> TTS je Raum, setzt Zeitstempel (zusätzlich zur Vorgabe) |
| `server/app/security.py` | CSP und Sicherheits-Header (zusätzlich zur Vorgabe) |
| `server/app/main.py` | HTTP/WebSocket-Endpunkte, statische Dateien |
| `web/operator.html`, `listener.html`, `mic-test.html` | Oberflächen, alles lokal ausgeliefert |
| `docs/betrieb.md` | Bedienung, Hosting-Empfehlung |

## Ablauf einer Sitzung

1. Bedienplatz: `POST /api/rooms` mit Header `X-Operator-Key` (Wert aus Umgebung `OPERATOR_KEY`).
2. Bedienplatz erzeugt einen **Sammel-Link** (`POST /api/rooms/{id}/listener-links` ohne Sprache) und zeigt ihn als QR-Code
   (`POST /api/qr`, SVG, nichts wird gespeichert). Optional gibt es Einzel-Links je Sprache (`lang` angegeben, Link endet auf `&l=uk`).
   Der Token (192 Bit Zufall) steht im **Fragment** der URL (`/listener.html#t=…`), damit er nie in
   Server-Logs oder Referrer auftaucht. Der Server hält nur den SHA-256-Hash.
3. Zuhörer öffnet den Link, die Seite sendet den Token als erste WebSocket-Nachricht und wählt dann die Sprache
   (`{"type":"select","lang":"uk"}`, jederzeit wechselbar). Die Auswahl steht nur im Arbeitsspeicher und in der Adresse (`&l=…`), nichts wird gespeichert.
   Erst nach der Wahl zählt der Zuhörer für die Übersetzung.
4. Bedienplatz verbindet `/ws/operator` (erste Nachricht: Raum und Schlüssel) und sendet Audio.
5. Sitzungsende: `DELETE /api/rooms/{id}` (oder Raum-Ablauf `ROOM_TTL_S`): Tokens, Zuhörer, Ringpuffer
   werden gelöscht, Zuhörer erhalten `session_end`.

## Nachrichtenformat (Version 1)

Server -> Zuhörer (`type: "translation"`):

```json
{"type":"translation","v":1,"seq":0,"lang":"uk","text":"…","final":true,
 "audio":{"format":"wav","sample_rate":22050,"data_b64":"…"} ,
 "t":{"t_audio_in":0,"t_asr":0,"t_mt":0,"t_tts":0,"t_out":0}}
```

- Bedienplatz erhält dieselbe Nachricht zusätzlich mit `text_src` (deutscher Quelltext).
- `audio` ist `null`, wenn TTS aus ist oder für die Sprache keine Stimme existiert; `t_tts` ist dann `null`.
- Steuernachrichten: `ready` (mit `lang`, `langs`, `rtl`), `session_end`, `token_expired`, `error` (`token_invalid`, `room_full`, `lang_invalid`).
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
| Keine Speicherung von Audio/Text | nur Arbeitsspeicher; Ringpuffer nur Text, klein (`RING_BUFFER_SIZE`, 0 = aus); Löschung bei Sitzungsende |
| Keine Inhalts-Logs | Logs enthalten Sequenznummer, Sprache, Dauern, Zähler; Test `test_keine_inhalte_in_logs` |
| Server ohne Zugriffsprotokoll | Start mit `--no-access-log` |
| Keine Cookies, kein Tracking | Web-Dateien ohne Cookies/Storage; Test `test_web_static.py` |
| Nichts extern | keine CDNs/Schriften/Skripte; CSP `default-src 'none'`, `script-src 'self'`, kein `unsafe-inline`; Test prüft alle Web-Dateien |
| Header | CSP, `nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `Permissions-Policy`, COOP/CORP, `X-Frame-Options` |
| Zuhörer-Links | Zufalls-Token, Ablaufzeit, nur Hash im Speicher, auch bei laufender Verbindung wird bei Ablauf getrennt |
| Bedienplatz | Schlüssel aus Umgebung (`OPERATOR_KEY`, ≥ 16 Zeichen), Vergleich zeitkonstant |
| WebSocket | Origin muss zum Host passen |
| `mic-test.html` | einzige Seite mit Inline-Skript; bekommt in der CSP den Hash genau dieser Blöcke |

## Grenzen / Risiken (Stand Etappe 1)

- Mikrofonzugriff braucht einen **sicheren Kontext**: `localhost`, `file://` oder HTTPS. Der Bedienplatz auf dem
  Chromebook gegen einen entfernten GPU-Server braucht daher **HTTPS** (TLS-Zertifikat/Reverse Proxy: offen, kann Konten/Kosten verursachen).
- Browser-Verhalten auf Zuhörergeräten (Safari/iPad: WebSocket unter `connect-src 'self'`, Audio-Autoplay) ist **ungetestet**.
- Kein Schutz gegen Dauer-Raten des Bedienschlüssels (nur Länge ≥ 16 Zeichen); bei Veröffentlichung ins Internet ergänzen.
- Zuhörer-Obergrenze und Warteschlangengrößen sind Platzhalter, keine Messwerte.
- Zeitstempel sind Wanduhr-Zeit des Servers (NTP-Sprünge möglich).

## Ergänzungen vom 11.11.2026 (Abgleich mit dem Plan, siehe `docs/plan-abgleich.md`)

- **Segmentierer** (`pipeline/segmenter.py`): nur bestätigte ASR-Textstücke; Schnitt am Satzende (Abkürzungen und ein-/zweistellige Ordnungszahlen zählen nicht)
  oder nach `SEGMENT_MAX_WORDS` Wörtern, bevorzugt an Komma/Semikolon/Doppelpunkt.
- **Rückstau je Sprache** (`orchestrator.py`): eigene Warteschlange und eigener Arbeiter je Sprache. Ab `TTS_SKIP_BACKLOG` wartenden Segmenten entfällt der Ton
  (Untertitel kommen weiter), über `LANG_QUEUE_MAX` hinaus werden die ältesten Segmente verworfen. Zähler: `audio_skipped_backpressure`, `segments_dropped_backpressure`, `audio_dropped`.
  Zuhörerseite: Ton wird ausgelassen, wenn mehr als 6 s Ton wartet.
- **Netzmessung:** Bedienplatz sendet alle 2 s `ping`, Server antwortet `pong` mit demselben Zeitwert. Die Seite zeigt Ping und eine Schätzung für „Mikrofon bis Server“ (Plan-Messpunkt t1).
- **Wiederverbinden des Bedienplatzes:** bei Verbindungsabbruch während des Sendens neuer Aufbau mit steigender Wartezeit, das Mikrofon läuft weiter.
- **`POST /api/session`:** legt Sitzung an und liefert Sammel-Link sowie Links je Sprache (für Skripte und Plan-Prompt D).
- **Kosten-Anzeige:** `GET /api/rooms/{id}/stats` enthält Laufzeit der Anwendung und optional `SERVER_HOURLY_EUR`/`BUDGET_EUR` (nur Bedienplatz).
- **Zuhörerseite:** „Tippen zum Starten“ nach der Sprachwahl (einmalig, mit „Nur Untertitel“), Lautstärkeregler, KI-Hinweis in der gewählten Sprache, Link zum Datenschutz-Merkblatt.
- **Abweichung vom Plan:** Token und Sprache der Zuhörer stehen in der ersten WebSocket-Nachricht (nicht in der Adresse), damit sie in keinem Protokoll landen.

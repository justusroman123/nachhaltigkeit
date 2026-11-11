# KI-Dolmetscher (KI-SCHUB) – Projektkontext

Deutscher Sprecher wird live in bis zu 4 Zielsprachen übersetzt (uk, ar, en, tr; fa optional).
Ausgabe im Browser der Zuhörer (Untertitel + Ton, je Gerät eine Sprache). Verzögerung 3–5 s ist akzeptabel.
Bedienplatz: ASUS Chromebook Plus CX34 (nur Browser sicher verfügbar), Mikrofon DJI Mic Mini.
Server: gemieteter GPU-Server in Deutschland (RTX 6000 Ada 48 GB). Entwicklung zuerst ohne GPU mit Mocks.
Pipeline: Whisper large-v3 (SimulStreaming oder WhisperLiveKit) -> TranslateGemma 12B -> Piper (Lizenz offen).

## Verbindliche Regeln
1. **Datenschutz:** kein Speichern von Audio/Text, keine Inhalts-Logs (nur Zeitstempel/Zähler), keine Cookies/Tracking,
   keine externen Skripte/Schriften/CDNs, strenge Header/CSP, Zuhörer-Links mit Zufalls-Token und Ablauf,
   Puffer bei Sitzungsende löschen.
2. **Keine Geheimnisse** in Code/Repo. Tokens nur aus Umgebungsvariablen. `.env.example` ja, `.env` nie.
3. **Jede Pipeline-Stufe** (ASR, MT, TTS) hinter Protocol, mit Mock und echter Implementierung; Konfiguration per Umgebung.
4. **Jede Nachricht** trägt `t_audio_in`, `t_asr`, `t_mt`, `t_tts`, `t_out` (ms).
5. **Vor Installation/Kosten/Konten/Systemeinstellungen fragen.** Keine Zahlen raten: „unbekannt“ + Messpunkt.
6. Kommentare kurz und sachlich, README auf Deutsch.
7. **Google Drive** (Ordner „KI Dolmetscher“, ID 1EhUmj8XWyS4iUmtFThDuBZ-vQu4s0xec; Unterordner „01 Projektstand“, „02 Messprotokolle“, „03 Entscheidungen und Lizenzen“, „04 Testberichte“ bei Bedarf anlegen): nach jeder Etappe Dokumente ablegen
   (Titel „<Thema> (Stand TT.MM.JJJJ)“), nur Dokumente, nie Code/Tokens/.env/echte Testinhalte, nie überschreiben
   oder löschen, nach dem Speichern Ordner und Inhalt prüfen. Ohne Drive-Zugriff: `docs/drive-export/`.

## Arbeitsweise
- Nichts als fertig melden, was nicht gelaufen ist. Tests: `cd server && pytest`.
- Start: siehe README. Web-Dateien liegen unter `web/`, Server unter `server/app/`.

## Plan-Dokument
Maßgeblich für Phasen, Zielwerte und Entscheidungen ist das Google-Dokument „Plan Prototyp KI-Dolmetscher: Aufgaben, Prüfungen und Prompts (Stand 09.11.2026)“
im Drive-Ordner. Stand der Umsetzung: `docs/plan-abgleich.md`. Provider laut Plan: centron (GPU-Server, Hallstadt); nichts davon vom Assistenten geprüft.

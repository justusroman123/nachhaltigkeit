# KI-Dolmetscher (Prototyp für KI-SCHUB)

Ein deutscher Sprecher wird live in bis zu vier Zielsprachen übersetzt (Ukrainisch, Arabisch, Englisch, Türkisch;
Persisch optional). Zuhörer sehen Untertitel und hören die Übersetzung über Kopfhörer, je Gerät eine Sprache.

**Stand: Etappe 0 und 1.** Der Server läuft mit **Attrappen** (Mocks). Alle drei echten Stufen sind umgesetzt
(`asr_real.py` faster-whisper, `mt_real.py` Transformers, `tts_real.py` Piper; Einrichtung: `docs/betrieb.md`, Abschnitt 5 und 6).
**Mit großen Modellen und auf dem GPU-Server wurden sie noch nicht gelaufen**; die Übersetzung ist mit TranslateGemma nicht geprüft
(Modell gesperrt). Getestet wurde nur mit kleinen Ersatzmodellen auf der CPU. Nichts hier sagt etwas über Übersetzungsqualität
oder echte Verzögerung aus.

## So wird es bedient (Kurzfassung)

1. **Bedienplatz** im Browser öffnen (Adresse des Servers), Schlüssel eingeben, **„Sitzung starten“**.
2. **QR-Code** zeigen. Zuhörer scannen ihn und **tippen auf ihre Sprache** (Ukrainisch, Arabisch, Englisch, Türkisch; Persisch optional).
3. Mikrofon wählen, **„Senden starten“**, sprechen. Zuhörer sehen Untertitel und können den Ton (Kopfhörer) einschalten.
4. **„Sitzung beenden“** löscht alles.

**Schnell ausprobieren auf dem eigenen Rechner (Demo mit Attrappen, ohne Bedienschlüssel):**
Windows: `start.bat` doppelklicken (Python 3 muss installiert sein, https://www.python.org/downloads/, „Add python.exe to PATH“ ankreuzen).
Mac/Linux: `./start.sh`. Der Browser öffnet `http://localhost:8000/`. **Nicht** die HTML-Dateien aus dem Ordner direkt öffnen: Bedienplatz und
Zuhörerseite brauchen den Server (nur `web/mic-test.html` geht auch als Datei). Dort „Sitzung starten“, dann „Demo ohne Mikrofon“ oder „Senden starten“.
Anmeldung und Ablauf für einen Server-Test: `docs/server-test-einstunde.md`.

Wo die Anwendung laufen soll, wie man sie aufruft und was dafür nötig ist (HTTPS, Domain): **`docs/betrieb.md`**
(Empfehlung: auf dem gemieteten GPU-Server in Deutschland). Zum schnellen Ausprobieren ohne Server: `./start.sh`.

## Mikrofon testen (Etappe 0, Chromebook)

1. Ordner `web/` auf das Chromebook bringen (z. B. USB-Stick oder Download) und `mic-test.html` im Chrome-Browser öffnen
   (Strg+O, Datei wählen). Das braucht keinen Server und ändert nichts am System.
2. DJI-Mic-Empfänger anstecken, „Mikrofon freigeben“ klicken, Zugriff erlauben, in der Liste „DJI Mic Mini“ wählen.
3. Sprechen: Pegelbalken und Spitzenanzeige prüfen, Abtastrate, Kanäle sowie Echo-/Rauschunterdrückung ablesen.
4. Schalter für Echo/Rauschen/Pegelregelung ausschalten und vergleichen (Eingang startet dabei neu).
5. „5 s aufnehmen“, mit **Kopfhörern** abspielen, Werte in `docs/messprotokoll.md` (Abschnitt A) eintragen.

Alternativ mit lokalem Webserver (nur, wenn eine Linux-Umgebung auf dem Chromebook schon vorhanden ist):
`cd web && python3 -m http.server 8000`, dann `http://localhost:8000/mic-test.html`.
`localhost` und `file://` zählen für den Mikrofonzugriff als sicher. Ob `file://` auch auf ChromeOS funktioniert,
ist **nicht geprüft** (geprüft nur: Chromium unter Linux). Über eine normale `http://<IP>`-Adresse geht es nicht.

## Server starten (Mock, ohne GPU)

```bash
./start.sh        # legt beim ersten Mal eine lokale Python-Umgebung an und zeigt einen Bedienschlüssel
```

Dann `http://localhost:8000/` öffnen. Für Handys im selben WLAN: `HOST=0.0.0.0 ./start.sh` und am Bedienplatz die Adresse
des Rechners im Feld „Adresse für Zuhörer“ eintragen (Details: `docs/betrieb.md`). Die Mock-Stufen liefern Testsätze
(„[uk] Dies ist Testsatz Nummer 1 zur Probe.“) und einen Testton statt Sprache.

Von Hand: `cd server && pip install -r requirements-dev.txt && OPERATOR_KEY=... uvicorn app.main:create_app --factory --no-access-log`.
Einstellungen: siehe `.env.example` (Kopie als `.env`, wird nie eingecheckt; Variablen müssen in der Umgebung stehen,
der Server liest `.env` nicht selbst).

## Tests

```bash
cd server && pytest                 # 151 Tests: Räume, Token-Ablauf, Sprachwahl, Segmentierer, Rückstau, Nachrichtenformat, Zeitstempel, Messhilfen,
                                    # Mock-Pipeline, WebSocket-Ende-zu-Ende, Header, Datenschutzprüfung der Web-Dateien
node tests/e2e/browser_smoke.js     # optional: Browser-Rauchtest (siehe Kopfkommentar der Datei)
```

## Skripte (Messen und Testen ohne Mikrofon)

```bash
python3 scripts/make_placeholder_audio.py     # Platzhalter-Audio (kein Sprechen) aus tests/audio/testsaetze.txt
scripts/smoke_test.sh                          # laedt jede Stufe, verarbeitet einen Satz, zeigt Zeit und VRAM
python3 scripts/bench_asr.py|bench_mt.py|bench_tts.py|bench_load.py [--write]   # Messungen (Plan, Phase 2)
OPERATOR_KEY=... python3 scripts/fake_speaker.py --wav tests/audio/platzhalter/satz03.wav --langs uk,en   # Rundlauf mit Zeitstempeln
```

Die Messskripte schreiben bei Mock-Backend **nicht** ins Messprotokoll. Backend je Stufe: `ASR_BACKEND`, `MT_BACKEND`, `TTS_BACKEND`.

## Aufbau

```
server/app/   main.py config.py rooms.py messages.py orchestrator.py security.py  pipeline/ (base, *_mock, *_real)
server/tests/ pytest (+ e2e/browser_smoke.js)
web/          operator.html listener.html mic-test.html  js/ css/
docker/       Dockerfile.gpu docker-compose.yml (nicht gebaut/getestet)
scripts/      Messskripte, fake_speaker, Rauchtest
docs/         architektur.md entscheidungen.md messprotokoll.md betrieb.md plan-abgleich.md lizenzen-recherche.md
              kosten.md bewertungsbogen.md vorfuehrung.md firewall-vorschlag.md testberichte/
```

## Datenschutz in Kürze

Kein Speichern von Audio oder Text (nur Arbeitsspeicher, Puffer weg bei Sitzungsende), keine Inhalts-Logs, keine Cookies,
keine externen Ressourcen, strenge CSP, Zuhörer-Links mit Zufalls-Token und Ablaufzeit. Details und Grenzen:
`docs/architektur.md`.

## Offen

TLS für den Bedienplatz auf entferntem Server, echte Modelle und Lizenzen, Messungen mit GPU, Test auf Zuhörer-Tablets
(Safari/iPad), Docker-Build. Siehe `docs/plan-abgleich.md` (Stand je Planpunkt), `docs/entscheidungen.md` und `docs/messprotokoll.md`.

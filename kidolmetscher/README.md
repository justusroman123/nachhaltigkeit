# KI-Dolmetscher (Prototyp für KI-SCHUB)

Ein deutscher Sprecher wird live in bis zu vier Zielsprachen übersetzt (Ukrainisch, Arabisch, Englisch, Türkisch;
Persisch optional). Zuhörer sehen Untertitel und hören die Übersetzung über Kopfhörer, je Gerät eine Sprache.

**Stand: 17.11.2026 (Prototyp, Termin-Betrieb auf gemieteter GPU-VM).** Ohne GPU läuft der Server mit **Attrappen** (Mocks).
Alle drei echten Stufen (`asr_real.py` faster-whisper mit Pausenerkennung, `mt_real.py` TranslateGemma über Transformers,
`tts_real.py` Piper) **liefen auf einer gemieteten GPU-VM** (Test 13. bis 15.11.2026: RTX 6000 Ada mit 12B, RTX A4000 mit 4B; Handy-Test am 15.11.).
Es gibt **zwei Betriebsarten**: **Vortrag** (einer spricht, keine Sperre) und **Gespräch** (abwechselnd mit Gästen, Sperre, Wortmeldung, Vorrang des Mitarbeiters).
Einrichtung: `docs/betrieb.md` (Abschnitt 5 und 6) und `docs/vm-neu-einrichten.md`; Ablauf eines Servertests: `docs/server-test-ablauf.md`.
**Nicht gemessen** sind Übersetzungsqualität je Sprache und die Verzögerung (Nutzerschätzung ca. 1 s); die Tests mit Tablets (iOS/Safari) und die Wirkung im Behördeneinsatz stehen aus. Protokoll mit Stand und offenen Punkten: `docs/projektstand-2026-11-13.md` (Abschnitte 27 bis 32 und 11a).

## So wird es bedient (Kurzfassung)

1. **Bedienplatz** im Browser öffnen (Adresse des Servers), Schlüssel eingeben, **„Sitzung starten“**.
2. **QR-Code** zeigen. Zuhörer scannen ihn und **tippen auf ihre Sprache** (Ukrainisch, Arabisch, Englisch, Türkisch; Persisch optional).
3. Mikrofon wählen, **„Senden starten“**, sprechen. Zuhörer sehen Untertitel und können den Ton (Kopfhörer) einschalten.
4. **„Sitzung beenden“** löscht alles.

Im **Gespräch** (Auswahl beim Sitzungsstart) tippt der Mitarbeiter „Sprechen“ und „Fertig“; Gäste sprechen am Tablet in ihrer Sprache, der Mitarbeiter liest die deutsche Übersetzung und hört sie vorgelesen, sofern die deutsche Stimme eingerichtet ist (`scripts/stimme_de_einrichten.sh`).
Eine Aussage endet nur durch „Fertig“ oder den Stopp des Mitarbeiters; es gibt keine Redezeit-Grenze und keine Zeitschaltung (die Stille-Frist `TURN_IDLE_S` ist standardmäßig aus, `0`).

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

Von Hand: `cd server && pip install -r requirements-dev.txt && OPERATOR_KEY=... python -m app` (sichere Voreinstellungen: kein Zugriffslog, keine Adressen im Log, kleine WebSocket-Frames; siehe `server/app/__main__.py`).
Einstellungen: siehe `.env.example` (Kopie als `.env`, wird nie eingecheckt; Variablen müssen in der Umgebung stehen,
der Server liest `.env` nicht selbst).

## Tests

```bash
cd server && pytest                 # 349 bestanden, 4 übersprungen (Stand 18.11.2026): Räume, Token-Ablauf, Sprachwahl, Segmentierer, Rückstau, Nachrichtenformat, Zeitstempel,
                                    # Mock-Pipeline, WebSocket-Ende-zu-Ende, Gespräch (Sperre, Wortmeldung, Abbruch, Zufallsläufe), Sicherheit
                                    # (Größengrenzen, Fluten, Adressen im Log mit echtem Server-Prozess), Header, Datenschutzprüfung der Web-Dateien
node tests/e2e/browser_smoke.js     # optional: Browser-Rauchtest Vortrag (siehe Kopfkommentar der Datei)
node tests/e2e/gast_ohne_server.js  # optional (Playwright): Gast-Tablet im Gespräch mit nachgestelltem Server; ebenso operator_ohne_server.js, gespraech.js
node tests/e2e/geraete_layout.js    # optional: Geräte-Test in Chromium-Emulation (GERAET=Gast-Profil, OP_GERAET=Bedienplatz-Profil, z. B. "iPhone SE" / "Chromebook 125%");
                                    # alle Profile nacheinander: geraete_matrix.js (etwa 20 bis 30 Minuten); Mikrofon-Abtastrate: audio_abtastrate.js.
                                    # Kein echtes Gerät, keine Safari-/Firefox-Engine: Grenzen und Handprüfung in docs/testberichte/testbericht-geraete-2026-11-18.md
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
server/app/   __main__.py main.py config.py rooms.py messages.py orchestrator.py security.py turns.py conversation.py benchmarks.py
              pipeline/ (base, *_mock, *_real, segmenter, text_clean, mt_prompt)
server/tests/ pytest (+ e2e/*.js, Browser-Szenarien mit Playwright)
web/          operator.html listener.html mic-test.html  js/ css/
docker/       Dockerfile.gpu docker-compose.yml Caddyfile (nicht gebaut/getestet)
windows/      vm-einrichten.ps1/.bat start-tunnel.bat hole-bewertungsbogen.bat
scripts/      Messskripte, fake_speaker, Rauchtest
docs/         architektur.md entscheidungen.md messprotokoll.md betrieb.md plan-abgleich.md lizenzen-recherche.md
              kosten.md bewertungsbogen.md vorfuehrung.md firewall-vorschlag.md testberichte/
```

## Datenschutz in Kürze

Kein Speichern von Audio oder Text (nur Arbeitsspeicher, Puffer weg bei Sitzungsende; der Verlauf für spät verbundene Zuhörer
wird nach `HISTORY_S`, Standard 120 s, aktiv gelöscht), keine Inhalts-Logs und keine Adressen im Log, keine Cookies,
keine externen Ressourcen, strenge CSP, Zuhörer-Links mit Zufalls-Token und Ablaufzeit, Sperre nach falschen Bedienschlüsseln.
Im **Gespräch** wird auch die **Stimme der Gäste** zum Server übertragen (erkannt, ins Deutsche übersetzt, nicht gespeichert); das Merkblatt `web/datenschutz.html`
beschreibt das, ist aber ein **Entwurf mit Platzhaltern** (Verantwortlicher, Rechtsgrundlage); rechtliche Prüfung steht aus. Details und Grenzen:
`docs/architektur.md`, `docs/datenschutz-nachweis.md`.

## Offen

HTTPS über Caddy lief im Test am 15.11.2026 (nicht als Dauerbetrieb); offen sind Messungen mit GPU (Verzögerung, Qualität je Sprache),
Tests auf Gast-Tablets (Safari/iPad) und Chromebook, Muttersprachler-Prüfung der Oberflächentexte, Datenschutz und Verträge für den Behördeneinsatz, Docker-Build
(`docker/Dockerfile.gpu` nicht gebaut). Siehe `docs/plan-abgleich.md` (Stand je Planpunkt), `docs/entscheidungen.md` und `docs/messprotokoll.md`.

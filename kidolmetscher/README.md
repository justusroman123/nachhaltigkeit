# KI-Dolmetscher (Prototyp für KI-SCHUB)

Ein deutscher Sprecher wird live in bis zu vier Zielsprachen übersetzt (Ukrainisch, Arabisch, Englisch, Türkisch;
Persisch optional). Zuhörer sehen Untertitel und hören die Übersetzung über Kopfhörer, je Gerät eine Sprache.

**Stand: Etappe 0 und 1.** Der Server läuft mit **Attrappen** (Mocks). Die echten Modelle (Whisper, TranslateGemma,
Piper) sind noch nicht angebunden: `*_real.py` sind Gerüste mit TODO. Nichts hier sagt etwas über Übersetzungsqualität
oder echte Verzögerung aus.

## So wird es bedient (Kurzfassung)

1. **Bedienplatz** im Browser öffnen (Adresse des Servers), Schlüssel eingeben, **„Sitzung starten“**.
2. **QR-Code** zeigen. Zuhörer scannen ihn und **tippen auf ihre Sprache** (Ukrainisch, Arabisch, Englisch, Türkisch; Persisch optional).
3. Mikrofon wählen, **„Senden starten“**, sprechen. Zuhörer sehen Untertitel und können den Ton (Kopfhörer) einschalten.
4. **„Sitzung beenden“** löscht alles.

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
(„[uk] Dies ist Testsatz Nummer 1.“) und einen Testton statt Sprache.

Von Hand: `cd server && pip install -r requirements-dev.txt && OPERATOR_KEY=... uvicorn app.main:create_app --factory --no-access-log`.
Einstellungen: siehe `.env.example` (Kopie als `.env`, wird nie eingecheckt; Variablen müssen in der Umgebung stehen,
der Server liest `.env` nicht selbst).

## Tests

```bash
cd server && pytest                 # 103 Tests: Räume, Token-Ablauf, Sprachwahl, Nachrichtenformat, Zeitstempel,
                                    # Mock-Pipeline, WebSocket-Ende-zu-Ende, Header, Datenschutzprüfung der Web-Dateien
node tests/e2e/browser_smoke.js     # optional: Browser-Rauchtest (siehe Kopfkommentar der Datei)
```

## Aufbau

```
server/app/   main.py config.py rooms.py messages.py orchestrator.py security.py  pipeline/ (base, *_mock, *_real)
server/tests/ pytest (+ e2e/browser_smoke.js)
web/          operator.html listener.html mic-test.html  js/ css/
docker/       Dockerfile.gpu docker-compose.yml (nicht gebaut/getestet)
docs/         architektur.md entscheidungen.md messprotokoll.md betrieb.md
```

## Datenschutz in Kürze

Kein Speichern von Audio oder Text (nur Arbeitsspeicher, Puffer weg bei Sitzungsende), keine Inhalts-Logs, keine Cookies,
keine externen Ressourcen, strenge CSP, Zuhörer-Links mit Zufalls-Token und Ablaufzeit. Details und Grenzen:
`docs/architektur.md`.

## Offen

TLS für den Bedienplatz auf entferntem Server, echte Modelle und Lizenzen, Messungen mit GPU, Test auf Zuhörer-Tablets
(Safari/iPad), Docker-Build. Siehe `docs/entscheidungen.md` und `docs/messprotokoll.md`.

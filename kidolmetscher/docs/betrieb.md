# Betrieb: Aufrufen, Sprachen, Hosting (Stand 09.11.2026, mit dem Code abgeglichen am 17.11.2026)

Überholte Aussagen sind mit „Überholt seit TT.MM.JJJJ“ gekennzeichnet und bleiben als Geschichte stehen. Standardwerte stehen in `server/app/config.py` und `.env.example` (ein Test prüft, dass beide übereinstimmen); sie werden hier nur genannt, wo sie die Aussage tragen.

Google Drive enthält nur Dokumente, **nicht** die Anwendung. Die Anwendung ist ein Server, der irgendwo laufen muss;
Bedienplatz und Zuhörer rufen ihn im Browser auf.

## 1. So wird die Anwendung bedient

**Bedienplatz (Chromebook):** Adresse des Servers öffnen (z. B. `https://dolmetscher.example.org/`).

1. Bedienschlüssel eingeben. Betriebsart wählen (Vortrag oder Gespräch). Sprachen anhaken. Standard im Code: Ukrainisch, Arabisch, Englisch, Türkisch sind vorab angehakt, Persisch ist optional (`DEFAULT_LANGS`). Auf der Test-VM setzt `scripts/server_setup.sh` `TARGET_LANGS=uk,ar,en,tr` und `DEFAULT_LANGS=uk,en`; der Mini-Starter `scripts/cloud-init-launcher.sh` überschreibt `DEFAULT_LANGS` (Beispiel dort: `uk`). Nach zehn falschen Schlüsseln innerhalb von 10 Minuten sperrt der Server den Absender für 15 Minuten (auch für den richtigen Schlüssel).
2. **„Sitzung starten“.** Es erscheint ein QR-Code mit Link: auf Beamer/Bildschirm zeigen oder Link kopieren und verschicken.
3. Mikrofon prüfen (ein DJI-Mikrofon wird automatisch gewählt), **„Senden starten“**, sprechen.
4. Unter „Live“ sieht man, wie viele Zuhörer in welcher Sprache verbunden sind, und die Verzögerung.
5. Ende: **„Sitzung beenden und alles löschen“** (Links ungültig, Puffer gelöscht).

**Zuhörer (Handy/Tablet):** QR-Code scannen oder Link öffnen, **auf die eigene Sprache tippen**, fertig. Untertitel erscheinen groß.
Oben rechts: 🌐 Sprache wechseln, 🔇/🔊 Ton an/aus (Kopfhörer; Ton muss einmal bewusst eingeschaltet werden, sonst blockt der Browser),
A− / A+ Schriftgröße. Der Link läuft nach der eingestellten Zeit ab (Standard 1 Stunde).

**Sprachen:** wählbar sind `uk` Ukrainisch, `ar` Arabisch, `en` Englisch, `tr` Türkisch, `fa` Persisch (optional).
Welche Sprachen überhaupt zur Auswahl stehen, steht in `TARGET_LANGS`; was vorab angehakt ist, in `DEFAULT_LANGS`
(siehe `.env.example`). Es wird nur in Sprachen übersetzt, in denen gerade ein Zuhörer verbunden ist.
Ob jede Sprache mit den echten Modellen gut funktioniert, ist **unbekannt** (Mock-Stufen liefern nur Testsätze).

## 2. Heute testen (ohne GPU, ohne Cloud)

Auf einem Rechner mit Python 3: `./start.sh` im Projektordner (startet über `python -m app`; das ist seit 17.11.2026 der einzige Startweg, weil nur er Zugriffslog und Adressen im Log abschaltet). Der Bedienschlüssel wird beim Start angezeigt.
Dann `http://localhost:8000/` im Browser. Mikrofon geht auf `localhost`.

Zuhörer-Handys im selben WLAN: `HOST=0.0.0.0 ./start.sh` (öffnet den Server im lokalen Netz, nur in vertrauenswürdigem Netz),
am Bedienplatz im Feld „Adresse für Zuhörer“ die Adresse des Rechners eintragen (`http` + `://` + IP des Rechners + `:8000`).
Zuhörer brauchen kein Mikrofon, daher geht das ohne HTTPS. Der Bedienplatz selbst bleibt auf `localhost`.

## 3. Wo soll es laufen? Empfehlung

| Option | Bewertung |
| --- | --- |
| **A. Auf dem gemieteten GPU-Server in Deutschland (empfohlen)** | Die Pipeline läuft dort ohnehin. Audio und Texte verlassen den Server nicht, kein zusätzlicher Anbieter. Server vor Ort in Deutschland. |
| B. Zusätzlicher kleiner Server nur für Tests ohne GPU | Sinnvoll, falls der GPU-Server noch nicht verfügbar ist. Zusätzlicher Anbieter, Kosten **unbekannt**. Nur nach Rückfrage. |
| C. US-Cloud-Dienste für den Audiopfad | **Nicht empfohlen**: Datenschutz und Auftragsverarbeitung wären zusätzlich zu klären. |
| D. Tunnel-Dienste (z. B. ngrok, Cloudflare-Tunnel) | Nur für kurze Tests, nicht für echte Veranstaltungen: der gesamte Verkehr läuft über einen Dritten; Konto nötig. |
| E. Google Drive/Docs | **Ungeeignet**: kann keine Anwendung ausführen. Bleibt Ablage für Dokumente. |

**Warum HTTPS nötig ist:** Der Browser erlaubt Mikrofonzugriff nur über HTTPS (oder `localhost`). Der Bedienplatz auf dem
Chromebook braucht daher eine Adresse mit gültigem Zertifikat. Zuhörer brauchen es technisch nicht, aber ohne HTTPS warnen Browser.

**Was dafür gebraucht wird (nichts davon habe ich angelegt oder gekauft):**

1. Eine **Domain** oder Subdomain, die auf die Adresse des GPU-Servers zeigt. Kosten: **unbekannt**, abhängig vom Anbieter.
2. Einen **Reverse Proxy** mit automatischem Zertifikat, z. B. Caddy (freie Software). Beispiel `Caddyfile`
   (Beispiel; Zugriffsprotokoll nicht aktivieren, bitte Standardverhalten der installierten Version prüfen). **Stand 17.11.2026:** Auf der Test-VM läuft Caddy seit 15.11.2026 mit einem solchen Caddyfile (erzeugt von `scripts/cloud-init-gpu.sh` bzw. `scripts/oeffentlich_freigeben.sh`, nicht aus `docker/Caddyfile`). Dass kein `log`-Block im Caddyfile steht, belegt **nicht**, dass Caddy und das Systemjournal keine Adressen schreiben: unbekannt, Messbefehl in `docs/datenschutz-nachweis.md` (Abschnitt 1, Zeile zu den Protokollen).

   ```
   dolmetscher.example.org {
       reverse_proxy 127.0.0.1:8000
   }
   ```

3. Auf dem Server: Anwendung starten (`python -m app` im Ordner `server/`, auf der VM als Dienst über `scripts/server_ctl.sh`; der Docker-Weg `docker compose ... --profile gpu up` ist ungebaut), `PUBLIC_URL=https://dolmetscher.example.org`
   und einen langen `OPERATOR_KEY` setzen (nicht ins Repository).
4. Firewall: nur Ports 80 und 443 (und SSH) öffnen. Der Anwendungs-Port 8000 bleibt nur lokal.

**Datenschutz-Punkte, die vor dem echten Einsatz geklärt werden müssen (ich bin kein Jurist):**
Auftragsverarbeitungsvertrag mit dem Hosting-Anbieter, Hinweis an Zuhörer, Aufbewahrungsfristen des Anbieters (Server-Logs, Snapshots),
ob die Muttergesellschaft des Anbieters außerhalb der EU sitzt. Antworten dazu: **unbekannt**.

## 4. Offene Fragen an den Betreiber

1. Bei welchem Anbieter ist der GPU-Server gemietet? (bestimmt die konkreten Schritte, Basis-Image und Netzwerkregeln)
2. Gibt es schon eine Domain, die genutzt werden kann?
3. Soll ich Schritt für Schritt eine Installationsanleitung für diesen Anbieter schreiben? (Installation auf dem Server nur nach Ihrer Freigabe.)

## Nachtrag 11.11.2026: Angaben aus dem Plan-Dokument

- **Anbieter laut Plan: centron** (RTX 6000 Ada 48 GB, Standort Hallstadt, laut Plan 1,19 € pro Stunde netto, nur GPU-Anteil; *Überholt seit 14.11.2026: im Einsatz ist die RTX A4000 16 GB, Gesamtpreis laut Checkout 0,2652 € pro Stunde netto; die Ada kostet gesamt 1,2641 €, siehe `docs/kosten.md`*; stündliche Abrechnung; in der Console heißt die Region „Bamberg · BBG1“ und wird bei der Anlage der VM von Hand gewählt, die Console bietet auch „Glattbrugg“ in der Schweiz an; die Anwendung und die Skripte prüfen die Region nicht; Region und AVV je Einsatz bestätigen lassen); Alternative STACKIT L40S (1,74 € pro Stunde).
  Von mir **nicht** geprüft (Seiten aus der Sitzung nicht erreichbar). Offene Punkte beim Anbieter: AVV, Kosten pausierter Server, Gesamtpreis, Zertifizierungen. Fragenliste: `docs/kosten.md`.
- **Docker mit HTTPS:** `docker compose -f docker/docker-compose.yml --profile gpu up --build` startet die Anwendung (Dienst `gpu`, Modelle als Nur-lese-Volume `/models`) und davor Caddy (`docker/Caddyfile`).
  Nötig: `.env` mit `OPERATOR_KEY`, Umgebungsvariablen `BASE_IMAGE`, `DOMAIN`, `MODELS_DIR`. **Nicht gebaut und nicht getestet.**
- **Firewall:** nur Vorschlag, nichts aktiviert: `docs/firewall-vorschlag.md`.
- **Achtung Kosten:** Laut centron-Seite (gelesen 11.11.2026) laufen Kosten auch bei gestoppter Instanz weiter, bis sie gelöscht wird. „Server pausieren“ spart nach dieser Aussage **kein** Geld; verbindlich beim Anbieter klären.
- **Kosten und Budget:** `docs/kosten.md`; Anzeige am Bedienplatz über `SERVER_HOURLY_EUR` und `BUDGET_EUR`.
- **Vorführung:** Skript und Checkliste in `docs/vorfuehrung.md`.
- Die Frage nach dem Anbieter ist damit beantwortet. Offen bleiben: Domain (Subdomain von kischub.de?) und Budgetgrenze (Vorschlag des Plans: 50,00 €). **Überholt seit 15.11.2026 (Domain):** `dolmetscher.kischub.de` ist angelegt (A-Eintrag beim DNS-Anbieter der Domain) und liefert HTTPS über Caddy; Budgetgrenze weiter offen.

## 5. Echte Sprachausgabe (Piper) einrichten (Stand 12.11.2026)

Umgesetzt und mit Attrappen-Modul sowie mit echten Stimmen getestet. Läuft auf der CPU, braucht keine GPU.

1. Paket installieren (optional, GPL-3.0, Entscheidung E10 offen): `pip install -r server/requirements-tts.txt`
2. Stimmen laden (nur vor dem Termin; Lizenz jeder Stimme vorher prüfen, `docs/lizenzen-recherche.md`):
   `python3 scripts/fetch_voices.py models/voices uk_UA-ukrainian_tts-medium en_GB-alba-medium`
3. Einstellen (Umgebung oder `.env`):
   `TTS_BACKEND=real`, `TTS_VOICE_DIR=models/voices`, `TTS_VOICES=uk=uk_UA-ukrainian_tts-medium:0,en=en_GB-alba-medium`
   (Format `sprache=stimme[:sprecher]`; `ukrainian_tts` hat mehrere Sprecher, 0 bis 2).
4. Sprache ohne Stimme (z. B. Arabisch, Türkisch, solange keine freie Stimme gewählt ist): nur Untertitel, kein Ton.

Hinweise:
- Die Stimme `en_GB-alba-medium` steht unter CC BY 4.0 (Namensnennung nötig), `ukrainian_tts` unter CC0 (laut MODEL_CARD).
- Die Stimme `ukrainian_tts` kennt nur Kleinbuchstaben; die Anwendung schreibt den Text für sie klein.
- Audio bleibt im Arbeitsspeicher, es wird keine Datei geschrieben (Test).
- Starten mit nur echter Sprachausgabe (ASR und MT als Attrappe) ist möglich: `ASR_BACKEND=mock MT_BACKEND=mock TTS_BACKEND=real`. Die Attrappen-Übersetzung ist aber kein Ukrainisch, dann klingt die Stimme falsch; das ist erst mit echter Übersetzung hörbar sinnvoll.

## 6. Echte Spracherkennung und Übersetzung einrichten (Stand 12.11.2026)

Umgesetzt und mit **kleinen Ersatzmodellen auf der CPU** getestet (Whisper tiny, Qwen2.5-0.5B-Instruct als Übersetzer). ~~**Nicht** getestet: Whisper large-v3, TranslateGemma, GPU.~~ **Überholt seit 15.11.2026:** Auf der Test-VM (RTX A4000, Modell TranslateGemma 4B) lief der Dienst mit den echten Stufen; laut Nutzerbericht funktionierte die Übersetzung auf dem Smartphone. Verzögerung, Speicher und Qualität je Sprache sind **unbekannt** und nicht gemessen (Protokoll Abschnitte 18 und 19).

**Spracherkennung** (`ASR_BACKEND=real`): faster-whisper (Bibliothek, MIT laut Lizenzdatei des Projekts; die Lizenz der Modellgewichte ist in den Quellen widersprüchlich, MIT oder Apache-2.0, siehe `docs/lizenzen-recherche.md`). Weg „pausenbasiert“: Die Anwendung erkennt Sprechpausen an der Lautstärke, sammelt den Abschnitt im Arbeitsspeicher und lässt Whisper ihn erkennen. Die Verzögerung ist Abschnittslänge plus Erkennungszeit; das ist höher als bei echtem Streaming (SimulStreaming/WhisperLiveKit, Entscheidung E9 offen). Schwellen sind Annahmen und an echten Aufnahmen zu messen: `ASR_SILENCE_MS` (Standard 800), `ASR_MAX_UTTERANCE_S` (8.0), `ASR_VAD_RMS` (400), `ASR_MIN_SPEECH_MS` (300). ~~Frühere Werte 700 ms und 12 s.~~ **Überholt seit 15.11.2026** (zwischenzeitlich 1200 ms und 20 s, Protokoll Abschnitt 24; Standardwerte in `config.py`).
1. `pip install -r server/requirements-asr.txt`
2. Modell vor dem Termin laden: `python3 scripts/fetch_models.py Systran/faster-whisper-large-v3 models/whisper-large-v3` (Repo-ID vor Einsatz prüfen)
3. `ASR_MODEL=models/whisper-large-v3`, auf dem GPU-Server `ASR_DEVICE=cuda`, `ASR_COMPUTE_TYPE=float16`. Der Code-Standard `ASR_MODEL=large-v3` (ohne lokalen Ordner) würde beim ersten Start einen Download von Hugging Face auslösen; im Betrieb darum immer den lokalen Ordner setzen. Zeigen `ASR_MODEL` und `MT_MODEL_ID` auf lokale Ordner, stellt die Anwendung `HF_HUB_OFFLINE` und `TRANSFORMERS_OFFLINE` selbst auf 1 und schaltet Telemetrie der Bibliotheken ab (seit 17.11.2026; wer zum ersten Mal lädt, setzt `HF_HUB_OFFLINE=0`).

**Übersetzung** (`MT_BACKEND=real`): Transformers. `pip install -r server/requirements-mt.txt` (PyTorch-Version muss zum CUDA-Treiber des Servers passen: unbekannt). `MT_MODEL_ID` ist der Ordner oder die ID des Modells. Modell-ID: `google/translategemma-12b-it` (freigabepflichtig; Freigabe ist erteilt). Das Format folgt der Modellkarte (siehe `docs/translategemma-modellkarte.md`): Sprachcodes als Felder, geladen mit `AutoProcessor`/`AutoModelForImageTextToText`; Qualität je Sprache ist **unbekannt**. Mit dem Ersatzmodell habe ich nur den Modus `plain` getestet, den `structured`-Ablauf nur mit Attrappen. Mit `HF_TOKEN` nach Freigabe laden: `python3 scripts/fetch_models.py <repo-id> models/translategemma`.

**Gesamtlauf auf der CPU (Ersatzmodelle, Deutsch zu Englisch, Ton):** erkannt „Guten Tag und herzlich Willkommen zur Veranstaltung.“, übersetzt „Good morning and welcome to the event.“, mit englischem Ton. Die Zeiten dort (ASR 530 bis 1065 ms, MT 1262 bis 1424 ms, TTS 86 bis 134 ms) sagen nichts über den GPU-Server oder die großen Modelle aus; das Audio wurde schneller als in Echtzeit eingespeist.

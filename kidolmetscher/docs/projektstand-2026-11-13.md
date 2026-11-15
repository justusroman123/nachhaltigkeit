# KI-Dolmetscher (KI-SCHUB): Projektstand und Protokoll (Stand 13.11.2026)

Dieses Dokument fasst alles zusammen, was bis jetzt besprochen, gebaut, getestet und entschieden wurde. Es enthält **keine Geheimnisse** (kein Token, kein Bedienschlüssel, keine Passwörter, keinen privaten SSH-Schlüssel).

## 0. So machen Sie in einem neuen Chat weiter

Den folgenden Text zu Beginn eines neuen Chats einfügen:

> Es geht um das Projekt „KI-Dolmetscher“ (KI-SCHUB). Lies bitte im Repository `justusroman123/nachhaltigkeit` (Zweig `ccr-4bf88cb4-flgtez`) die Dateien `kidolmetscher/CLAUDE.md` und `kidolmetscher/docs/projektstand-2026-11-13.md`. Mach dann beim Abschnitt „Nächste Schritte“ weiter. Regeln: Antworten auf Deutsch, kurz und sachlich, Kernaussagen fett, nichts raten (stattdessen „unbekannt“ schreiben und eine Messung vorschlagen), vor Kosten, Konten oder Systemänderungen fragen. Dokumente in Google Drive (Ordner „KI Dolmetscher“) nie überschreiben oder löschen.

## 0a. Wiederaufnahme nach einer Pause: ein Knopf, zwei Werte

Der Rechner, von dem aus Sie starten, ist egal: Alles Schwere läuft auf der neu angelegten VM.

1. **Neuen Chat öffnen**, den Einstiegstext aus Abschnitt 0 einfügen, „VM neu anlegen“ schreiben. Claude führt durch die Schritte.
2. **Die zwei Werte besorgen** (kostenlos): ein **Hugging-Face-Token** (huggingface.co/settings/tokens, Typ „Read“) und ein **Bedienschlüssel** (selbst ausgedacht, nur Buchstaben und Ziffern, mindestens 24 Zeichen).
3. **Mini-Starter vorbereiten:** Datei `scripts/cloud-init-launcher.sh` (aus dem Repository) in einer **lokalen Kopie** öffnen, die beiden Platzhalter ersetzen (Token, Schlüssel). Die Werte nie ins Repository oder in den Chat.
4. **VM anlegen:** Prompt A2 (Dokument „Server-Test Ablauf mit centron-Antwort“) ans Browser-Plugin; in „Erweiterte Optionen“ den ganzen Text der lokalen Kopie bei „Cloud-Init Initialisierungsskripte“ einfügen; **„VM erstellen“ klicken Sie selbst** (ab dann laufen die Kosten, ca. 1,26 € pro Stunde).
5. **Warten.** Das Hauptskript (`cloud-init-gpu.sh`, wird beim Start aus dem Repository geholt, also dort korrigierbar) installiert Treiber, Pakete und alle Modelle, richtet den Dienst ein, startet neu. **Gemessene Teilzeiten:** Einrichtung 2 min 10 s, TranslateGemma (24,4 GB) 1 min 53 s. **Nicht gemessen:** VM anlegen (laut centron ca. 2 min), Treiber mit Neustart. Gesamt grob **10 bis 15 Minuten**.
6. **Benutzen:** Am Chromebook `https://<Adresse>/` (Ersatzadresse `<IP mit Bindestrichen>.sslip.io`), Bedienschlüssel eingeben. (Beim Test am Windows-PC stattdessen SSH-Tunnel.)
7. **Ende:** Prompt C (VM zerstören, Kosten prüfen), **Hugging-Face-Token löschen**.

**Ehrlich zum Stand:** Der Mini-Starter, das Cloud-Init-Hauptskript, die HTTPS-Adresse und die `.bat`-Dateien sind **noch nie auf einer frisch angelegten VM durchgelaufen**. Die einzelnen Teile (Treiber, `server_setup.sh`, Modelle) haben auf der jetzigen VM von Hand funktioniert. Beim ersten Durchlauf ist mit Nacharbeit zu rechnen; `/var/log/kidolmetscher-init.log` zeigt, wo es hängt. Ein vollautomatisches Anlegen und Löschen wäre nur über die centron-API möglich (unbekannt).

## 0b. Vor dem Zerstören der VM (Checkliste, die VM löscht alles darauf)

1. Letzte Zeilen von `~/setup.log` (Gesamtzeit `real`, GPU-Prüfung) und `tail -n 30 ~/kidolmetscher/server.log` kopieren und im Chat festhalten oder in dieses Protokoll übernehmen.
2. Falls ein Qualitätslauf gemacht wurde: den Ordner `~/kidolmetscher/qualitaetslauf` mit `scp -r` auf den Windows-PC holen (`windows/hole-bewertungsbogen.bat`) und bewerten lassen.
3. Messwerte aus dem Server-Log (`asr_ms`, `mt_ms`, `tts_ms`, `gesamt_ms`) notieren.
4. **VM zerstören** (VM-Seite, „Zerstören“, Server-ID bestätigen), danach im Billing prüfen, dass keine VM mehr läuft (GPUs 0 / 8).
5. **Hugging-Face-Token widerrufen** (Einstellungen, Tokens).
6. Ergebnisse dieses Durchlaufs in einem neuen Chat nennen, damit Skripte und Protokoll angepasst werden.

Wichtig zum Stand der Server-Miete: Die gemietete GPU-VM bei centron läuft möglicherweise noch und kostet etwa 1,26 € pro Stunde, bis sie in der Console **zerstört** wird (siehe Abschnitt 9).

## 1. Ziel und Rahmen

- Ein deutscher Sprecher wird live in bis zu vier Zielsprachen übersetzt: Ukrainisch (uk), Arabisch (ar), Englisch (en), Türkisch (tr); Persisch (fa) optional.
- Ausgabe im Browser der Zuhörer (Tablets): Untertitel und Ton über Kopfhörer, je Gerät eine Sprache. 3 bis 5 Sekunden Verzögerung sind akzeptabel.
- Bedienplatz: Google Chromebook (nur Browser sicher verfügbar), Mikrofon DJI Mic Mini. Getestet wird derzeit an einem Windows-PC mit Sennheiser-Mikrofon.
- Verwendung: Vorführungen bei Unternehmen und Behörden. Der Server wird nur zu Terminen gemietet. Prototyp, kein Produkt.
- **Wichtigstes Ziel: gute Qualität** (Übersetzung und Stimme), dazu Datenschutz: kein Speichern von Audio und Text, nichts über US-Dienste im Datenpfad der Übersetzung.
- Server: GPU-VM bei centron (Deutschland, Hallstadt/Bamberg), RTX 6000 Ada 48 GB.
- Pipeline: Spracherkennung (Whisper large-v3) → Übersetzung (TranslateGemma 12B) → Sprachausgabe (Piper).

## 2. Verbindliche Arbeitsregeln

1. **Datenschutz:** kein Speichern von Audio und Text, keine Inhalte in Protokollen (nur Zeiten und Zähler), keine Cookies oder Tracking, keine externen Skripte, Schriften oder CDNs, strenge Header (CSP), Zuhörer-Links mit Zufalls-Token und Ablauf, Puffer bei Sitzungsende löschen.
2. **Keine Geheimnisse** im Code oder Repository. Tokens und Schlüssel nur aus Umgebungsvariablen. `.env.example` ja, `.env` nie.
3. Jede Pipeline-Stufe (ASR, MT, TTS) hinter einer Schnittstelle (Protocol), mit Attrappe (Mock) und echter Umsetzung, Konfiguration per Umgebung.
4. Jede Nachricht trägt die Zeitstempel `t_audio_in`, `t_asr`, `t_mt`, `t_tts`, `t_out` (ms).
5. **Vor Installation, Kosten, Konten und Systemeinstellungen fragen.** Keine Zahlen raten: „unbekannt“ schreiben und eine Messung vorsehen.
6. Kommentare kurz und sachlich, README auf Deutsch.
7. **Google Drive:** Ordner „KI Dolmetscher“ (ID `1EhUmj8XWyS4iUmtFThDuBZ-vQu4s0xec`) mit Unterordnern „01 Projektstand“, „02 Messprotokolle“, „03 Entscheidungen und Lizenzen“, „04 Testberichte“. Dokumente als „<Thema> (Stand TT.MM.JJJJ)“ ablegen, nie überschreiben oder löschen, nie Code, Tokens, `.env` oder echte Testinhalte. Nach dem Speichern prüfen und den Link nennen. Ohne Drive-Zugriff: Ablage in `docs/drive-export/`.
8. Git: nur auf dem Zweig `ccr-4bf88cb4-flgtez` entwickeln, kein Pull Request ohne Auftrag. Alles committen und pushen.
9. **Nutzerwünsche:** Deutsch, kurz, sachlich, Kernaussagen fett, nicht raten, **Preise mit zwei Nachkommastellen** schreiben (es gab ein Missverständnis bei „1,1919 €“).

## 3. Wo was liegt

- **Repository:** `github.com/justusroman123/nachhaltigkeit`, Zweig `ccr-4bf88cb4-flgtez`, Projektordner `kidolmetscher/` (das Repository ist öffentlich; dort dürfen nie Geheimnisse liegen).
- `server/app/`: FastAPI-Server (`main.py`, `config.py`, `rooms.py`, `orchestrator.py`, `messages.py`, `security.py`), `pipeline/` mit `*_mock.py` und `*_real.py`.
- `web/`: Bedienplatz (`operator.html`), Zuhörer (`listener.html`), `mic-test.html`, `datenschutz.html` (Entwurf).
- `scripts/`: Messskripte (`bench_*.py`, `smoke_test.py`), `quality_run.py` (Bewertungsbogen), `fetch_voices.py`, `fetch_models.py`, `gpu_check.py`, `server_setup.sh`, `server_ctl.sh`, `cloud-init-gpu.sh`, `tts_candidate_try.py`.
- `windows/`: `start-tunnel.bat`, `hole-bewertungsbogen.bat` (ungetestet).
- `docker/`: Compose mit Profilen `mock` und `gpu`, Caddy, `Dockerfile.gpu` (nicht gebaut).
- `docs/`: Architektur, Entscheidungen, Messprotokoll, Betrieb, Lizenzen-Recherche, Kosten, Datenschutz-Nachweis, Server-Test-Ablauf, centron-Console-Befund, TranslateGemma-Modellkarte, TTS-Kandidaten, dieses Protokoll.
- **Tests:** `cd kidolmetscher/server && pytest` (187 bestanden, 3 übersprungen, weil sie echte Modelle brauchen).
- **Google Drive** (Ordner „KI Dolmetscher“): u. a. die Dokumente „Kosten und Sparhebel“, „Server-Test einer Stunde bei centron – Anleitung“, „centron-Console Befund“, „Sprachausgabe Piper – Einrichtung und CPU-Messung“, „Spracherkennung und Übersetzung – Einrichtung und erster Gesamtlauf“, „Server-Test Ablauf …“ (mehrere Fassungen, die neueste mit „centron-Antwort“), „Datenschutz-Nachweis“, „Sprachausgabe Arabisch und Türkisch – Kandidaten“, „TranslateGemma 12B – Angaben aus der Modellkarte“ (alle Stand 12.11.2026) sowie frühere Etappen-Dokumente. Das Plan-Dokument heißt „Plan Prototyp KI-Dolmetscher: Aufgaben, Prüfungen und Prompts (Stand 09.11.2026)“.

## 4. Stand der Umsetzung

| Baustein | Stand | Wie geprüft |
| --- | --- | --- |
| Server (FastAPI, WebSockets, Räume, Zuhörer-Links mit Token und Ablauf, QR, Sprachwahl, Rückstau-Schutz, Satz-Segmentierer) | fertig, mit Attrappen | 187 automatische Tests, Browser-Tests (Playwright) |
| Bedienplatz und Zuhörer-Seiten (einfache Bedienung, 6 Sprachen der Oberfläche, nicht von Muttersprachlern geprüft) | fertig | Browser-Tests |
| Datenschutz-Prüfungen (keine Speicherung, keine Inhalte in Protokollen, keine Fremdressourcen, keine ausgehenden Verbindungen im Anwendungscode) | durch Tests belegt, nur für den Anwendungscode | siehe `docs/datenschutz-nachweis.md` |
| **Sprachausgabe (Piper)** `tts_real.py`, Stimmen je Sprache über `TTS_VOICES` | umgesetzt | mit Attrappen-Modul und echten Stimmen (uk, en) auf der CPU |
| **Spracherkennung** `asr_real.py` (faster-whisper, pausenbasiert, nicht SimulStreaming) | umgesetzt | mit Whisper tiny auf der CPU (Deutsch erkannt); großes Modell und GPU ungeprüft |
| **Übersetzung** `mt_real.py` (Transformers, Format laut Modellkarte `structured`, `AutoProcessor`/`AutoModelForImageTextToText`, `device_map`) | umgesetzt | mit Qwen2.5-0.5B im Textmodus auf der CPU; `structured` nur mit Attrappen; TranslateGemma ungeprüft |
| Gesamtlauf Deutsch zu Englisch mit Ton (alle drei echten Stufen, kleine Ersatzmodelle, CPU) | lief | Beispiel: „Guten Tag und herzlich willkommen zur Veranstaltung“ wurde zu „Good morning and welcome to the event“ |
| Qualitätslauf `quality_run.py` (12 erfundene Sätze, alle Sprachen, Bewertungsbogen als HTML) | umgesetzt | mit Mock und Kleinmodellen |
| Einrichtungsskripte für die VM (`server_setup.sh`, `server_ctl.sh`, `gpu_check.py`) | umgesetzt, **auf echter VM erst teilweise erprobt** (Fehler beim Ausführen als root behoben) | GPU-Prüfung lief, siehe Abschnitt 9 |
| `cloud-init-gpu.sh` (alles automatisch beim Anlegen, Caddy/HTTPS, Dienst, Qualitätslauf) | geschrieben | **nicht getestet** |
| HTTPS für Chromebook und Tablets (Caddy, eigene Adresse) | im Cloud-Init-Skript vorbereitet | **nicht getestet** |
| Windows-Startdateien für den SSH-Tunnel | geschrieben | **nicht getestet** |

Gemessene CPU-Werte (Entwicklungsumgebung, **keine Servermessung**): Piper je Satz 71 bis 168 ms (uk, en); Laden der Stimmen 3,6 s. Gesamtlauf mit Ersatzmodellen: ASR 530 bis 1065 ms, Übersetzung 1262 bis 1424 ms, Sprachausgabe 86 bis 134 ms (das Audio wurde schneller als in Echtzeit eingespeist, daher nicht aussagekräftig).

## 5. Entscheidungen und Annahmen

- **E9 Spracherkennung:** Zwischenlösung faster-whisper mit Pausenerkennung (Verzögerung = Abschnittslänge plus Erkennungszeit). SimulStreaming (MIT, Autoren bitten kommerzielle Nutzer um einen Fragebogen) oder WhisperLiveKit (Apache-2.0) bleiben offen und müssen auf der GPU verglichen werden. Whisper selbst steht unter Apache-2.0 (frühere Annahme „MIT“ war falsch).
- **E10 Sprachausgabe:** Piper (Paket GPL-3.0, Stimmen mit eigener Lizenz). Rechtliche Folgen für Ihren Einsatz offen.
- **Piper-Stimmen:** Ukrainisch `ukrainian_tts` (CC0, 3 Sprecher, braucht Kleinbuchstaben, daher macht die Anwendung den Text klein) und `high`-Stimmen (Datenlage der Trainingsbasis nicht gelesen); Englisch `en_GB-alba` (CC BY 4.0, Namensnennung nötig). **Türkisch:** nur `tr_TR-dfki` (nicht kommerziell). **Arabisch:** nur `ar_JO-kareem` (Lizenz ungeklärt). **Persisch:** 5 Stimmen, Lizenzen nicht gelesen. Für Arabisch und Türkisch gibt es keine geklärte freie Piper-Stimme, bis dahin nur Untertitel.
- **Kandidaten für Ton in Arabisch und Türkisch** (aus Modellkarten, nicht gehört): VoxCPM2 (Apache-2.0, ca. 8 GB VRAM, RTF ca. 0,30 auf RTX 4090 laut Karte), MOSS-TTS (Apache-2.0, auch Persisch), Chatterbox Multilingual (MIT). Ausgeschlossen: XTTS-v2 und OmniVoice (nicht kommerziell). Ukrainisch steht bei keinem. Anbindung erst nach Hörvergleich (Skript `tts_candidate_try.py`, ungetestet).
- **Übersetzung:** TranslateGemma 12B (Lizenz „gemma“; als gehosteter Dienst gilt es als „Distribution“, die Nutzungseinschränkungen sind in Ihre Nutzungsbedingungen aufzunehmen). Freigabe auf Hugging Face ist **erteilt**. Auch 4B existiert (nicht geprüft, Qualität unbekannt).
- **Modellkarte TranslateGemma (laut Browser-Plugin):** „55 Sprachen“ ohne Liste; Technical Report nennt `uk_UA`, `ar_EG`/`ar_SA`, `tr_TR`, `fa_IR`, `de_DE`; Codes ISO 639-1 oder mit Land; Nachrichtenformat mit `source_lang_code`/`target_lang_code`; Gewichte ca. 24,4 GB (BF16); Kontext 2K Tokens; **Qualität je Sprache nicht angegeben**.
- **Cloud-Anbieter:** centron (Plan). Alternative STACKIT (L40S 1,74 € pro Stunde laut Plan) nicht geprüft.

## 6. Datenschutz (Stand, rechtliche Prüfung steht aus)

- Belegt (für den Anwendungscode): keine Speicherung, keine Inhalte in Protokollen, keine Cookies, keine Fremdressourcen, keine ausgehenden Verbindungen. Details: `docs/datenschutz-nachweis.md`.
- Aussage gegenüber Kunden nur so: „Verarbeitung auf einem Server in Deutschland, im Datenpfad kein Drittanbieter-Dienst vorgesehen.“ **Nicht** sagen: „super sicher“, „DSGVO-zertifiziert“, „läuft nicht über amerikanische Server“ ohne Zusatz.
- Offen (bewusst zurückgestellt): Auftragsverarbeitungsvertrag mit centron (in der Console nicht gefunden; Abschluss über die Datenschutz-Adresse von centron), Unterauftragnehmer, rechtliche Prüfung, KI-Hinweis (Art. 50 KI-VO, Frist laut Plan 02.12.2026), Gemma-Pflichten, Sperren ausgehender Verbindungen auf dem Server, Geräteleitfaden für Chromebook und Tablets. Das Plugin und Modell-Downloads laufen über Hugging Face (Sitz nicht geprüft), keine Gesprächsdaten.
- Für Tests nur **erfundene** Texte sprechen.
- Das öffentliche HTTPS für Chromebook/Tablets macht den Bedienplatz im Internet erreichbar: Schutz nur durch den Bedienschlüssel (kein Schutz gegen automatisches Raten), deshalb langer Schlüssel und VM nur für die Dauer des Termins.

## 7. centron: Fakten

- Konto angelegt (Mitglied seit 12.11.2026). Zahlung/Abrechnung am Monatsersten (Rechnungsdatum 1.12.2026). **2FA wird ab 14.12.2026 Pflicht** (derzeit deaktiviert).
- **Startguthaben 200,00 €** (Support bestätigt, 60 Tage). Im Billing steht „Vorauss. Verbrauch 0,00 €“, das spricht dafür, dass es für die VM gilt (nicht ausdrücklich bestätigt; netto oder brutto unbekannt).
- **Kein Kostenlimit, keine Vorauszahlung, keine Warnschwelle** (Support bestätigt). Gestoppte oder ausgeschaltete VMs werden **weiter berechnet**. **Nur Zerstören beendet die Kosten.** Abrechnung stundengenau, angefangene Stunde voll.
- **Preise (netto laut Doku, zuzüglich 19 % Umsatzsteuer):** RTX 6000 Ada 1,19 € pro Stunde (Console 1,1919), Konfiguration 4 vCPU / 16 GB RAM / 300 GB: **1,2641 € pro Stunde** (910,15 € pro Monat bei Dauerbetrieb). vCPU 1,64 €, RAM 1,90 € pro GB, Speicher 0,05 € pro GB und Monat (RAM-Preis in der Doku 0,97 €: Widerspruch, im Checkout gilt die Anzeige). Weitere GPUs: RTX A4000 16 GB 149,00 € pro Monat (ca. 0,21 € pro Stunde), Quadro RTX 6000 24 GB, A100 40/80 GB (in der Console „belegt“).
- **Team-Limits** (auf Bitte erhöht): 20 Kerne, 80 GB RAM, 2000 GB Speicher, 8 GPUs. Pro Test nur **eine** Instanz anlegen.
- Region in der Console „Bamberg · Datacenter 1 · BBG1“ (laut Doku Hallstadt). SSH-Schlüssel `kidolmetscher-test` im Konto hinterlegt (Team Einstellungen, Tab Sicherheit). VM-Login funktioniert als `root` mit diesem Schlüssel.
- Beim Anlegen gibt es unter „Erweiterte Optionen“ ein Feld „Cloud-Init Initialisierungsskripte“ (kostenlos). Menüpunkte „Images“, „Network“ (Reservierte IPs) und „S3 Storage“ existieren; ob Abbilder oder feste IPs für GPU-VMs möglich sind und was sie kosten: **unbekannt**.

## 8. Kosten

- Bisher: Gesamtverbrauch 21,36 € (Stand 13.11. gegen 14 Uhr), rund 30 € pro Tag, wenn die VM läuft.
- **Ein Test von 2 bis 3 Stunden** kostet etwa 2,53 bis 3,79 € netto. Ein vergessener Tag etwa 30 €. Dauerbetrieb 910,15 € pro Monat: **nicht vorgesehen**.
- Hebel: kleineres Modell (4B) auf der A4000 (ca. 0,21 € pro Stunde statt 1,26 €), Cloud-Init zur Einrichtung (**Abbild/Snapshot entfällt: bei GPU-VMs nicht möglich**, Stand 14.11., siehe `centron-console-befund.md`), automatisches Löschen über die centron-API (**kein eingeschränkter Schlüssel gefunden**, nur voller Member-Zugriff; daher von Hand zerstören, beim Bestätigen den VM-Namen `kidolmetscher-test` eingeben), Termine mit Vorlauf (VM ca. 1 Stunde vorher anlegen), Kalender-Erinnerung zum Zerstören.

## 9. Aktueller Betriebsstand (13.11.2026)

- VM `xv20213` bei centron: RTX 6000 Ada (48 GB), Ubuntu 26.04 LTS, angelegt am 12.11. um 20:54. **Läuft und kostet**, solange sie nicht zerstört wird. Zerstören: VM-Seite, „Zerstören“, Server-ID bestätigen (das klickt der Nutzer selbst).
- **GPU-Treiber installiert und geprüft:** `nvidia-smi` zeigt RTX 6000 Ada, 49.140 MiB, Treiber 595.99.02, CUDA 13.2. (Der Treiber 595-open wurde per `apt` installiert, danach Neustart.)
- Code liegt auf der VM unter `~/kidolmetscher/src` (geklont vom GitHub-Zweig). Der erste Einrichtungslauf brach ab wegen eines Fehlers im Skript beim Ausführen als root (`DEBIAN_FRONTEND=…` als Programm gelesen). **Der Fehler ist behoben und gepusht.** Danach war zu tun: `git pull` auf der VM, `server_setup.sh` im Hintergrund starten, mitlesen (`~/setup.log`), TranslateGemma mit Hugging-Face-Token nachladen.
- **Messung (13.11.2026): `server_setup.sh` lief fehlerfrei in 2 min 10 s** (real), ohne TranslateGemma: Python-Pakete (u. a. PyTorch 2.15.0+cu132, CTranslate2 4.9.0), Whisper large-v3 (7 Dateien in ca. 15 s von Hugging Face), 2 Piper-Stimmen. GPU-Prüfung: „GPU nutzbar“ (PyTorch CUDA True, CTranslate2 1 Gerät, float16 möglich, Whisper-Modell auf der GPU geladen). Der Download war schnell; TranslateGemma wurde danach separat geladen (siehe unten).
- **TranslateGemma 12B (24,4 GB) geladen in 1 min 43 s** (Lauf gesamt 1 min 53 s). Damit ist die frühere Schätzung „15 bis 60 Minuten“ für das ganze Neuanlegen vermutlich zu hoch: VM anlegen (laut centron ca. 2 min), Treiber mit Neustart (einige Minuten), Einrichtung 2 min 10 s, TranslateGemma (Schätzung 2 bis 3 min). Zusammen vermutlich etwa 10 bis 15 Minuten, **im Ganzen ungemessen**.
- Zugang vom Windows-PC: `ssh root@<IP aus der Console>` (die IP ändert sich bei jeder neuen VM). Das **Chromebook hat keinen SSH-Schlüssel** und kann den Tunnel nicht nutzen; dafür ist die HTTPS-Adresse vorgesehen (ungetestet).

### Ergebnis des ersten Tests mit den echten Modellen (13.11.2026, ca. 15:45 Uhr)

- **Server startete mit allen drei echten Stufen** (Log: „Application startup complete“; TranslateGemma-Gewichte in 13 s geladen; Whisper und Piper ohne Fehlermeldung). Tunnel zum Windows-PC und Bedienplatz im Browser funktionierten; Anmeldung mit dem Bedienschlüssel klappte nach einem Kopierfehler (nur den Teil nach `OPERATOR_KEY=` verwenden).
- Sitzung mit Englisch, ein Zuhörer im zweiten Browserfenster verbunden („English: 1“), Bedienplatz meldete „Sendet. Bitte sprechen“, Mikrofon Sennheiser Profile, Netz zum Server 35 ms.
- **Problem: Es kam keine Übersetzung an** (kein Ton, keine Untertitel). Die Anzeige „Verzögerung“ und „Stufen“ blieb „unbekannt“, das heißt, es wurde kein Segment ausgeliefert. Die Ursache ist **unbekannt**; der Server-Log wurde noch nicht ausgewertet.
- **Wahrscheinliche Ursachen (ungeprüft), in dieser Reihenfolge prüfen:**
  1. **Pegel zu leise für die Erkennungsschwelle** (`ASR_VAD_RMS=400`, 16-Bit-Skala). Prüfen mit der neuen Logzeile `asr_pegel rms_max=… schwelle=… laut_prozent=…`: liegt `rms_max` unter der Schwelle, `ASR_VAD_RMS` senken (z. B. 150) oder Mikrofon lauter.
  2. **Fehler in der Übersetzung** (z. B. Sprachcode oder Format von TranslateGemma): zeigt sich als Zeile `pipeline_fehler lang=en typ=…` (mit `DEBUG_FEHLER=1` samt gekürzter Meldung). Abhilfe: `MT_LANG_CODES` setzen (z. B. `en=en-US`) oder `MT_PROMPT_MODE=plain` probieren.
  3. **Fehler in der Spracherkennung** (zeigt sich ebenfalls als `pipeline_fehler`).
  4. **Ton im Zuhörer-Fenster** erst nach Klick freigegeben (Browser-Regel); Untertitel erscheinen auch ohne Ton.
- **Neu eingebaut (Stand 13.11. abends, auf GitHub):** Diagnose-Logzeilen: `asr_pegel` (alle ca. 5 s: höchster Pegel, Schwelle, Anteil lauter Blöcke), `asr_abschnitt` (Länge des erkannten Sprachabschnitts, ob Text erkannt wurde; ohne Inhalt) und bei `DEBUG_FEHLER=1` die gekürzte Fehlermeldung bei `pipeline_fehler`. `server_setup.sh` setzt `DEBUG_FEHLER=1` für die Testphase (im Betrieb auf 0, weil Meldungen Textteile enthalten können).
- **URSACHE GEFUNDEN (13.11.2026, 21:32 Uhr, Log der VM mit `DEBUG_FEHLER=1`):** `pipeline_fehler typ=RuntimeError: Library libcublas.so.12 is not found or cannot be loaded`. Die **Spracherkennung (Whisper über CTranslate2) fand die CUDA-12-Bibliothek nicht**; PyTorch bringt nur CUDA 13 mit. Das Modell lud (GPU-Check war „grün“), der Fehler tritt erst beim ersten Rechenlauf auf. **Mikrofonpegel war in Ordnung** (`asr_pegel rms_max` ca. 1300 bis 1500 bei Schwelle 400), Hypothese 1 ist damit widerlegt; Hypothese 2 (Übersetzung) bleibt ungeprüft, weil die Kette vorher abbrach.
- **Fix (im Repository, ungetestet auf der GPU):** `requirements-asr.txt` enthält jetzt `nvidia-cublas-cu12` und `nvidia-cudnn-cu12`; `scripts/cuda12_libpfad.py` liefert den Suchpfad, `server_setup.sh` schreibt `LD_LIBRARY_PATH=...` in `server.env` (gilt für `server_ctl.sh` und den systemd-Dienst); `gpu_check.py` macht jetzt einen echten Rechenlauf (1 s Stille), damit der Fehler schon beim Setup auffällt. **Ob damit die Übersetzung durchläuft: unbekannt, nächster Test.**
- **ERGEBNIS NACH DEM FIX (13.11.2026, ca. 21:50 Uhr): Die Übersetzung kam an** (Untertitel/Ton im Zuhörer-Fenster, über den SSH-Tunnel). **Verzögerung laut Nutzer „vielleicht 1 Sekunde, sehr gut“: Schätzung beim Zuschauen, nicht gemessen** (Messpunkt: `t_audio_in` bis `t_out` aus den Nachrichten bzw. Anzeige „Verzögerung“). Eine Bildschirmaufnahme liegt beim Nutzer; Übersetzungsqualität, Sprachen außer Englisch (und uk), Ton-Qualität: **noch nicht bewertet**. Hypothese 2 (Übersetzungsfehler) ist damit für Englisch praktisch widerlegt.
- **Neu (ungetestet):** `scripts/oeffentlich_freigeben.sh` richtet auf der laufenden VM eine HTTPS-Adresse ein (Caddy, `<IP-mit-Bindestrichen>.sslip.io`, setzt `PUBLIC_URL`), damit Tablets/Smartphones/Chromebook den Zuhörer-Link nutzen können; `... aus` nimmt es zurück. Ob centron die Ports 80/443 freigibt: unbekannt.
- **So wird nächstes Mal diagnostiziert:** Nach dem Sprechen im Server-Fenster `grep -E "asr_pegel|asr_abschnitt|pipeline_fehler" ~/kidolmetscher/server.log | tail -n 30` und das Ergebnis (ohne Schlüssel) im Chat nennen.

## 10. Erkenntnisse und Stolpersteine

- Beim Einfügen von Befehlen verklebten zwei Zeilen; Befehle einzeln und von Hand tippen.
- Auf dem Server nicht erneut `ssh` tippen (fragt nach einem Passwort, das es nicht gibt). `ssh` nur auf dem Windows-PC.
- Das Browser-Plugin kann **keine** Befehle auf dem eigenen Rechner ausführen und keine Passwörter eingeben; es liest und klickt in der Console, **nie** Erstellen, Akzeptieren oder Löschen ohne Bestätigung.
- Die Console meldete einmal ab; neu anmelden.
- GitHub lieferte kurzzeitig 503; Push wiederholen.
- Der erste Plan (VM ein-/ausschalten) funktioniert bei centron nicht für Kosten: nur Zerstören spart. Deshalb Termin-Ablauf mit Neuanlegen und Cloud-Init.
- Vermeiden: Zahlen mit vier Nachkommastellen (führten zum Missverständnis „über 1000 €“).

## 11. Nächste Schritte (Reihenfolge)

0. **Whisper-GPU-Fix prüfen** (Ursache: fehlende CUDA-12-Bibliothek, Abschnitt 9): auf der VM `git pull`, `SKIP_APT=1 SKIP_MODELS=1 bash scripts/server_setup.sh`, Server neu starten, sprechen, Log prüfen (`asr_abschnitt`, `pipeline_fehler lang=…`). Danach erst Übersetzung/Ton bewerten.
1. **Entscheiden:** Wenn heute nicht weitergetestet werden kann, VM **sofort zerstören** (Prompt C), sonst Einrichtung abschließen.
2. Einrichtung auf der VM abschließen: `git pull`, `server_setup.sh` (mit Hugging-Face-Token, unsichtbar eingegeben), Zeit (`real`) notieren, GPU-Prüfung lesen.
3. Server starten (`server_ctl.sh start`), Tunnel vom Windows-PC (`ssh -L 8000:127.0.0.1:8000 root@<IP>`), `http://localhost:8000`, Bedienschlüssel aus `~/kidolmetscher/server.env`.
4. **Qualitätslauf** (`scripts/quality_run.py --modes structured,plain`), Bewertungsbogen herunterladen (`windows/hole-bewertungsbogen.bat` oder `scp`), Muttersprachler bewerten lassen (uk, ar, tr), Stimmen für uk und en anhören (Bewertungsbogen `docs/bewertungsbogen.md`).
5. Verzögerung messen (Zeilen in `~/kidolmetscher/server.log`: `asr_ms`, `mt_ms`, `tts_ms`), Messprotokoll ergänzen (`bench_*.py --write`).
6. **Günstigere Variante prüfen (Wunsch Nutzer, 14.11.):** RTX A4000 16 GB mit TranslateGemma 4B (`MT_REPO=google/translategemma-4b-it`; Name und Freigabe laut Plugin-Bericht vom 14.11. bestätigt, Gewichte 8,64 GB). Rechnung (netto, meine Überschlagsrechnung): A4000 ca. 0,21 € pro Stunde + Aufpreis für vCPU/RAM/Speicher wie bei der Ada-Konfiguration (1,2641 − 1,1919 = ca. 0,07 €) = **ca. 0,28 € pro Stunde statt 1,26 €**. Speicher: Whisper large-v3 gemessen ca. 4,2 GB; 12B-Gewichte 24,4 GB (passen **nicht** in 16 GB); 4B 8,64 GB (laut Hugging Face); zusammen ca. 12,9 GB von 16 GB plus Arbeitsspeicher der GPU: knapp, **Reserve unbekannt**. **Unbekannt:** Qualität 4B gegenüber 12B (Hauptkriterium!), Verzögerung auf der A4000 (auf der Ada ca. 1 s, geschätzt). Vorgehen: einmal auf der Ada `quality_run.py` mit 12B und 4B über dieselben Sätze, Muttersprachler bewerten lassen; danach erst A4000 mit dem Sieger messen (VRAM, Verzögerung).
7. **Danach:** VM zerstören, Kosten im Billing prüfen, **Hugging-Face-Token widerrufen**.
8. Ton für Arabisch und Türkisch: Hörvergleich VoxCPM2/MOSS-TTS/Chatterbox auf der GPU, dann Anbindung.
9. Chromebook/Tablets: HTTPS-Adresse (Domain, Caddy, reservierte IP prüfen), Cloud-Init-Skript testen.
10. Abbild/Objektspeicher und automatisches Löschen prüfen (Plugin-Prompts im Dokument „Server-Test Ablauf …“).
11. Später: Datenschutz und Verträge (Auftragsverarbeitung, rechtliche Prüfung, KI-Hinweis), 2FA vor dem 14.12.2026, Entscheidungen E9 und E10 abschließen, Geräteleitfaden.

## 12. Wichtige Befehle

- Auf dem Server: `bash ~/kidolmetscher/src/kidolmetscher/scripts/server_ctl.sh start|stop|status`; Log `~/kidolmetscher/server.log` (nur Zeiten und Zähler); Konfiguration `~/kidolmetscher/server.env` (enthält den Bedienschlüssel, nicht weitergeben).
- Qualitätslauf: `cd ~/kidolmetscher/src/kidolmetscher && set -a && . ~/kidolmetscher/server.env && set +a && ~/kidolmetscher/.venv/bin/python scripts/quality_run.py --modes structured,plain --out ~/kidolmetscher/qualitaetslauf`.
- Lokal testen (Entwicklung, ohne GPU): `kidolmetscher/start.bat` (Windows) oder `./start.sh`, dann `http://localhost:8000`.
- Tests: `cd kidolmetscher/server && pytest`.

## 13. Was bewusst nicht gespeichert ist

Hugging-Face-Token, Bedienschlüssel, privater SSH-Schlüssel, Passwörter, Zugangsdaten zur centron-Console, personenbezogene Angaben. Der Bedienschlüssel steht nur auf der VM; das Token gehört nur als Umgebungsvariable beim Einrichtungsaufruf auf den Server und wird danach widerrufen.

## 14. Stand 14.11.2026 (Ergänzung)

- **VM `kidolmetscher-test` ist zerstört** (Dashboard: Kerne 0/20, RAM 0/80 GB, GPUs 0/8). Billing-Anzeige am 14.11.: Gesamtverbrauch 31,74 €, Guthaben 200,00 €, voraussichtlicher Verbrauch 0,00 € (nächste Rechnung 1.12.2026). **Ob das Guthaben verrechnet wird und ob 31,74 € netto oder brutto ist: unbekannt**, auf der Rechnung prüfen.
- **Funktionierende Kette (13.11.):** Whisper-GPU-Fix, Übersetzung kommt an, Verzögerung laut Nutzer ca. 1 s (nicht gemessen).
- **Offen:** GPU-Typen/Gesamtpreise (Prompt 1, Punkte 1 bis 3 und 6 noch nicht beantwortet), 12B-gegen-4B-Qualitätsvergleich, A4000-Messung, HTTPS für Tablets (`oeffentlich_freigeben.sh` ungetestet), Cloud-Init-Gesamtlauf, Drive-Upload dieses Protokolls, neues HF-Token (altes löschen!), 2FA vor 14.12.2026.

## 15. Plan Neustart mit günstiger Variante (14.11.2026, vorbereitet, noch nicht ausgeführt)

**Ziel:** VM mit RTX A4000 (16 GB) und TranslateGemma 4B, zunächst **eine Sprache** (Standard `uk`), HTTPS-Adresse für Chromebook (Bedienplatz) und Tablets/Handy (Zuhörer).

**Vorbereitet im Repository (alles ungetestet auf der A4000):**
- `scripts/cloud-init-launcher.sh`: `MT_REPO=google/translategemma-4b-it`, `DEFAULT_LANGS=uk`, optional `SERVER_HOURLY_EUR`; `cloud-init-gpu.sh` trägt beides in `server.env` ein.
- `docs/server-test-ablauf.md`: **Prompt A3** (Preise/GPU-Typen/reservierte IP lesen, A4000 vorbereiten, stoppt vor „Erstellen“).
- `docs/endgeraete-recherche.md`: Geräteüberlegungen (kein Gerät ist „datenschutzkonform“ an sich; Übersetzung läuft auf dem Server).

**Ablauf:** (1) Prompt A3 ans Plugin, Preise ansehen, bestätigen. (2) Starter lokal ausfüllen (Token, Bedienschlüssel, ggf. `DOMAIN`), in „Cloud-Init“ einfügen, VM erstellen. (3) IP notieren; bei eigener Domain den A-Eintrag setzen. (4) Warten (Dauer unbekannt, bisher gemessen: Setup 2 min, Modelle 2 min, Treiber+Neustart nicht gemessen). (5) Chromebook: `https://<adresse>/`, Bedienschlüssel, Mikrofon erlauben, Sitzung mit `uk` starten; Tablet: QR-Code/Link. (6) Messen: `t_mt`/`t_tts`, VRAM (`nvidia-smi`), Bewertungsbogen des Qualitätslaufs. (7) VM **zerstören** (Name `kidolmetscher-test` eingeben), Billing prüfen.

**Risiken/Unbekannt:**
- **Zertifikat für `<ip>.sslip.io`:** Let's Encrypt begrenzt Zertifikate je registrierter Domain (gemeinsam für alle sslip.io-Adressen); bekannte Probleme (Caddy-/OpenVidu-Forum, Websuche 14.11.). **Eigene Subdomain (z. B. unter kischub.de, DNS-Zugang unbekannt) ist sicherer.** Ob Port 80/443 bei centron offen ist: unbekannt.
- **A4000-Preis uneinheitlich:** centron-Seiten nennen 0,2069 €/h (149,00 €/Monat, deckt sich mit der Console-Anzeige), 0,13 €/h (92,59 €/Monat) und 0,067 €/h (alte Preisliste). Gültig ist die Anzeige im Checkout (Prompt A3).
- **Speicher 16 GB:** 4B 8,64 GB + Whisper ca. 4,2 GB; Reserve unbekannt. Läuft der Qualitätslauf (`QUALITAETSLAUF=1`) vor dem Dienst, wird der Speicher getrennt genutzt.
- **Qualität 4B:** unbekannt; der Qualitätslauf liefert nur den Bewertungsbogen (Sätze, Übersetzungen, Ton wo Stimme vorhanden), Muttersprachler entscheidet. Ein Vergleich mit 12B ist auf der A4000 nicht möglich (24,41 GB).
- **Altes Hugging-Face-Token:** Nutzer will es weiterverwenden. Es stand mehrfach im Chat; **Risiko: Dritte mit Zugriff auf diese Chats könnten es nutzen. Empfehlung: neues Lesetoken (1 Minute).** Entscheidung beim Nutzer.

### Ergebnis Prompt A3 (Bericht des Plugins vom 14.11.2026, nur gelesen/vorbereitet, nichts bestellt; von mir nicht selbst geprüft)

- **GPUs (nur GPU-Anteil, netto laut Doku, Console nennt es nicht):** RTX A4000 16 GB 0,2069 €/h (149,00 €/Monat), **verfügbar**; RTX 6000 Ada 48 GB 1,1919 €/h (858,19 €/Monat), verfügbar; Quadro RTX 6000 24 GB 0,2764 €/h, A100 40 GB 0,9583 €/h, A100 80 GB 1,7917 €/h: **belegt**. L4/L40S/A10/RTX 4000 Ada: nicht gefunden. Glattbrugg GLB1 voll belegt, Bamberg BBG1 wählbar.
- **Checkout-Preis A4000 mit 4 vCPU / 16 GB / 100 GB: 0,2652 €/h netto (190,96 €/Monat)**, brutto bei 19 % ca. 0,3156 €/h (Rechnung des Plugins, Console zeigt keinen Brutto-Betrag). Zum Vergleich Ada-Konfiguration 1,2641 €/h. Abrechnung stündlich, Mindestgebühr 1 Stunde, gestoppte VMs werden berechnet.
- **Firewall im Wizard nicht einstellbar** (kostenpflichtige „Cloud Firewall“ 7,58 €/Monat gefunden, nicht gebucht). **Ob Port 80/443 standardmäßig offen sind: unbekannt**, zeigt der Test.
- **Reservierte IPs:** Liste leer, kein Anlegen-Button, keine Preisangabe, Neuzuweisung nach Zerstören nicht gefunden (Doku „in Arbeit“). Folge: **A-Eintrag pro neuer VM von Hand ändern.**
- **Image:** Ubuntu „LTS 26“ gewählt (die erste VM lief mit Ubuntu 26.04.1 LTS laut Login-Meldung). SSH-Key `kidolmetscher-test` gewählt, Cloud-Init leer (füllt der Nutzer), Name `kidolmetscher-test`.

### Ergebnis Prompt DNS 1 (Bericht des Plugins vom 14.11.2026, nur gelesen; ohne IP-Adressen und Kennungen der anderen Webseite, weil das Repository öffentlich ist)

- **DNS-Anbieter ALL-INKL.COM (KAS)**, Pfad: Tools → DNS-Einstellungen → kischub.de → „Neuen DNS-Eintrag erstellen“ (Felder: Name, Typ, Ziel; Button „Jetzt anlegen“). Die Zone hat 8 Einträge (A für die Hauptdomain, **A mit Wildcard `*`**, MX, TXT für SPF/DMARC/DKIM/Brevo). Es gibt keinen Eintrag und keine KAS-Subdomain für `dolmetscher`.
- **Die Wildcard `*` zeigt auf die andere Webseite.** Ein neuer A-Eintrag `dolmetscher` überschreibt sie nur für diese eine Subdomain. **Die Einträge A (Hauptdomain) und `*` nicht ändern; die Checkbox „Wildcard soll ebenfalls auf diese IP zeigen“ nicht anhaken.** (Die Subdomain `training` läuft über die Wildcard.)
- **Kein CAA-Eintrag:** Zertifikate von Let's Encrypt sind nach Standard nicht eingeschränkt (Plugin-Angabe, nicht live geprüft). **DNSSEC:** nicht gefunden. **TTL:** **nicht einstellbar** (kein Feld); die Seite nennt „einige Stunden“ für Änderungen.
- **Folge für den Ablauf:** Bis `dolmetscher.kischub.de` auf die neue IP zeigt, löst es über die Wildcard auf die andere Webseite auf. Resolver mit altem Ergebnis können bis zum Ablauf der (unbekannten) TTL die falsche IP liefern; Let's Encrypt kann dann zunächst scheitern, Caddy versucht es automatisch erneut. **Wartezeit bis zur Gültigkeit: unbekannt, messen.** Fallback: `scripts/oeffentlich_freigeben.sh` mit der Ersatzadresse `<ip>.sslip.io` (Zertifikat-Limit-Risiko).
- **Bei jeder neuen VM** den vorhandenen A-Eintrag `dolmetscher` **bearbeiten** (neue IP), nicht neu anlegen.

## 16. Zweiter Versuch am 14.11.2026: Cloud-Init-Weg gescheitert, VM weg (festgehalten am Abend)

- **Ablauf:** VM `kidolmetscher-test` (RTX A4000, 4 vCPU/16 GB/100 GB, Ubuntu LTS 26) um ca. 19:34 per Console erstellt, Starter ins Cloud-Init-Feld gelegt (Nutzerangabe; Inhalt unbestätigt). DNS-Eintrag `dolmetscher` (A) angelegt (9 Einträge in der Zone, die 8 bestehenden unverändert). Browser: `ERR_CONNECTION_REFUSED` (nichts lauschte auf 443).
- **Befund auf der VM (SSH ging um 19:48):** keine Log-Datei von `cloud-init-gpu.sh`, kein `caddy`, kein Dienst. `cloud-init status`: done, keine Fehler. `user-data.txt` (1609 Bytes) beginnt mit `#cloud-config` und enthält centrons eigene Einrichtung (apt, users, fqdn, ssh, `runcmd` mit Hosts, sysctl, sshd-Änderung, `curl --insecure … ; bash /tmp/.post-install…`). **Der Starter des Nutzers war darin nicht enthalten.** Netz zur VM war in Ordnung (GitHub-Datei HTTP 200). Auf Anweisung wurde `runcmd` von Hand erneut ausgeführt (Fehler von mir: nicht vorher geprüft, dass es centrons Skript ist); Wirkung unbekannt.
- **Danach:** SSH-Zeitüberschreitung auf Port 22. Console (Plugin-Bericht): `xv20237` steht unter **„Fehlgeschlagen: The post deployment process failed“** (Hinweis: Support kontaktieren; fehlgeschlagene VMs nur 24 Stunden sichtbar), keine Detailseite, Dashboard Kerne 0/20, GPUs 0/8. Mitteilungen: `create-server` **failed** 14.11. 19:34, `setup-addon` done 19:35; **kein `delete-server` am 14.11.** Die erste VM (12.11.) war `done`. **Ursache des Fehlschlags: unbekannt** (Hypothesen ungeprüft: Cloud-Init-Feld, centron-Post-Deployment, GPU-Image).
- **Kosten:** Gesamtverbrauch 31,74 € (14.11. vormittags) auf 31,86 € (Abend), Guthaben 200,00 € (Netto/Brutto und Verrechnung unbekannt). Ob der fehlgeschlagene Versuch abgerechnet wird: **nicht gefunden**, im Billing prüfen.
- **centron-Doku (Websuche):** Cloud-Init akzeptiert laut Doku Cloud-Config oder jedes Skript (z. B. Bash), Feld unter „Erweiterte Optionen → Initialisierungsskripte“; verfügbar auf neuesten Ubuntu-/CentOS-Images.
- **Konsequenz:** „Ein Knopf per Cloud-Init“ ist **nicht bestätigt**. Zuverlässiger Rückfall: VM **ohne** Cloud-Init anlegen, per SSH `cat > /root/start.sh` (Starter einfügen, Strg+D), `setsid nohup bash /root/start.sh > /root/start.log 2>&1 &`, danach `rm /root/start.sh`. Offene Fragen an centron-Support: Warum Post-Deployment fehlgeschlagen? Wurde das Cloud-Init-Feld übernommen? Abrechnung des fehlgeschlagenen Versuchs?
- **DNS:** Der A-Eintrag `dolmetscher` zeigt noch auf die nicht mehr vorhandene IP; bei neuer VM den vorhandenen Eintrag **bearbeiten**.

## 17. Lehren vom 14.11.2026 und Auftrag: Ablauf muss anders werden (Wunsch des Nutzers: „nervig und zeitintensiv, lange Recherche, alles ins Protokoll“)

**Was an diesem Abend schiefging (Fakten):**
1. **Cloud-Init-Feld:** Der Starter kam bei der zweiten VM nicht in den Datensätzen an (nur centrons eigenes `#cloud-config`); eine VM wurde als „Post deployment failed“ markiert. Ursache unbekannt.
2. **Von-Hand-Weg mit vielen Einzelschritten:** Mindestens sieben Bedienfehler (Befehle ins `cat` getippt, Variablenname `HF_TOKEN` durch den Token-Wert ersetzt, `OPERATOR_KEY` fehlte, `grep` am Windows-Prompt, Befehle am falschen Prompt, Ausgaben mit Token in den Chat kopiert). **Das Token stand dadurch fünfmal im Chat.** Dreimal lief das Setup mit dem falschen Variablennamen; TranslateGemma wurde nie geladen.
3. **Fehler im Skript (meiner):** `nvidia-smi` ohne Treiber brach `server_setup.sh` ab (`set -e`); `git clone` war nicht wiederholbar. Behoben und gepusht, **auf einer frischen VM bis zum Ende ungetestet**. Hätte ein Test auf einer billigen VM aufgedeckt.
4. **Zeit/Kosten:** VM 1 (Ada) ca. 1,26 €/h über ca. 25 h; VM 2 (A4000) 0,27 €/h; Setup-Dauer des Gesamtlaufs: bisher nicht sauber gemessen.

**Regeln ab jetzt:**
- **Nie wieder „ein Knopf“ behaupten, bevor der Ablauf einmal komplett auf einer Test-VM gelaufen ist.**
- **Keine Geheimnisse in Zwischenablage-Zeilen mit Platzhaltern zum Ersetzen.** Eingabe nur über versteckte Abfrage (siehe unten).
- **Skripte vor dem GPU-Einsatz auf einer billigen Nicht-GPU-VM testen** (centron „Optimiertes Cloud Computing“, laut Console ab 2,86 €/Monat netto; Stundenpreis nicht gemessen): Zustellung des Cloud-Init-Texts, Ports 80/443 von außen, Let's-Encrypt-Zertifikat, DNS-Dauer, Setup ohne GPU-Teile.
- Dem Nutzer nur **einen** Befehl nennen, der danach **eine** Zeile Ergebnis liefert; keine Ausgabe-Kopien des ganzen Terminals.

**Aufgabenliste für die Recherche (nächste Sitzung, nach Rücksetzung des Wochenlimits am So. 15.11. 20:00; die Recherche kostet Limit):**
1. **centron-API:** Gibt es beim Anlegen einer GPU-VM einen Parameter `user_data` (Cloud-Init) und kommt der Text dort an? Authentifizierung/Rechte (Token mit vollen Rechten: Risiko).
2. **Ein-Klick-Skript am Windows-PC** (`windows/`): PowerShell-Skript, fragt IP, HF-Token und Bedienschlüssel **versteckt** ab (`Read-Host -AsSecureString`), schickt das Starterskript per `ssh … "bash -s"` über stdin (kein Einfügen im SSH-Fenster, kein Chat), wartet auf Neustart, prüft die Seite und meldet nur „fertig/Fehler“. Zeilenenden (CRLF) beachten. Ungetestet.
3. **Alternative Anbieter in Deutschland/EU** mit Snapshot/Image-Unterstützung für GPU-VMs, stundengenauer Abrechnung und AVV (Datenschutz, später): z. B. prüfen, ob es das gibt; Auswahl nicht aus dem Gedächtnis, sondern recherchiert.
4. **DNS ohne Handarbeit:** KAS-API von ALL-INKL für den A-Eintrag oder feste IP (centron „Reservierte IPs“ ist ohne Funktion gefunden).
5. **Eigene Hardware vor Ort** (Offline-Box) als Alternative zur Cloud: Kosten und Aufwand unbekannt.

## 18. Erfolg am 15.11.2026: HTTPS-Adresse läuft (Stand der Beobachtung, Messwerte folgen)

- **Nutzerbericht (Screenshot):** `https://dolmetscher.kischub.de/operator.html` lädt (Inkognito-Fenster, Chrome, Windows-PC), Bedienplatz zeigt Schritt 2 „Zuhörer einladen“ mit **QR-Code und Zuhörer-Link auf der eigenen Adresse**, Mikrofon (Sennheiser Profile) wählbar, „Angebotene Sprachen: English“ (Auswahl in Schritt 1 prüfen; Voreinstellung war `DEFAULT_LANGS=uk`).
- **Damit belegt:** Port 443 ist bei centron von außen offen; Caddy konnte ein Zertifikat für die eigene Subdomain holen (Zertifikat-Aussteller nicht geprüft); der A-Eintrag bei ALL-INKL wirkte (Dauer **nicht gemessen**: zwischen Eintrag und erster Erreichbarkeit lagen Stunden, vermutlich wegen des lokalen DNS-Zwischenspeichers); die RTX A4000 mit 4B-Modell startet den Dienst.
- **Noch offen (Messung mit zweitem Gerät):** Untertitel/Ton auf dem Handy, Verzögerung (`t_asr`, `t_mt`, `t_tts` aus der Anzeige), Speicher (`nvidia-smi` bei laufendem Dienst, 16 GB insgesamt), Übersetzungsqualität 4B (Muttersprachler), Dauer des Gesamtlaufs ohne die Fehlversuche.
- **Der Weg dorthin war nicht reproduzierbar „ein Knopf“;** siehe Abschnitt 17. Der Bedienschlüssel dieses Laufs wurde zufällig erzeugt (steht nur in `server.env` der VM).

## 19. Rückmeldung nach dem Handy-Test (15.11.2026) und Änderungen

- **Nutzerbericht:** Übersetzung funktioniert auch auf dem Smartphone („sehr gut“, Verzögerung laut Nutzer ca. 1 s, Schätzung). **Fehler:** Sätze wurden teils mehrfach wiederholt; die Sprech-Anzeige (erste Fassung) sprang zwischen „Stopp“ und „Sprechen“ hin und her.
- **Ursache der Wiederholungen: unbekannt** (Kandidaten: Whisper wiederholt Sätze bei Nachlauf/Rauschen; kleines Modell 4B mit Greedy-Decoding läuft in Schleifen, bis `MT_MAX_NEW_TOKENS`=256). Ob Quelltext oder Übersetzung wiederholt, zeigt die Liste unten im Bedienplatz („#Nr [Sprache] deutscher Text → Übersetzung“).
- **Gegenmaßnahmen (im Repository, auf der GPU ungetestet):** `pipeline/text_clean.py` entfernt direkte Satz- und Wortfolgen-Wiederholungen in Spracherkennung und Übersetzung; gleicher Text innerhalb von 4 s nach dem vorigen Abschnitt wird verworfen (`REPEAT_WINDOW_MS`); die Token-Grenze der Übersetzung richtet sich nach der Satzlänge (`max_neue_tokens`); Logzeilen `asr_abschnitt … bereinigt=… doppelt=…` und `mt_wiederholung_entfernt` (nur Hinweise, keine Inhalte).
- **Sprech-Anzeige neu:** drei feste Zustände „SPRECHEN MÖGLICH“ (grün), „SIE SPRECHEN“ mit Balken (grün/orange, Grenze 12 s Abschnittslänge laut `ASR_MAX_UTTERANCE_S`) und „STOPP, wird übersetzt“ (rot; bleibt 1,5 bis 8 s stehen, bis die Übersetzung eintrifft); kurze Geräusche (< 250 ms) und kurze Pausen (< 0,7 s) lösen keinen Wechsel aus. Rein am Bedienplatz aus dem Pegel berechnet. Logik in Node mit simulierten Blöcken geprüft, im Browser mit echtem Mikrofon **noch nicht**.

## 20. Befund Handy-Screenshot (15.11.2026): erfundene Abspann-Zeilen der Spracherkennung

- **Beobachtung (Nutzer-Screenshots, Listener-Seite):** Untertitel enthalten Fragmente wie „Subtitling.“ und „BR 2018: I'll just speak for a bit and see what happens.“; außerdem erscheinen Sätze doppelt mit leicht anderen Worten („possible“/„achievable“). **„BR 2018“ passt zu bekannten Whisper-Halluzinationen** („Untertitelung des BR 2018“, „Untertitel im Auftrag des ZDF“) bei Stille/Rauschen am Abschnittsende (Einordnung nach Muster, nicht am deutschen Originaltext belegt).
- **Maßnahmen (Repository, auf der GPU ungetestet):** Stille am Ende wird auf 250 ms gekürzt, bevor Whisper den Abschnitt bekommt (`TAIL_KEEP_MS`); Whisper-Segmente mit hoher Nicht-Sprache-Wahrscheinlichkeit/Schleifenmuster werden verworfen (`no_speech_prob`, `compression_ratio`); `text_clean.entferne_floskeln` entfernt Abspann-Floskeln (Untertitel + Sender/Amara/Jahr); normale Sätze mit „Untertitel“ bleiben unverändert (Test).
- **Offen:** ob die doppelten Sätze mit anderen Worten vom Sprecher kamen oder vom Server verarbeitet wurden: Nutzer prüft den deutschen Text in der Live-Liste des Bedienplatzes. Vorschlag des Nutzers: **„Dolmetscher-Modus“, bei dem „Sprechen möglich“ erst erscheint, wenn die Übersetzung auf allen Geräten fertig gesprochen/angezeigt ist** (Rückmeldung der Zuhörer-Seiten; Datenschutz: nur Zähler, keine Inhalte). Entwurf: Zuhörer melden „fertig“ (Ton zu Ende oder Untertitel angezeigt), Server meldet dem Bedienplatz „alle fertig“, Zeitgrenze gegen hängende Geräte. Noch nicht gebaut.


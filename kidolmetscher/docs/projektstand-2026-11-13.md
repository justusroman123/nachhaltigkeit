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
- Hebel: kleineres Modell (4B) auf der A4000 (ca. 0,21 € pro Stunde statt 1,26 €), Abbild oder Objektspeicher für Modelle, Cloud-Init zur Einrichtung, automatisches Löschen über die centron-API (Schlüsselrechte unbekannt), Termine mit Vorlauf (VM ca. 1 Stunde vorher anlegen), Kalender-Erinnerung zum Zerstören.

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
6. 12B mit 4B vergleichen (Qualität und Kosten); bei Erfolg A4000 prüfen.
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

# Projektwissen KI-Dolmetscher (KI-SCHUB), Stand 15.11.2026 (abends)

> **Momentaufnahme vom 15.11.2026 (abends), überholt seit 17.11.2026 durch den Stand im Repository** (`README.md`, `CLAUDE.md`, `docs/projektstand-2026-11-13.md` Abschnitte 27 bis 32 und 11a). Dieses Bündel wird **nicht fortgeschrieben**; bei Abweichungen gilt das Repository. Beispiele überholter Aussagen darin: „kein Schutz gegen automatisches Raten“ (seit 16.11. gibt es eine Sperre), 187 Tests (heute 326), Verlauf „letzte 2 Minuten/10 Nachrichten“, Notgrenze „30 Minuten“ im Gespräch (heute nur 120 s ohne hörbare Sprache), Stimmen-Lizenz der deutschen Stimme „nicht geprüft“ (16.11.: CC0 laut Modellkarte).

Bündel zum Hochladen als **Wissen eines Claude-Projekts**. Quelle: Repository `github.com/justusroman123/nachhaltigkeit`, Zweig `ccr-4bf88cb4-flgtez`, Ordner `kidolmetscher/`. Enthält **keine** Token oder Schlüssel. Bei Abweichungen gilt das Repository. **Wichtig:** Es gibt genau zwei Betriebsarten (Protokoll Abschnitt 27).

---


# ===== Datei: CLAUDE.md =====

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

## Aktueller Stand und Fortsetzung
Ausführliches Protokoll (Stand, Entscheidungen, centron-Fakten, Kosten, nächste Schritte, Stolpersteine): `docs/projektstand-2026-11-13.md`.
Nutzerwünsche: Deutsch, kurz, Kernaussagen fett, nichts raten, Preise mit zwei Nachkommastellen. Die gemietete GPU-VM bei centron kostet laufend (ca. 1,26 € pro Stunde), bis der Nutzer sie in der Console zerstört.

## Stichwort „VM einrichten“
Sagt der Nutzer „Ich möchte die VM wieder einrichten“ (oder Ähnliches), den Ablauf in `docs/vm-neu-einrichten.md` Schritt für Schritt führen: immer nur **einen** Schritt nennen, Ergebnis abwarten. Token und Bedienschlüssel nie im Chat (versteckte Abfrage in `windows/vm-einrichten.ps1`). Cloud-Init-Feld der Console nicht verwenden. Nach dem Test erinnern: VM zerstören (Name `kidolmetscher-test`).

## Betriebsarten (FEST, nicht erweitern ohne Auftrag des Nutzers)
Es gibt **genau zwei** Betriebsarten: **Vortrag** (durchgehend sprechen, keine Sperre, Sprecher muss nicht aufs Gerät schauen) und **Gespräch** (abwechselnd, Sperre für alle, bis alle Geräte „angezeigt“ und „fertig gesprochen“ gemeldet haben). Details: Protokoll Abschnitt 27. Keine dritte Betriebsart, keine zusätzlichen Schalter.
Innerhalb des Gesprächs (Protokoll Abschnitt 29): kein Redezeit-Limit, Wortmeldung „Ich möchte auch sprechen“ (keine Unterbrechung, automatische Übergabe), deutsche Vorlesung der Gast-Antworten am Bedienplatz (deutsche Stimme noch nicht eingerichtet, Lizenz ungeprüft).


# ===== Datei: docs/projektstand-2026-11-13.md =====

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

## 21. Wunsch: zwei Betriebsarten (Vortrag und Gespräch), Auswahl der Sprache durch den Gast, Neustart ohne „Theater“ (15.11.2026)

**Neustart:** `docs/vm-neu-einrichten.md` (Ablaufplan), `windows/vm-einrichten.ps1/.bat` (Ein-Klick, versteckte Abfrage von Token/Schlüssel, ungetestet), Stichwort in `CLAUDE.md`.

**Betriebsarten (Entwurf, noch nicht gebaut):**
1. **Vortrag (einseitig, vorhanden):** Ein Sprecher spricht Deutsch, Zuhörer wählen ihre Sprache am eigenen Gerät. Die Anwendung übersetzt nur Sprachen, für die gerade ein Zuhörer verbunden ist.
2. **Gespräch (zweiseitig, z. B. Behörde):** Mitarbeiter spricht Deutsch am Bedienplatz; der Gast wählt am Tablet zuerst seine Sprache (Auswahlseite gibt es schon, Bedienplatz zeigt „Ukrainisch: 1“) und spricht danach in seiner Sprache in das Tablet; die Übersetzung ins Deutsche erscheint (Text, optional Ton) beim Mitarbeiter. Es antwortet immer wechselseitig (Halbduplex: wer spricht, sperrt das andere Mikrofon, Anzeige „Sie sind dran“/„Bitte warten“).
3. **Dolmetscher-Modus (Schalter):** „Sprechen möglich“ erst, wenn die Übersetzung auf allen Geräten fertig gesprochen ist (Zuhörer melden „fertig“, nur Zähler, Zeitgrenze gegen hängende Geräte).

**Technisch dafür nötig (Aufwand: unbekannt, geschätzt mehrere Arbeitsschritte, zuerst mit Attrappen testen):**
- Spracherkennung mit **wählbarer Quellsprache je Strom** (heute fest `de`; Whisper large-v3 ist mehrsprachig, Qualität je Sprache unbekannt).
- Übersetzung X → Deutsch (TranslateGemma kann es laut Karte, Qualität je Sprache unbekannt).
- **Deutsche Stimme** für Piper (Lizenz der Stimme prüfen; nicht geprüft) in `TTS_VOICES`, Download in `fetch_voices.py`.
- Neue Nachrichten: Zuhörer-Seite sendet Mikrofon-Audio und „sprechen/fertig“, Server leitet Ergebnis an den Bedienplatz; Zustandsautomat „wer ist dran“.
- Zuhörer-Seite: Mikrofon-Freigabe, Sprechen-Taste, Hinweise; Datenschutzhinweis zur Mikrofon-Nutzung (Inhalte nur im Arbeitsspeicher, nicht gespeichert).
- Tests mit Attrappen, danach GPU-Test mit echtem Gast-Tablet.

**Offene Entscheidungen des Nutzers:** Sprechen per Taste oder automatisch? Soll die Rückübersetzung nur der Mitarbeiter hören/lesen oder auch der Gast sehen (Text seiner eigenen Aussage)? Wie viele Gäste gleichzeitig (Annahme: einer)? Welche Sprachen zuerst (Vorschlag: Ukrainisch und Englisch)? Datenschutz bei Behörden (Auftragsverarbeitung, Folgenabschätzung): zurückgestellt, vor Echtbetrieb klären.

## 22. Entscheidungen und Fortschritt zum Gesprächsmodus (15.11.2026)

- **Antworten des Nutzers:** alles per Sprache, optional Tippen; super einfach; keine Anzeige der eigenen Aussagen beim Gast; Sperre für alle, solange gesprochen, übersetzt oder vorgelesen wird; zunächst bis zu 3 Gäste, Ukrainisch und Englisch; keine Lizenzkosten; alles protokollieren.
- **Ergebnis:** vollständiger Entwurf in `docs/gespraechsmodus-entwurf.md` (Betriebsarten, Bedienung, Zustandsautomat, Protokoll, Randfälle, Datenschutz, Lizenzen, Bauplan, offene Punkte). **Gebaut und getestet (Attrappen-Ebene): Sperrlogik `server/app/turns.py` mit 8 Tests (202 Tests gesamt grün).** Noch nicht in Server und Oberflächen eingebunden.
- **Lizenz-Befund Websuche (15.11.):** Thorsten-Stimme laut Piper-Modellkarte CC0; eine Drittseite behauptet „nur privat/nicht kommerziell“ (Widerspruch, Modellkarte selbst prüfen). eva_k/karlsson: Quelle M-AILABS laut Community-Angabe, Lizenzwortlaut nicht bestätigt.
- **Nächste Schritte:** siehe Entwurf Abschnitt 8 und 9 (vier offene Fragen an den Nutzer).

## 23. Umgesetzt am 15.11.2026: Gesprächsmodus, 2-Minuten-Verlauf (Stand der Prüfung: Attrappen, noch nicht auf der GPU)

**Entscheidungen des Nutzers (15.11., Nachmittag):** Gäste hören sich **nicht** untereinander; **letzte 2 Minuten** der Texte sichtbar (wegen Lärm), danach gelöscht; Sprechdauer muss **eindeutig** angezeigt werden; „macht alles gut“ = Standardannahmen aus dem Entwurf (Antippen zum Sprechen, Ende nach ca. 2 s Pause, Mitarbeiter liest die Gast-Antwort).

**Gebaut (Code im Repository, 209 Tests grün, zusätzlich Ablauf im echten Chromium mit Attrappen und Fake-Mikrofon durchgespielt):**
- **Verlauf 2 Minuten:** Zuhörer-Seite behält alle Untertitel der letzten 2 Minuten (scrollbar, Mitscrollen nur wenn man unten ist), ältere werden aus Anzeige und Speicher gelöscht; derselbe Verlauf im Bedienplatz-Protokoll; Server-Ringpuffer mit Zeitgrenze `HISTORY_S=120` und bis zu 40 Einträgen (`RING_BUFFER_SIZE`).
- **Betriebsarten:** Auswahl beim Sitzungsstart („Vortrag“/„Gespräch“); `POST /api/rooms {mode}`.
- **Gespräch:** `server/app/turns.py` (Sperre: frei → spricht → übersetzt → wiedergabe → frei, Zeitgrenzen 60/20/15 s, Schonfrist 0,5 s, Notbremse „Freigeben“); `conversation.py` (Gast: Whisper mit seiner Sprache → TranslateGemma → Deutsch → Bedienplatz); Zuhörer melden „fertig“ (`played`), erst wenn alle fertig sind, wird frei; bis zu 3 Gäste (`MAX_GUESTS`); Zustand an alle Geräte (`turn`, `busy`); keine Inhalte in Logs.
- **Bedienplatz:** großer Knopf „Sprechen/Fertig“, Statusband vom Server (grün „SPRECHEN MÖGLICH“, „SIE SPRECHEN“ mit Balken der Satzlänge, rot „STOPP – <Grund>“), Gast-Antworten als große deutsche Zeilen (2 Minuten).
- **Gast-Tablet:** Knopf „Sprechen/Fertig“ in Ukrainisch/Englisch/Deutsch (uk ungeprüft; ar/tr/fa fallen auf Englisch zurück), dreifarbiges Band in seiner Sprache, Mikrofon nur nach Tippen aktiv, Einwilligungshinweis, Balken der Satzlänge.
- **Spracherkennung mit Quellsprache** je Strom (`new_stream(lang)`), Halluzinations-Filter (Abschnitt 20).

**Noch offen / nicht gebaut:** Tippen statt Sprechen; Ton der Gast-Antwort am Bedienplatz (deutsche Stimme, Lizenz der Stimme prüfen); Qualität von Ukrainisch (Spracherkennung und Übersetzung ins Deutsche) **unbekannt**; Messung der Zeitgrenzen und der „fertig“-Meldungen mit echtem Ton auf Tablets; Test mit echter GPU; Muttersprachler-Prüfung der Oberflächentexte; Datenschutz für Behörden (zurückgestellt).

## 24. Korrektur nach Nutzer-Rückmeldung (15.11.2026, später): längere Sätze, aktueller Verlauf

- **Rückmeldung:** Man soll **längere Sätze** sprechen können und das Fenster ganz ausnutzen; eine kurze Atempause darf nicht sofort eine Übersetzung auslösen. Der Verlauf muss **immer aktuell** sein: die neueste Übersetzung immer sichtbar, dazu nur die letzten Nachrichten (Nutzer: „vielleicht die letzten 10“).
- **Geändert (im Repository; Browser-Test mit Attrappen; auf der GPU ungetestet):**
  - Pause bis zum Abschluss eines Abschnitts **`ASR_SILENCE_MS` 700 → 1200 ms**, längster Abschnitt **`ASR_MAX_UTTERANCE_S` 12 → 20 s**, **`SEGMENT_MAX_WORDS` 12 → 40** (Sätze werden am Satzende getrennt, nicht mitten im Satz). Der Balken der Satzlänge und die Anzeigegrenzen folgen diesen Werten automatisch. Das Ende einer Aussage im Gespräch liegt jetzt bei Pause + 0,8 s (mindestens 2 s). Alle Werte sind **Annahmen und zu messen**; längere Abschnitte erhöhen die Wartezeit bis zur Übersetzung.
  - **Verlauf:** Zuhörer-Seite zeigt höchstens die **letzten 10 Nachrichten** und nichts, was älter als 2 Minuten ist; die **neueste Zeile ist immer sichtbar** (Mitscrollen, außer jemand liest bewusst weiter oben; nach 4 s springt es wieder nach unten); Bedienplatz-Protokoll zeigt die letzten 20.
  - **Fehler gefunden und behoben:** Beim **Neuverbinden** (z. B. Mobilfunkwechsel) schickte der Server den Verlauf erneut, und die Zuhörer-Seite zeigte Sätze **doppelt**. Jetzt merkt sich die Seite die Nummern der schon angezeigten Nachrichten (Test im Browser: nach Verbindungsabbruch 0 doppelte Zeilen). Das kann einen Teil der gemeldeten **Wiederholungen** erklärt haben (nicht belegt, andere Ursachen bleiben möglich).
- **Offen:** Ob die Übersetzung bei längeren Abschnitten (bis 20 s) mit TranslateGemma 4B noch gut ist und wie lang die Wartezeit wird: **unbekannt, messen**.

## 25. Vollständigkeit der Übersetzung (Rückmeldung vom 15.11.2026, abends) – Ursachenanalyse und Maßnahmen

**Rückmeldung des Nutzers:** Übersetzung nicht komplett: Texte fangen an und hören mittendrin auf; im Untertitel steht etwas, wurde aber nicht (ganz) gesprochen; bei Behörden muss **jedes Wort** übersetzt, angezeigt und gesagt werden; **STOPP muss bleiben, bis auf allen anderen Geräten alles fertig ist**; zusätzlich eine **Kontrolle** (eigener erkannter Text, wie es ausgespielt wird, dass es bei den anderen ankommt).

**Gefundene Verlustquellen im Code (aus dem Quelltext abgelesen, nicht auf der GPU gemessen; Ursache der konkreten Beobachtung deshalb nicht bewiesen):**
1. `TTS_SKIP_BACKLOG=2`: bei 2 wartenden Sätzen entfiel der **Ton**, der Untertitel blieb → passt genau zu „im Untertitel gesehen, aber nicht gesagt“. Jetzt praktisch aus (100000).
2. Zuhörer-Seite ließ Ton aus, wenn mehr als 6 s Ton warteten (`MAX_AUDIO_BACKLOG_S`). Jetzt nie.
3. `LANG_QUEUE_MAX=8`: bei Rückstau wurde der **älteste Satz verworfen**. Jetzt 500; Zuhörer-Warteschlange 50 → 500.
4. Audio-Warteschlange des Bedienplatzes (100 Blöcke = 5 s) verwarf bei langsamer Erkennung **Sprache**. Jetzt 3000 Blöcke (150 s); ein Verwerfen wird dem Bedienplatz gemeldet.
5. Satzende ohne Satzzeichen: der **letzte Satz blieb im Segmentierer liegen**, bis weitergesprochen wurde. Jetzt wird der Rest nach jeder Pause sofort ausgegeben.
6. Höchstlänge des Abschnitts schnitt **mitten im Wort**. Jetzt Schnitt an der leisesten Stelle im letzten Viertel (0,5 bis 3 s), der Rest bleibt für den nächsten Abschnitt erhalten.
7. Nachlauf nach dem letzten lauten Block wurde auf 250 ms gekürzt (leise Wortenden gingen verloren). Jetzt 600 ms und Hysterese (innerhalb einer Aussage zählt ab 60 % der Schwelle noch als Sprache).
8. Whisper-Filter zu streng (`no_speech`, `compression_ratio`, eigener VAD): Segmente konnten verschwinden. Jetzt weichere Werte; nur sehr wahrscheinlich Nicht-Sprache wird verworfen.
9. „Gleicher Text wie zuletzt“ verwarf eine **bewusst wiederholte Aussage**. Entfernt. Entdoppelung konservativer (Sätze erst ab 4 gleichen in Folge, Wortfolgen ab 4, Einzelwörter ab 6).
10. Übersetzung wurde bei zu kleiner Token-Grenze **abgeschnitten**. Jetzt: Abbruch erkennen und mit doppelter Grenze wiederholen (bis `MT_MAX_NEW_TOKENS`=1024).
11. Zeitgrenzen der Sperre (20 s Verarbeitung, 15 s Wiedergabe) konnten **vor** dem Ende lang laufender Ausgabe freigeben. Jetzt 90 s Verarbeitung und Wiedergabe-Grenze = erwartete Tonlänge + 8 s (mindestens 15 s).

**Neu für Kontrolle und Eindeutigkeit (Browser-Test mit Attrappen, 211 Tests grün; GPU/Tablets ungetestet):**
- Jedes Zuhörer-Gerät meldet je Satz **„angezeigt“** und **„fertig gesprochen“** (nur Zähler, keine Inhalte); der Bedienplatz zeigt in der **Kontroll-Ansicht** (aufklappbar) pro Satz den erkannten deutschen Text, die Übersetzung je Sprache und „angezeigt x/y · gesprochen x/y“ (letzte 2 Minuten, höchstens 10 Sätze).
- **Vortrag:** STOPP bleibt, bis der Server „nichts in Arbeit und alle Geräte fertig“ meldet (`flow`); ohne erkannte Abschnitte nach 8 s frei; Höchstdauer 180 s. **Gespräch:** echte Sperre wie bisher, jetzt mit Tonlänge in der Zeitgrenze.
- **Warnungen** am Bedienplatz (rot): Spracherkennung fehlgeschlagen, nicht verstanden, Übersetzung fehlgeschlagen, Audio verworfen, Gerät hat nicht bestätigt; der Gast bekommt „Nicht verstanden. Bitte wiederholen.“
- **Grenzen:** „fertig gesprochen“ meldet das Gerät (Browser: Ton zu Ende); ob ein Mensch es **verstanden** hat oder die **Übersetzung inhaltlich stimmt**, prüft das System nicht. Hundertprozentige Sicherheit ist nicht belegt; Qualität (Ukrainisch, lange Sätze mit 4B) bleibt zu messen; denkbar als Zusatz: Rückübersetzung ins Deutsche zur Kontrolle (nicht gebaut).

## 26. Betriebsart „Dolmetschen“ mit echter Sperre (Nutzerwunsch 15.11.2026, abends)

- **Rückmeldung:** Während die Übersetzung noch ausgegeben wird, konnte der Bedienplatz schon wieder sprechen (im **Vortrag** war STOPP nur eine Anzeige). Praxisbeispiel: Anweisung („Seite 52, Formular …“), kurze Verständigung („ist das okay?“): man muss warten, bis die Übersetzung **komplett angekommen und angezeigt/gehört** ist; dazwischen eine Pause. Es muss „in die Praxis passen“.
- **Gebaut (Browser-Test mit Attrappen, 212 Tests grün; GPU/Tablets ungetestet):** drei Betriebsarten beim Sitzungsstart:
  1. **Dolmetschen** (Vorauswahl, empfohlen): nur der Bedienplatz spricht (Sprechen-Knopf, Ende nach Pause + 0,8 s, mindestens 2 s, oder „Fertig“); danach **echte Sperre**: Der Server nimmt kein Audio des Bedienplatzes mehr an, bis alle Zuhörer-Geräte **„angezeigt“ und „fertig gesprochen“** gemeldet haben (Zeitgrenze = erwartete Tonlänge + 8 s, mindestens 15 s, Verarbeitung höchstens 90 s). Wer trotzdem spricht, sieht „bitte warten – Ihre Worte werden jetzt NICHT übersetzt“. Notbremse „Freigeben“.
  2. **Gespräch:** wie Dolmetschen, zusätzlich sprechen die Gäste (bis zu 3) abwechselnd, ebenfalls mit Sperre.
  3. **Vortrag:** durchgehend sprechen, keine Sperre (STOPP nur als Anzeige).
- **Gerät ohne Ton:** Das Zuhörer-Gerät meldet „fertig“ erst nach einer **Lesezeit** (800 ms + 300 ms pro Wort, höchstens 15 s; Annahme ca. 200 Wörter pro Minute), damit die Sperre nicht schon beim Erscheinen des Textes freigibt. **Ob ein Mensch den Text wirklich gelesen oder verstanden hat, ist nicht prüfbar.**
- **Folge:** Im Dolmetschen-Betrieb geht gesprochene Sprache verloren, wenn sie **während der Sperre** gesprochen wird (sie wird bewusst nicht gesendet); der Bedienplatz warnt dann. Das ist die gewünschte Wartephase, kostet aber Zeit pro Austausch.
- **Offen:** Wie lang die Wartephase in der Praxis ist (hängt von Erkennung, Übersetzung, Ton, Netz ab): **unbekannt, mit GPU und Tablets messen**; ob 1,2 s Pause plus 0,8 s als Aussageende angenehm sind; Verhalten bei Verbindungsabbruch eines Zuhörer-Geräts (Zeitgrenze, danach frei).

## 27. FESTLEGUNG: Es gibt genau ZWEI Betriebsarten (Vorgabe des Nutzers, 15.11.2026, abends) – ersetzt die Aussagen zu „Dolmetschen“ in Abschnitt 26

**Status: umgesetzt und mit Attrappen im Browser geprüft (213 Tests grün); vom Nutzer noch NICHT getestet; auf GPU und Tablets ungetestet.**

| | **Vortrag** | **Gespräch** |
| --- | --- | --- |
| Zweck | Eine Person spricht durchgehend (z. B. Präsentation); Zuhörer hören und lesen mit | Unterhaltung, z. B. Behörde: Mitarbeiter und Gäste sprechen **abwechselnd** |
| Bedienung | Sprecher muss **nicht aufs Gerät schauen**; Mikrofon läuft durchgehend, das System übersetzt fortlaufend | Großer Knopf „Sprechen“ (Bedienplatz und Gast-Tablet), Ende der Aussage nach Pause oder „Fertig“ |
| Sperre | **Keine.** Ruhige Anzeige „Läuft – einfach sprechen“ (mit Hinweis, wenn Sätze in Arbeit sind); rote Warnung nur bei Problemen | **Echt für alle:** Solange jemand spricht, übersetzt wird oder vorgelesen wird, darf **niemand** sprechen. Erst wenn **alle Geräte „angezeigt“ und „fertig gesprochen“ gemeldet haben**, wird frei (grün) |
| Gäste | hören/lesen nur | bis zu 3, sprechen in ihrer Sprache, der Mitarbeiter liest den deutschen Text; sie hören sich nicht untereinander |
| Kontrolle | aufklappbar: erkannter Text, Übersetzung je Sprache, „angezeigt x/y · gesprochen x/y“ | dito, zusätzlich Gast-Antworten (letzte 2 Minuten) |

**Regeln, die für beide gelten:** nichts wird stillschweigend verworfen (Abschnitt 25); Verlauf: seit Abschnitt 28 **ohne Zeitgrenze** (Zuhörer: letzte 60 Nachrichten, nur im Browser), neueste immer sichtbar; Sprachen zunächst Ukrainisch und Englisch; keine Lizenzkosten (außer Server-Miete); kein Speichern von Inhalten.

**Ausdrücklich NICHT mehr vorhanden:** eine dritte Betriebsart „Dolmetschen“ (aus Abschnitt 26 entfernt; ihre Wirkung, „erst weiter, wenn alles angekommen ist“, gehört jetzt zum **Gespräch**), Dolmetscher-Schalter, getrennte Vorträge mit Sperre. Auswahl beim Sitzungsstart: zwei Optionen, Vorauswahl **Vortrag**.



## 28. Vortrag stockt, leere Anzeige, falsche Tonreihenfolge (Rückmeldung 15.11.2026, abends) – Ursachen und Maßnahmen

**Beobachtung des Nutzers (Vortrag):** nach längerem Sprechen nimmt das System keinen Text mehr an, alle Anzeigen leer, erster Satz wird nicht übersetzt; im Kontrollfeld war Satz #26 schon „gesprochen 1/1“, während #25 noch „gesprochen 0/1“ stand.

**Ursachen (Stand: aus dem Code abgeleitet, auf der GPU noch NICHT gemessen):**
1. **Tonreihenfolge (sicher, im Code belegt):** Der Browser hat den Ton erst dekodiert und danach die Abspielzeit festgelegt. Ein langer Satz (#25) braucht länger zum Dekodieren als ein kurzer (#26); dieser bekam dann den früheren Platz und wurde zuerst gesprochen. Server und Textreihenfolge waren richtig. **Behoben:** Ton wird in Eingangsreihenfolge eingeplant (`playChain` in `web/js/listener.js`), Simulation: Reihenfolge 25, 26.
2. **Leere Anzeige:** Die 2-Minuten-Löschung leerte die Anzeige nach jeder Sprechpause von 2 Minuten. **Entfernt** (Nutzerwunsch „zeig eben mal alles an“): Zuhörer zeigen die letzten 60 Nachrichten, Bedienplatz die letzten 30 Kontrollsätze; kein Zeitlimit mehr; Hinweis „Letzte 2 Minuten“ entfällt.
3. **Verzögerung/Stau (wahrscheinlich, nicht gemessen):** Meine Änderung auf 1200 ms Pause / 20 s Höchstlänge ließ die Erkennung erst spät anlaufen. **Zurückgenommen:** `ASR_SILENCE_MS=800`, `ASR_MAX_UTTERANCE_S=8` (Schnitt an der leisesten Stelle bleibt). Der sofortige Ausgabe-Zwang für Reste ohne Satzzeichen wurde durch eine **Haltezeit** ersetzt (`SEGMENT_TAIL_HOLD_MS=2200`): ein Satzrest wartet bis zu 2,2 s auf die Fortsetzung, dann wird er trotzdem übersetzt (nichts geht verloren).
4. **Blockade durch den Bedienplatz (möglich):** Die Übersetzung wartete, bis der Bedienplatz die Nachricht samt Ton (Base64) angenommen hatte; ein langsames Netz (Hotspot) bremste dann alle Sprachen. **Geändert:** Nachrichten gehen ohne Ton über eine Warteschlange (2000) an den Bedienplatz, die Übersetzung wartet nicht mehr.
5. **Hängende Stufe (möglich):** MT/TTS haben jetzt eine Zeitgrenze `STAGE_TIMEOUT_S=60`: bei MT-Zeitüberschreitung Meldung „Problem“ und der Satz zählt als erledigt (Vortrag läuft weiter); bei TTS fehlt nur der Ton, der Untertitel kommt.

**Neu: Staulog** alle 10 s (nur Zähler, keine Inhalte): `stau audio_q=… op_q=… offen=… segmente=… uebersetzungen=… fehler=…`. Abruf auf der VM: `journalctl -u kidolmetscher --no-pager | grep stau | tail -20`. Damit lässt sich beim nächsten Test **messen**, ob sich Audio in der Warteschlange staut (Erkennung zu langsam), Sätze offen bleiben (Übersetzung zu langsam) oder nichts hängt.

**Tests:** 212 bestanden, 4 übersprungen, 1 fehlgeschlagen (`test_mt_laden_faellt_auf_bild_text_modell_zurueck`: braucht `torch`, das in dieser Entwicklungsumgebung nicht installiert ist; schlägt auch ohne meine Änderungen fehl). Neuer Test: Satzrest wartet auf Fortsetzung und wird danach ausgegeben. Browsertest Vortrag mit Mock: keine Fehler, Anzeige „Läuft – einfach sprechen · n Satz in Arbeit“.

**Offen / unbekannt:** Ob die Übersetzung auf der A4000 bei durchgehendem Sprechen mit zwei Sprachen schritthält (TranslateGemma 4B und Whisper teilen die GPU; 16 GB Speicher, Reserve unbekannt). Messpunkt: Staulog über ≥ 5 Minuten Vortrag, dazu `nvidia-smi` während des Sprechens.


## 29. Gespräch: Wortmeldung, kein Redezeit-Limit, deutsche Vorlesung (Nutzerwünsche 15.11.2026, nach erfolgreichem Test von Abschnitt 28)

**Rückmeldung des Nutzers:** Vortrag läuft deutlich besser, keine Fehler mehr aufgefallen (kurzer Test, nicht über längere Zeit). Gespräch funktioniert gut. Wünsche: (1) der Mitarbeiter soll das Gesagte der Gäste **auf Deutsch vorgelesen** bekommen (nicht nur lesen), (2) **kein Zeitlimit** für lange Redebeiträge (z. B. Behördenmitarbeiter 3–4 Minuten), (3) wer auch etwas sagen möchte, kann sich **melden**, ohne den Sprechenden zu unterbrechen; der Sprechende sieht einen Hinweis und kommt zum Ende; danach ist die wartende Person **automatisch** dran.

Das sind Funktionen **innerhalb** des Gesprächs (keine dritte Betriebsart, Abschnitt 27 bleibt gültig).

**Umgesetzt:**
1. **Kein Redezeit-Limit:** Die Zeitgrenze von 120 s ist entfernt; es bleibt nur eine Notgrenze von 30 Minuten gegen hängende Geräte (`TurnLimits.speak_max_s=1800`). Unverändert: Eine Aussage endet nach längerer Pause (ca. 2 s) oder mit „Fertig“; bei längerem Sprechen wird fortlaufend übersetzt. **Offen/unbekannt:** ob 2 s Pause für Redner mit Denkpausen zu kurz ist (Messpunkt: im Test bewusst 3–4 s Pausen machen).
2. **Wortmeldung:** Ist gesperrt, zeigt der Knopf „✋ Ich möchte auch sprechen“ (Bedienplatz und Gast-Tablet; erneutes Tippen nimmt zurück). Der Sprechende sieht „⏳ Ein Gast möchte sprechen – bitte zum Ende kommen“ (Gast: Text in seiner Sprache, de/en/uk; ar/tr/fa fallen auf Englisch zurück). Nichts wird unterbrochen. Reihenfolge der Wortmeldungen = Reihenfolge des Eingangs (`TurnManager.request/cancel_request`, `waiting`). Wird frei, bekommt der Erste sofort das Wort; sein Mikrofon startet automatisch (Gast: Mikrofon-Freigabe wird schon beim Antippen der Wortmeldung erteilt). Meldet sich das Gerät nicht innerhalb von 30 s (`pickup_s`), geht es weiter. Gäste sehen nicht, wer sich meldet (nur „jemand möchte sprechen“).
3. **Deutsche Vorlesung für den Mitarbeiter:** Die Gast-Antwort (deutscher Text) wird mit TTS-Stimme „de“ vertont und am Bedienplatz vorgelesen (Häkchen „Antworten der Gäste auf Deutsch vorlesen“, Voreinstellung an); der Bedienplatz meldet „fertig gesprochen“ (Sperre wartet darauf, wie bei den Gästen). **Ohne eingerichtete deutsche Stimme bleibt es beim Lesen (kein Fehler).**
4. **Sprachwechsel des Gastes:** Ist schon vorhanden: Knopf 🌐 oben rechts (nur beim Sammel-Link, nicht bei Sprach-Links). Beim Wechsel wird die Anzeige geleert, die Spracherkennung des Gastes folgt der neuen Sprache. Browsertest mit Attrappen: Wechsel auf Türkisch funktioniert, Gespräch bleibt bedienbar. Das Gast-Tablet sollte den Sammel-Link verwenden.

**Deutsche Stimme – NOCH NICHT eingerichtet (Entscheidung/Prüfung nötig):** Piper-Stimmen liegen in `rhasspy/piper-voices` (z. B. `de_DE-thorsten-medium`). **Lizenz nicht geprüft:** Die Modellkarte war aus dieser Entwicklungsumgebung nicht abrufbar (huggingface.co gesperrt), der frühere Hinweis auf widersprüchliche Angaben zur Thorsten-Stimme bleibt offen. Erst Modellkarte lesen, dann auf der VM `python3 scripts/fetch_voices.py <ordner> <stimme>` ausführen und in der Datei mit `TTS_VOICES=` (siehe `scripts/server_setup.sh`) `,de=<stimme>` anhängen, Dienst neu starten.

**Tests:** 218 bestanden, 4 übersprungen, 1 fehlgeschlagen (wie zuvor: `torch` fehlt in der Entwicklungsumgebung). Neu: 6 Tests zur Sperrlogik (Wortmeldung, Reihenfolge, Zurückziehen, Übernahme-Frist, kein 2-Minuten-Limit, Gerät weg). Browsertest mit Attrappen (Mitarbeiter spricht, Gast meldet sich, Mitarbeiter sieht Hinweis, „Fertig“, Gast bekommt das Wort automatisch, Gast „Fertig“, Sperre frei, Sprachwechsel): keine Fehler. **Nicht getestet:** echtes Mikrofon und echte Stimmen auf Tablet/Chromebook.

**Fragen des Nutzers (Zugriff von einem anderen Gerät):** Die Anwendung läuft im Browser auf dem Server; der Bedienplatz (z. B. Chromebook) braucht nur den Link `https://dolmetscher.kischub.de/operator.html`, den Bedienschlüssel (nie im Chat) und Mikrofonfreigabe. Voraussetzung: die VM läuft (kostet laufend). Laufende Sitzungen liegen nur im Arbeitsspeicher des Servers: Bedienplatz neu laden = neue Sitzung/neuer Link nötig.


# ===== Datei: docs/vm-neu-einrichten.md =====

# VM neu einrichten (Ablaufplan, Stand 15.11.2026)

**Stichwort für einen neuen Chat:** „Ich möchte die VM wieder einrichten.“ Dann dieses Dokument Schritt für Schritt abarbeiten: jeweils **einen** Schritt nennen, auf das Ergebnis warten, nichts vorwegnehmen. Token und Schlüssel **nie** in den Chat (Nutzer tippt sie nur in die versteckte Abfrage des Skripts).

**Status der Teile:** Gelaufen am 14./15.11.2026: Setup-Skripte auf der VM (mit mehreren Fehlversuchen, jetzt behoben), HTTPS-Adresse, Dienst, Handy-Test. **Ungetestet:** `windows/vm-einrichten.ps1` (Ein-Klick-Einrichtung) und der Gesamtablauf ohne manuelle Eingriffe. Cloud-Init-Feld der Console: **nicht verwenden** (Text kam nicht an, VM wurde einmal als „fehlgeschlagen“ markiert).

## Einmalig vorbereitet (vorhanden)
- centron-Konto, SSH-Schlüssel `kidolmetscher-test` (in der Console hinterlegt, privater Schlüssel am Windows-PC).
- Hugging-Face-Konto mit Freigabe für TranslateGemma 4B/12B/27B.
- DNS: A-Eintrag `dolmetscher` bei ALL-INKL (KAS), zeigt auf die jeweils letzte VM-IP. Wildcard `*` und Hauptdomain **nie ändern**.

## Ablauf
1. **Vorher besorgen:** neues Hugging-Face-Lesetoken (Typ Read; altes löschen), Bedienschlüssel (24 oder mehr Buchstaben/Ziffern, im Passwort-Manager) **oder** das Skript einen erzeugen lassen.
2. **VM anlegen (selbst oder mit Plugin-Prompt „Wizard vorbereiten“, Cloud-Init AUS):** GPU RTX A4000 16 GB, Bamberg BBG1, 4 vCPU / 16 GB RAM / 100 GB, Ubuntu LTS 26, SSH-Key `kidolmetscher-test`, Name `kidolmetscher-test`. Preisleiste prüfen (zuletzt 0,2652 € pro Stunde netto), **selbst „VM erstellen“ klicken**. Status in der Serverliste prüfen: Steht dort „Fehlgeschlagen“, nicht weitermachen.
3. **IP notieren** (VM-Seite, Netzwerk). **DNS-Eintrag `dolmetscher` bearbeiten** (KAS: Tools → DNS-Einstellungen → kischub.de → Stift beim Eintrag `dolmetscher` → neue IP). Nur diesen einen Eintrag ändern; die Liste muss 9 Einträge zeigen.
4. **Am Windows-PC `windows\vm-einrichten.bat` doppelklicken.** Das Skript fragt IP, Token und Schlüssel (unsichtbar), prüft SSH, schickt das Startskript, wartet (ca. 10 bis 20 Minuten, **ungemessen**) und prüft `https://dolmetscher.kischub.de/healthz`. Am Ende zeigt es die Adresse (und den Schlüssel, falls erzeugt: in den Passwort-Manager kopieren).
5. **Testen:** Bedienplatz öffnen, anmelden, Sitzung, QR-Code am Handy, 10 Sekunden sprechen.
6. **Fertig: VM zerstören** (Console → ccloud³ → Server → `kidolmetscher-test` → Zerstören, Namen eingeben). Billing am nächsten Tag prüfen.

## Falls das Skript fehlschlägt (Rückfall von Hand, nur mit Einzelbefehlen)
- SSH am Windows-PC: `ssh root@<IP>` (Prompt muss `root@xv…:~#` zeigen).
- Fortschritt: `grep -a "^==" /var/log/kidolmetscher-init.log | tail -n 10`
- Modell fehlt (`/root/kidolmetscher/models/translategemma` nicht da): `strings /var/log/kidolmetscher-init.log | grep HINWEIS`; Token prüfen; Modell laden: ` HF_TOKEN='hf_…' /root/kidolmetscher/.venv/bin/python /root/kidolmetscher/src/kidolmetscher/scripts/fetch_models.py google/translategemma-4b-it /root/kidolmetscher/models/translategemma`, dann `systemctl restart kidolmetscher`.
- Dienst/Zertifikat: `journalctl -u kidolmetscher --no-pager | tail`, `journalctl -u caddy --no-pager | tail`.
- Neue Programmversion einspielen: `cd /root/kidolmetscher/src && git pull -q --ff-only && systemctl restart kidolmetscher`.

## Bekannte Stolpersteine (alle am 14./15.11. erlebt)
- Bei der Einrichtung **Befehle einzeln** eingeben; nie `cat > datei` und danach Befehle tippen; Prompt (`C:\Users\Dell>` = PC, `root@xv…:~#` = VM) vor jedem Befehl prüfen.
- Variablennamen nicht überschreiben (`HF_TOKEN=` bleibt stehen): deshalb die versteckte Abfrage im Skript.
- Alte VM-IP im Browser-Cache: `ipconfig /flushdns`; Test an DNS vorbei: `curl.exe -I --resolve dolmetscher.kischub.de:443:<IP> https://dolmetscher.kischub.de/`.
- Der Dienst startet erst nach dem Neustart der VM; das Setup meldet „Fertig, Neustart“.

## Test-Empfehlung vor dem nächsten GPU-Einsatz
Skript `vm-einrichten.ps1` **einmal auf einer billigen Nicht-GPU-VM** (centron „Optimiertes Cloud Computing“) ausprobieren: Zustellung per SSH, Ports 80/443, Zertifikat. Die GPU-spezifischen Schritte (Treiber, Whisper, Modell) bleiben dabei ungeprüft.


# ===== Datei: docs/gespraechsmodus-entwurf.md =====

# Entwurf: Betriebsarten „Vortrag“ und „Gespräch“ (Stand 15.11.2026)

> **Maßgeblich ist Abschnitt 27 des Protokolls: genau ZWEI Betriebsarten (Vortrag ohne Sperre, Gespräch mit Sperre).** Andere Betriebsarten oder Schalter in diesem Entwurf gelten nicht mehr.

Aufgenommen aus den Wünschen des Nutzers vom 15.11.2026. **Stand 15.11. abends: Server, Bedienplatz und Gast-Seite sind gebaut (siehe Protokoll Abschnitt 23); offen: Tippen statt Sprechen, Ton am Bedienplatz, GPU-Test.** Zahlen mit „Annahme“ sind nicht gemessen.

## 0. Vorgaben des Nutzers
- **Alles per Sprache.** Optional zusätzlich Tippen (z. B. laute Umgebung). Es muss **super einfach** bleiben, wie die bisherige Bedienung.
- **Zwei Betriebsarten:** Vortrag (einseitig) und Gespräch (zweiseitig).
- **Sperren:** Spricht jemand oder wird übersetzt oder vorgelesen, ist das Sprechen **für alle** gesperrt. Alles muss logisch und eindeutig sein.
- **Der Gast sieht seine eigenen Aussagen nicht** (kein Nutzen).
- **Bis zu 3 Gäste**, zuerst **Ukrainisch und Englisch**.
- **Keine Lizenzkosten**, möglichst Open Source.
- **Alles protokollieren.**

## 1. Betriebsarten
| | Vortrag (vorhanden) | Gespräch (neu) |
| --- | --- | --- |
| Sprecher | nur der Bedienplatz, Deutsch | Bedienplatz (Deutsch) und Gäste (ihre Sprache), abwechselnd |
| Zuhörer/Gäste | wählen ihre Sprache, hören/lesen | wählen ihre Sprache, hören/lesen **und können sprechen** |
| Sperre | nur Anzeige am Bedienplatz (vorhanden) | **echte Sperre für alle** (siehe 3) |
| Auswahl | beim Start der Sitzung am Bedienplatz: zwei große Knöpfe „Vortrag“ / „Gespräch“ |

## 2. Bedienung (so einfach wie möglich)
**Bedienplatz (Mitarbeiter):** Beim Start „Vortrag“ oder „Gespräch“ wählen. Im Gespräch steht **ein großer Knopf „Sprechen“**. Tippen = Aussage beginnt; sie endet **automatisch nach ca. 2 Sekunden Pause** oder durch erneutes Tippen. Die Anzeige hat drei Zustände wie heute: grün „SPRECHEN MÖGLICH“, orange „Übersetzung läuft“, rot „STOPP: <wer> spricht / wird vorgelesen“. Der Knopf ist gesperrt, solange nicht grün. **„Freigeben“-Knopf** (klein) als Notbremse. Antworten der Gäste erscheinen als **deutscher Text** (optional Ton, Schalter).

**Gast-Tablet:** Der Gast scannt den QR-Code oder öffnet den Link, wählt **zuerst seine Sprache** (vorhanden), sieht danach Untertitel (und hört den Ton) wie heute. Zusätzlich unten **ein großer Knopf „Sprechen“** (in seiner Sprache beschriftet). Tippen = sprechen; nach ca. 2 Sekunden Pause endet die Aussage automatisch. Oben dieselbe dreifarbige Statusleiste in seiner Sprache. Eigene Aussagen werden **nicht** angezeigt; nach dem Sprechen zeigt die Leiste „Bitte warten“, bis es wieder frei ist.
**Tippen statt Sprechen:** Unter dem Knopf eine einklappbare Zeile „Tippen“. Der Text läuft durch dieselbe Übersetzung und dieselbe Sperre (kein Ton-Mikrofon).

**Warum Tippen zum Sprechen und nicht Dauer-Mikrofon:** Verhindert Rückkopplung (Tablet spielt Ton, Mikrofon hört ihn), Dauer-Streaming von Hintergrundgeräuschen und Datenschutz-Bedenken (Mikrofon nur bewusst offen), und es spart Datenvolumen.

## 3. Sperrlogik (Zustandsautomat, gebaut in `server/app/turns.py`, 8 Tests)
**Zustände:** `frei` → `spricht` → `uebersetzt` → `wiedergabe` → `frei`.
- **frei:** jeder darf „Sprechen“ antippen. **Wer zuerst kommt, bekommt das Wort**; alle anderen bekommen „busy“ (Knopf bleibt grau mit Erklärung).
- **spricht:** Ende durch Pause (ca. 2 s, Annahme), Antippen oder **Zeitgrenze 60 s** (Annahme). Spricht jemand mit getrenntem Gerät weiter: Aussage gilt als beendet.
- **uebersetzt:** solange noch Abschnitte der Aussage verarbeitet werden. **Zeitgrenze 20 s** (Annahme).
- **wiedergabe:** Ergebnisse sind verteilt. Jedes Empfängergerät meldet **„fertig“** (Ton zu Ende gespielt, bei stumm/ohne Stimme: Untertitel angezeigt). Wenn alle fertig sind, folgt eine **Schonfrist 0,5 s**, dann `frei`. **Zeitgrenze 15 s**, damit ein ausgeschaltetes Gerät nicht blockiert.
- **Notbremse:** „Freigeben“ am Bedienplatz setzt sofort auf `frei`.
- Die Sperre gilt für **alle** Geräte einschließlich des Bedienplatzes. Der Server entscheidet (nicht die Browser), damit zwei gleichzeitige Tipper eindeutig sind.
- Im **Vortrag** läuft nur die Anzeige am Bedienplatz (kein Sperren der Zuhörer, es sprechen keine).

## 4. Technik (Bauplan, Aufwand unbekannt)
1. **Fertig:** `turns.py` (Zustandsautomat) mit Tests.
2. **Raum-Art:** `mode` = `vortrag|gespraech` beim Anlegen des Raums; `max_gaeste=3`; Gäste bekommen Kennung `gast:<n>` nach Beitrittsreihenfolge.
3. **Spracherkennung je Strom mit Quellsprache** (heute fest `de`): `new_stream(lang)` mit `language=lang` (Ukrainisch, Englisch zuerst). **Whisper-Qualität für Ukrainisch ist unbekannt** (messen mit eigenen Sätzen).
4. **Rückrichtung:** Gast-Text → TranslateGemma `lang→de` → Bedienplatz (Text, optional Ton). Nur der Mitarbeiter bekommt die Übersetzung (Annahme; andere Gäste sehen nur „Gast spricht“).
5. **Deutsche Stimme** für den Ton am Bedienplatz (optional, Schalter): Piper `de_DE-thorsten-medium`; die Modellkarte nennt laut Suchergebnis **CC0**, eine Drittseite behauptet „nur nichtkommerziell“ (Widerspruch). **Vor Einsatz Modellkarte selbst lesen.**
6. **Protokoll (JSON):**
   - Zuhörer-Seite → Server: `{"type":"talk","on":true|false}`, Binär-Audio (PCM16, 16 kHz) während `on`, `{"type":"text","text":"…"}` (max. 500 Zeichen), `{"type":"played","seq":n}` („fertig“).
   - Server → alle: `{"type":"turn","state":"frei|spricht|uebersetzt|wiedergabe","who":"staff|gast:n","reason":""}` bei jeder Änderung; Fehler `busy`.
   - Server → Bedienplatz: `{"type":"guest_message","seq","lang","text_de","audio?","t":{t_audio_in,t_asr,t_mt,t_tts,t_out}}` (Zeitstempel wie Regel 4).
7. **Oberflächen:** Bedienplatz: Moduswahl, großer Sprechen-Knopf, Statusleiste, „Freigeben“. Zuhörer-Seite: Sprechen-Knopf, Statusleiste, Tippen-Zeile, Texte in Ukrainisch/Englisch (`strings.js`).
8. **Tests:** Attrappen (Mock-ASR/MT/TTS) für den ganzen Ablauf, simulierte Geräte (zwei Gäste drücken gleichzeitig, Gerät bricht ab, Zeitgrenzen). **Danach GPU-Test** mit echtem Gast-Tablet.

## 5. Randfälle (zu berücksichtigen)
- Zwei tippen gleichzeitig: Server nimmt den ersten, der zweite bekommt „busy“ und eine klare Anzeige.
- Gast verlässt die Seite mitten im Satz: Sperre löst sich nach ca. 3 s ohne Audio (Annahme) bzw. durch `device_left`.
- Netz bricht ab (Mobilfunk): Geräte verbinden sich neu; die Zeitgrenzen verhindern Dauer-Sperren.
- Ein Gast wechselt die Sprache: gilt ab der nächsten Aussage.
- Gast spricht eine andere Sprache als gewählt: Erkennung wird schlecht; Hinweis „Bitte Sprache prüfen“ nur, wenn `no_speech`/leerer Text mehrfach (Annahme).
- Stille/Rauschen nach dem Tippen: Aussage wird verworfen, Sperre löst sich sofort (kein Text).
- Sehr lange Aussagen: Zeitgrenze 60 s, danach Übersetzung der bisherigen Abschnitte.
- Mehrere Gäste mit verschiedenen Sprachen: Aussage des Mitarbeiters geht an alle Sprachen; Aussage eines Gastes nur an den Mitarbeiter.

## 6. Datenschutz
Mikrofon nur nach Tippen offen; Audio und Text nur im Arbeitsspeicher, nichts wird gespeichert, keine Inhalte in Logs (nur Zähler und Zeiten); Einwilligungshinweis auf der Gast-Seite („Ihre Stimme wird zum Übersetzen an den Server gesendet und nicht gespeichert“); Zufalls-Link mit Ablauf. **Rechtliche Fragen bei Behörden (Auftragsverarbeitung, Folgenabschätzung): zurückgestellt**, vor Echtbetrieb klären (keine Rechtsberatung).

## 7. Lizenzen und Kosten (Anforderung: keine Lizenzkosten)
| Baustein | Lizenz (laut `lizenzen-recherche.md` und Suche vom 15.11.) | Kosten |
| --- | --- | --- |
| faster-whisper, CTranslate2, Whisper large-v3 | MIT bzw. Apache-2.0 (large-v3: Apache-2.0) | keine |
| TranslateGemma 4B/12B | Gemma-Nutzungsbedingungen: **kostenlos, aber keine Open-Source-Lizenz im üblichen Sinn**; als gehosteter Dienst gilt es laut Bedingungen als „Distribution“ (Auflagen weitergeben); Prohibited-Use-Policy **nicht ausgewertet** | keine Lizenzgebühr gefunden; Auflagen rechtlich klären |
| Piper (`piper-tts`) | Original MIT (archiviert), Nachfolger **GPL-3.0**; für Betrieb als eigener Dienst ohne Weitergabe der Software meist unkritisch, **rechtlich klären** | keine |
| Piper-Stimmen | je Stimme eigene Karte: `uk_UA-ukrainian_tts` CC0 laut früherer Lesung; `en_GB-alba` CC BY 4.0; `de_DE-thorsten` CC0 laut Modellkarte (Widerspruch einer Drittseite) | keine, aber Namensnennung bei CC BY |
| Caddy, Let's Encrypt, Ubuntu, FastAPI | Apache-2.0 / kostenlos / frei / MIT | keine |
| **Echte Kosten** | GPU-Server bei centron (A4000 zuletzt 0,2652 € pro Stunde netto) | nur Miete |
Keine Rechtsberatung; Lizenzprüfung vor Echtbetrieb wiederholen.

## 8. Reihenfolge der nächsten Arbeitsschritte
(a) Entscheidung des Nutzers zu offenen Punkten (unten), (b) Raum-Art und Sperr-Integration im Server (Attrappen-Test), (c) Spracherkennung mit Quellsprache und Rückübersetzung, (d) Bedienplatz-Oberfläche, (e) Gast-Oberfläche (Ukrainisch/Englisch), (f) Test mit zwei echten Geräten auf der GPU, (g) Messwerte und Qualität (Muttersprachler) für Ukrainisch und Englisch.

## 9. Offene Punkte für den Nutzer
1. Sprechen per **Antippen mit automatischem Ende nach Pause** (Empfehlung) oder Halten des Knopfes?
2. Soll der Mitarbeiter die Gäste-Antwort **nur lesen** oder auch **hören** (deutsche Stimme)? Empfehlung: lesen, Ton per Schalter.
3. Sollen sich **Gäste untereinander** übersetzt hören (nur der Mitarbeiter ist Annahme)?
4. Ist **ca. 2 Sekunden Pause** als Ende der Aussage in Ordnung?


# ===== Datei: docs/centron-console-befund.md =====

# centron-Console: Befund vom 12.11.2026 (Stand 12.11.2026)

Quelle: Bericht des Browser-Plugins aus dem eingeloggten Konto (nur gelesen, nichts angelegt, bestellt oder gespeichert) sowie centron-Doku-Seiten, die das Plugin angegeben hat. Von mir **nicht selbst geprüft**. Alle Preise netto, zuzüglich 19 % Umsatzsteuer (Billing zeigt 19,00 %).

## Ergebnis in Kürze

1. **Guthaben 0,00 €.** Das beworbene Startguthaben von 200 € (60 Tage) wird im Konto nicht angezeigt. Laut centron.de/pricing gilt es nur für neue Konten und nur für Gewerbetreibende. Im Konto ist keine Steuer-ID hinterlegt. **Ob das der Grund ist: unbekannt.** Rückfrage beim Support.
2. **Es gibt kein Kostenlimit und keine Warnschwelle** in der Console (geprüft: Dashboard, Billing, Kontingente, cReports, Konto-, Team-, Projekteinstellungen). Die öffentliche FAQ verspricht E-Mail-„Rechnungswarnungen“; eine Einstellung dafür wurde nicht gefunden. **Ein Limit von 20 € lässt sich daher nicht technisch setzen.**
3. **Indirekte Obergrenze:** Team-Limits (nur der Support erweitert sie): 4 Kerne, 8 GB RAM, 400 GB Speicher, 1 GPU. Das begrenzt die Größe, nicht die Dauer und nicht den Betrag.
4. **Gestoppte Instanzen werden weiter berechnet** (Doku, Billing → Rechnungen, wörtlich: „Auch gestoppte, ausgeschaltete oder geshelvte VMs werden weiterhin berechnet“). Abrechnung stundengenau, jede angefangene Stunde zählt voll; Abbuchung am Monatsersten über die Standard-Zahlungsmethode.
5. **AVV nicht gefunden** (Billing → Verträge leer; Support-Fußzeile verlinkt AGB, TOMs, Datenschutz, SLAs, Impressum, aber keinen AVV). Der Vertragstext ist laut früherer Lesung öffentlich unter centron.de/rechtliches/agb/auftragsverarbeitung; Abschluss über compliance@centron.de.
6. **Standort:** In der Console heißt er „Bamberg · Datacenter 1 · BBG1“ (wählbar), „Glattbrugg · GLB1“ ist belegt. Laut Kubernetes-Doku ist Hallstadt bei Bamberg dieselbe Region BBG1. „eu-de“ steht weder in der Console noch in der Doku (meine frühere Angabe stammte von der öffentlichen GPU-Seite und ist zu korrigieren).
7. **Ab 14.12.2026** ist für die Anmeldung ein zweiter Faktor (2FA) Pflicht.

## Preise (netto)

| Posten | Preis |
| --- | --- |
| GPU NVIDIA RTX 6000 Ada 48 GB | 1,19 € pro Stunde (Console: 1,1919 €; 858,19 € pro Monat) |
| vCPU | 1,64 € pro Einheit und Monat |
| RAM | 1,90 € pro GB und Monat (Doku „Pricing Anpassung 2026“ nennt 0,97 € ohne Einheit: Widerspruch, Support fragen) |
| Speicher | 0,05 € pro GB und Monat |
| Konfiguration 4 vCPU / 8 GB / 300 GB + GPU | 894,95 € pro Monat = ca. 1,24 € pro Stunde |
| RTX A4000 16 GB | 149,00 € pro Monat (ca. 0,21 € pro Stunde) |
| Quadro RTX 6000 24 GB, A100 40 GB, A100 80 GB | in der Console als belegt markiert (Support kontaktieren) |

Stundenwerte = Monatspreis ÷ 720 (nachgerechnet laut Bericht).

## Was das für die Kosten heißt (meine Rechnung, netto, mit 1,24 € pro Stunde)

| Dauer | Kosten |
| --- | --- |
| 2 Stunden (Test) | ca. 2,49 € |
| 16 Stunden | ca. 19,89 € (so weit reicht ein Betrag von 20 €) |
| 24 Stunden (Instanz vergessen) | ca. 29,83 € |
| ein Monat | 894,95 € |

Mit Umsatzsteuer sind es ca. 1,48 € pro Stunde; 20 € brutto reichen dann für ca. 13,50 Stunden.

**Folgerung:** Der einzige Schutz vor hohen Kosten ist, **nur zu festen Terminen zu buchen und die Instanz danach sofort zu löschen** (Erinnerung im Kalender setzen). Ein vergessener Server kostet pro Tag rund 30,00 €.

## Offene Punkte

- **RAM-Limit 8 GB:** Ob Whisper, TranslateGemma, Piper und der Server mit 8 GB Arbeitsspeicher beim Laden und im Betrieb auskommen, ist **unbekannt** (Messpunkt: erster Servertest). Das Limit kann der Support erhöhen.
- Startguthaben: warum 0,00 €, was fehlt (Steuer-ID, Gewerbenachweis)?
- Kostenlimit / Rechnungswarnung per E-Mail: gibt es das, wo wird es eingestellt?
- AVV: Abschluss und Unterauftragnehmer.
- RAM-Preis: 1,90 oder 0,97?
- Standort: Bestätigung, dass „Bamberg BBG1“ das Rechenzentrum Hallstadt ist.
- Hinweis: Das Konto wurde als Mitglied seit 12.11.2026 geführt; die Anmeldung muss laut AGB als Unternehmer erfolgen.

## Entwurf einer Anfrage an den centron-Support (nicht gesendet)

> Betreff: Fragen zu Startguthaben, Kostenlimit und Auftragsverarbeitung (ccloud³ Cloud GPU)
>
> Guten Tag,
> wir haben ein Konto bei cloud.centron.de angelegt und möchten eine GPU-Instanz (RTX 6000 Ada) für einzelne Termine nutzen. Dazu einige Fragen:
> 1. Auf centron.de/pricing wird ein Startguthaben von 200 € beworben. In unserem Konto steht 0,00 €. Welche Voraussetzungen fehlen (z. B. Steuer-ID, Gewerbenachweis), und wie bekommen wir es?
> 2. Gibt es ein Kostenlimit oder eine Rechnungswarnung per E-Mail ab einem Betrag? Wo wird das eingestellt?
> 3. Wie schließen wir den Auftragsverarbeitungsvertrag (Art. 28 DSGVO) ab? Welche Unterauftragnehmer sind eingesetzt?
> 4. Die Doku nennt für RAM 0,97 €, die Console 1,90 € pro GB und Monat. Welcher Preis gilt, und gilt er pro Monat?
> 5. Bestätigen Sie, dass die Region „Bamberg BBG1“ dem Rechenzentrum Hallstadt entspricht?
> 6. Unser Team-Limit ist 4 Kerne, 8 GB RAM, 400 GB Speicher, 1 GPU. Können wir bei Bedarf auf 16 GB RAM erhöhen?
> 7. Bitte bestätigen Sie, dass eine gelöschte Instanz ab dem Löschzeitpunkt nicht weiter berechnet wird.
>
> Vielen Dank und freundliche Grüße

## Nachtrag 12.11.2026: Antwort des centron-Supports (Ticket per E-Mail, Auszug sinngemäß)

1. **Startguthaben:** 200 € wurden im Konto hinterlegt, gültig 60 Tage oder bis zum Aufbrauchen. Warum es zuerst fehlte, nannte der Support nicht.
2. **Kostenlimit/Vorauszahlung:** Beides gibt es **nicht**. (Bestätigt: Kosten lassen sich nur durch Löschen der Instanz und Kontrolle begrenzen.)
3. **RAM-Preis (0,97 € oder 1,90 € pro GB):** nicht beantwortet; der Support verweist auf den Checkout beim Anlegen der VM (`cloud.centron.de/ccloud/checkout`). Der gültige Preis ist die Anzeige dort.
4. **Team-Limits:** auf unsere Bitte (16 GB RAM) „entsprechend erhöht“. Die neuen Zahlen sind **unbekannt** und in der Console zu prüfen.
5. **Testkontingent:** Das Startguthaben gilt als Testguthaben.

Folgerungen: Der Test (ca. 2 bis 4 Stunden, ca. 2,49 bis 5,00 € netto nach meiner Rechnung) wird laut Antwort aus dem Startguthaben gedeckt, sofern es für GPU-Instanzen gilt (nicht ausdrücklich bestätigt). Die Fragen zu Datenschutz/AVV und zur Region Hallstadt wurden in dieser Antwort nicht behandelt (sie gingen an eine andere Adresse bzw. sind zurückgestellt).

## Nachtrag 12.11.2026 (später): Prüfung in der Console durch das Browser-Plugin (nur gelesen)

- **Guthaben:** 200,00 €. Ein Ablaufdatum steht in der Console **nicht** (laut Support-Antwort gelten 60 Tage). Der Info-Text dort nennt es "dein Guthaben, das du auf dein Konto eingezahlt hast". Ob es für GPU-Instanzen gilt und netto oder brutto verrechnet wird: weiter unbekannt, im Billing nach dem Anlegen prüfen.
- **Team-Limits jetzt:** Kerne 20, RAM 80 GB, Speicher 2000 GB, GPUs 8 (alle 0 belegt). Das ist deutlich mehr als nötig; die Limits begrenzen also nicht mehr die Kosten. **Pro Test nur eine Instanz anlegen.**
- **SSH-Schlüssel** "kidolmetscher-test" ist gespeichert (Team Einstellungen > Tab Sicherheit > SSH Keys); Fingerprint stimmte mit dem lokalen Schlüssel überein. Ob er beim Erstellen einer VM auswählbar ist, wurde nicht geprüft.
- **2FA:** Ab 14.12.2026 Pflicht für die Anmeldung; aktuell deaktiviert. Vor diesem Datum einrichten (Entscheidung der Kontoinhaberin/des Kontoinhabers).

## Nachtrag 14.11.2026: Snapshots, Images, Löschen, API (Bericht des Browser-Plugins, nur gelesen; von mir nicht selbst geprüft)

- **Für GPU-VMs sind keine Snapshots möglich** (Console → Images → Snapshots: „Für Server mit GPU sind keine Snapshots möglich.“). Keine eigenen Images (nur per E-Mail an technik@centron.de). cBacks/cProtect sind nicht als Abbild zum Neuanlegen beschrieben. Die Doku widerspricht sich (Cloud GPU → Features sagt „wie ccloud³-VMs“). **Folgerung: Das „Golden Image“ mit fertigen Modellen entfällt; Neuanlegen läuft per Cloud-Init.** Nicht gefunden: ob ein Snapshot einer Nicht-GPU-VM eine GPU-VM starten kann.
- **Preise netto pro GB und Monat:** Snapshots 0,00 €, cBacks 0,00 €, cProtect 0,03 €, Disk 0,05 € (Doku-Seiten nennen nur „nutzungsbasiert“, widersprüchlich). Disks sind unabhängige Ressourcen, verschiebbar zwischen VMs im selben Rechenzentrum; **ob eine Disk das Zerstören der VM überlebt und an eine neue GPU-VM passt: nicht geprüft.** Nutzen wäre gering: Modell-Download dauerte gemessen nur ca. 2 Minuten.
- **Kein automatisches Löschen/keine Zeitschaltung für VMs** gefunden (ca. 520 Doku-Seiten durchsucht). Automatisch gelöscht wird nur bei 14 Tagen Zahlungsverzug.
- **API:** `DELETE /ccloud/servers/{hostname}` (docs.centron.de/api, OAuth2 Client Credentials, Antwort Task-ID). **Ein eingeschränkter Schlüssel „nur Löschen“ wurde nicht gefunden**; jeder Token hat die Rolle Member mit vollem Zugriff auf Team-Ressourcen (kein Billing). Kein Token angelegt. Folgerung: Löschen weiter von Hand, Erinnerung im Kalender.
- **„Rechnungswarnungen“** (E-Mail bei selbst gesetztem Betrag) laut Preisseite-FAQ: in Console/Doku nicht gefunden.
- **Zerstören:** Das Bestätigungsfenster verlangt laut Doku den **VM-Namen `kidolmetscher-test`** (nicht die Server-ID xv20213). Zerstören löscht alle zugehörigen Backups unwiederbringlich.


# ===== Datei: docs/server-test-ablauf.md =====

# Server-Test: Ablauf von A bis Z (Stand 12.11.2026)

Ziel: Einmal mit echten Modellen auf dem GPU-Server testen, wie Übersetzung, Stimme und Verzögerung wirklich sind.
**Nichts davon ist bisher auf einer GPU gelaufen.** Der erste Lauf kann an Treiber- oder Bibliotheksfragen scheitern (siehe „Fehlersuche“); dafür gibt es eine schnelle Prüfung, bevor es teuer wird.
Der Datenschutz-Teil (AVV, Unterauftragnehmer, rechtliche Prüfung) ist bewusst auf später verschoben. **Für den Test nur erfundene Texte sprechen**, keine echten Inhalte.

## Wie der Zugriff funktioniert (einfach und ohne Domain)

Der Server lauscht nur auf sich selbst (`127.0.0.1`). Von Ihrem Windows-Rechner aus verbinden Sie sich per **SSH-Tunnel**. Dann öffnen Sie im Browser `http://localhost:8000`, und das Mikrofon funktioniert (localhost gilt als sicher). Es muss kein Port am Server geöffnet werden und es wird keine Domain gebraucht. Für Tablets und Chromebook im Saal braucht es später doch eine Adresse mit HTTPS.

## Kosten (netto, Schätzung, Zeiten unbekannt)

Konfiguration 4 vCPU / 8 GB RAM / 300 GB Speicher mit RTX 6000 Ada: ca. 1,24 € pro Stunde (Console); mit 16 GB RAM etwas mehr (Aufschlag laut Console-Preis ca. 0,02 € pro Stunde, meine Rechnung, im Checkout prüfen).
**Stand 12.11.2026 (Antwort des centron-Supports):** 200 € Startguthaben sind im Konto hinterlegt, gültig 60 Tage oder bis zum Aufbrauchen. Ein Kostenlimit und eine Vorauszahlung gibt es **nicht**. Das Team-Limit wurde „entsprechend erhöht“ (neue Werte: unbekannt, im Console-Bereich Team-Einstellungen > Limits nachsehen). Ob das Guthaben netto oder brutto verrechnet wird, ist unbekannt. Rechnung: Bei ca. 1,24 € pro Stunde reicht das Guthaben für rund 160 Stunden; eine **vergessene Instanz** verbraucht es in etwa 6,70 Tagen, danach wird der Rest abgebucht. Einrichtung (Pakete und Modelle laden, ca. 35 GB) plus Test: **Dauer unbekannt**, grob 2 bis 3 Stunden, also etwa 2,49 bis 3,73 € netto. Die Instanz kostet, solange sie existiert; danach **löschen**. Ein vergessener Server kostet ca. 30 € pro Tag. Kalender-Erinnerung setzen.

## Vorher erledigen (ohne Kosten)

1. **Hugging-Face-Freigabe für TranslateGemma** (`google/translategemma-12b-it`): Konto, Gemma-Bedingungen akzeptieren, Freigabe abwarten (Dauer unbekannt). Prompt B unten. Das Zugriffs-Token erzeugen Sie selbst in den Konto-Einstellungen (Typ „Read“), und es kommt **nur** als Umgebungsvariable `HF_TOKEN` auf den Server, nie in Chat oder Dateien.
2. **SSH-Schlüssel** auf dem Windows-Rechner (Eingabeaufforderung): `ssh-keygen -t ed25519` (Enter drücken), dann `type %USERPROFILE%\.ssh\id_ed25519.pub`. Der öffentliche Schlüssel (eine Zeile) ist nicht geheim und kommt in Prompt A. Die Datei ohne `.pub` ist privat: niemals weitergeben.
3. ~~Antworten von centron abwarten~~ Erledigt am 12.11.2026: Startguthaben da, RAM-Limit erhöht (Wert prüfen). Die Frage nach dem RAM-Preis wurde nicht beantwortet (Verweis auf den Checkout); Prompt A liest die aktuellen Preise aus.

## Schritt 1: Instanz anlegen (Prompt A, Sie bestätigen vor dem Klick)

## Schritt 2: Auf dem Server einrichten

Auf Ihrem Windows-Rechner in der Eingabeaufforderung (IP und Benutzer stehen nach dem Anlegen in der Console):

```
ssh <benutzer>@<server-adresse>
```

Auf dem Server:

```
git clone --branch ccr-4bf88cb4-flgtez https://github.com/justusroman123/nachhaltigkeit.git ~/kidolmetscher/src
HF_TOKEN=<token> bash ~/kidolmetscher/src/kidolmetscher/scripts/server_setup.sh
```

Das Skript legt alles unter `~/kidolmetscher` an, lädt Pakete und Modelle, erzeugt einen **Bedienschlüssel** in `~/kidolmetscher/server.env` und prüft am Ende die GPU. Ohne `HF_TOKEN` wird TranslateGemma nicht geladen (später mit Token wiederholen; Fertiges wird übersprungen). **Der GPU-Prüfung am Ende zuerst schauen**: Steht dort „GPU nutzbar“, geht es weiter. Sonst Abschnitt „Fehlersuche“ (die Prüfung kostet nur Minuten, deshalb steht sie vor dem Test).

## Schritt 3: Starten und im Browser öffnen

Auf dem Server:

```
bash ~/kidolmetscher/src/kidolmetscher/scripts/server_ctl.sh start
```

Das Laden der großen Modelle dauert (Dauer unbekannt, `tail -f ~/kidolmetscher/server.log`; bereit bei „Application startup complete“). Der Bedienschlüssel wird beim Start angezeigt.

Zweites Eingabeaufforderungs-Fenster auf Ihrem Windows-Rechner (offen lassen):

```
ssh -L 8000:127.0.0.1:8000 <benutzer>@<server-adresse>
```

Im Browser `http://localhost:8000` öffnen, Bedienschlüssel eingeben, Sitzung starten. Wie die Oberfläche bedient wird: `docs/vorfuehrung.md`. **Zuhörer** im zweiten Browserfenster öffnen (Link aus dem Bedienplatz) **mit Kopfhörern**, sonst hört das Mikrofon die Ausgabe.

## Schritt 4: Testen und messen

- Erfundene deutsche Sätze sprechen (z. B. `tests/audio/testsaetze.txt`), Ukrainisch und Englisch mit Ton, Arabisch und Türkisch nur Untertitel (dafür gibt es noch keine freie Stimme).
- **Qualitätslauf (wichtigster Schritt für die Qualität):** Ein Aufruf übersetzt 12 erfundene Sätze in alle Sprachen, erzeugt den Ton (wo eine Stimme da ist) und schreibt einen Bewertungsbogen zum Anhören und Ausfüllen:
  `cd ~/kidolmetscher/src/kidolmetscher && set -a && . ~/kidolmetscher/server.env && set +a && ~/kidolmetscher/.venv/bin/python scripts/quality_run.py --modes structured,plain --out ~/kidolmetscher/qualitaetslauf`
  (`--modes` stellt zwei Prompt-Formate nebeneinander: `structured` ist das offizielle Format laut Modellkarte, `plain` der Plan-Prompt als Text. Fehlerzeilen im Bogen zeigen, ob ein Sprachcode abgelehnt wurde.) Den Ordner `qualitaetslauf` mit `scp -r` auf den eigenen Rechner kopieren, `bewertungsbogen.html` öffnen und von Muttersprachlern bewerten lassen. Ohne den Server-Prozess zu stoppen geht das nicht gleichzeitig mit großen Modellen im VRAM: vorher `server_ctl.sh stop`.
- Arabisch/Türkisch-Ton ausprobieren: `docs/tts-kandidaten-ar-tr.md` und `scripts/tts_candidate_try.py` (nicht getestet).
- Verzögerung ablesen: Der Server schreibt je Satz eine Zeile mit `asr_ms`, `mt_ms`, `tts_ms`, `gesamt_ms` (keine Inhalte): `tail -n 20 ~/kidolmetscher/server.log`. Zielwert laut Plan: 3 bis 5 Sekunden insgesamt.
- Messskripte (schreiben ins Messprotokoll): im Ordner `kidolmetscher/server` mit `source ~/kidolmetscher/server.env` und `~/kidolmetscher/.venv/bin/python ../scripts/bench_mt.py --write` usw. (`bench_asr.py` braucht Testaudio, siehe `scripts/make_placeholder_audio.py`).
- Qualität: ukrainische und englische Stimme anhören, Bewertungsbogen `docs/bewertungsbogen.md`. Übersetzungsqualität für uk, ar, tr von jemandem prüfen lassen, der die Sprache kann.
- Merken: Pausen-Schwellen der Spracherkennung (`ASR_SILENCE_MS`, `ASR_VAD_RMS`) sind Annahmen und lassen sich in `~/kidolmetscher/server.env` ändern (danach `stop` und `start`).

## Schritt 5: Beenden (wichtig)

Auf dem Server `server_ctl.sh stop`, dann in der Console die **Instanz löschen** (Prompt C), Kosten im Bereich Billing prüfen.

## Einfachster Weg: alles automatisch beim Anlegen (Cloud-Init, NICHT GETESTET)

Ziel: Nach dem Anlegen der VM muss nichts am Terminal getippt werden, und **Chromebook und Tablets** erreichen die Anwendung über eine HTTPS-Adresse im Browser (ein SSH-Tunnel geht nur am Windows-PC und für Tablets gar nicht).

**Einmal vorbereiten:** `scripts/cloud-init-gpu.sh` öffnen. Oben im Block „EINSTELLUNGEN“ eintragen (nur in Ihrer lokalen Kopie, **nie ins Repository oder in den Chat**):
- `HF_TOKEN`: Hugging-Face-Lesetoken für TranslateGemma.
- `MT_REPO`: 12B oder `google/translategemma-4b-it`.
- `OPERATOR_KEY`: Ihr Bedienschlüssel (nur Buchstaben und Ziffern, mindestens 24 Zeichen, z. B. aus einem Passwort-Manager). So kennen Sie ihn schon und brauchen die VM dafür nicht.
- `DOMAIN`: Adresse, z. B. `dolmetscher.beispiel.de`. Der DNS-Eintrag (A) muss vor dem Start auf die IP der VM zeigen. Leer = Ersatzadresse `<ip>.sslip.io` (fremder DNS-Dienst, Zertifikat-Limits möglich, ungeprüft).
- `QUALITAETSLAUF`: 1 = einmal alle Sprachen durchrechnen.

**Ablauf pro Termin:**
1. Prompt A2 ans Plugin (jetzt mit den Ports 22, 80, 443). In „Erweiterte Optionen“ den Inhalt des Skripts bei „Cloud-Init Initialisierungsskripte“ einfügen; „VM erstellen“.
2. IP-Adresse notieren und, falls eine eigene `DOMAIN` verwendet wird, den DNS-Eintrag setzen (bei jeder neuen VM ändert sich die IP; eine **reservierte IP** könnte das lösen: Prompt D unten, Kosten und Zuordnung unbekannt).
3. Warten (Dauer unbekannt, geschätzt 15 bis 60 Minuten: Downloads, Treiber, Neustart). Die VM kostet währenddessen.
4. **Chromebook:** Chrome, `https://<ihre-adresse>/` öffnen, Bedienschlüssel eingeben, Mikrofon erlauben. **Tablets:** Links/QR-Codes aus dem Bedienplatz.
5. Bewertungsbogen (nur am Windows-PC): Doppelklick `windows/hole-bewertungsbogen.bat`. Am Chromebook ist das nicht vorbereitet.
6. Danach Prompt C (VM zerstören) und Token auf Hugging Face widerrufen.

**Was das Skript macht:** Pakete und Code laden, Whisper, Stimmen und TranslateGemma laden, Caddy als HTTPS-Proxy mit automatischem Zertifikat einrichten, den Dienst `kidolmetscher` einrichten (startet beim Hochfahren, hört nur auf `127.0.0.1`, von außen nur über Caddy), GPU-Treiber installieren, Token- und Schlüssel-Reste aus den Cloud-Init-Daten löschen, neu starten. Nach dem Neustart läuft vor dem ersten Start einmal der Qualitätslauf (Ergebnis nur auf der VM), dann startet die Anwendung.

**Sicherheit (wichtig):** Die Adresse ist öffentlich erreichbar. Geschützt ist der Bedienplatz nur durch den Schlüssel (**kein Schutz gegen automatisches Raten**, siehe `docs/datenschutz-nachweis.md`), Zuhörer nur durch zufällige Links mit Ablauf. Deshalb: langer Schlüssel (mind. 24 Zeichen), VM nur für die Dauer des Termins, danach zerstören. Das Zertifikat macht den Hostnamen in öffentlichen Zertifikatsprotokollen sichtbar (keine Gesprächsdaten).

**Kontrolle bei Problemen:** per SSH (nur am Windows-PC) `tail /var/log/kidolmetscher-init.log`, `/root/kidolmetscher/INIT_FERTIG` vorhanden?, `systemctl status kidolmetscher caddy`, `nvidia-smi`. Ungeprüft: ob das Feld dieses Format annimmt, ob `caddy` und der Treiber im Skript durchlaufen, ob Let's Encrypt für die Adresse klappt, die `.bat`-Dateien. Das Skript steht öffentlich im Repository und enthält dort **kein** Token und keinen Schlüssel.

**Prompt D (reservierte IP prüfen, nur lesen):**
```
Ich bin bei https://cloud.centron.de eingeloggt. Nur lesen, nichts anlegen oder ändern.
Menü Network -> Reservierte IPs (und die Doku dazu): Kann ich eine feste öffentliche IPv4-Adresse reservieren und sie
nach dem Zerstören einer VM an eine neue VM zuweisen? Was kostet sie pro Monat (zwei Nachkommastellen, netto/brutto),
auch solange sie keiner VM zugewiesen ist? Wie viele sind in meinem Konto erlaubt? Nenne die Fundstelle.
Was du nicht findest: "nicht gefunden".
```

## Fehlersuche

| Meldung / Problem | Wahrscheinliche Ursache | Was tun |
| --- | --- | --- |
| `nvidia-smi nicht gefunden` | Image ohne GPU-Treiber | Anderes Image mit NVIDIA-Treiber wählen oder Treiber installieren (Anbieter-Doku; ob vorhanden: unbekannt) |
| PyTorch: „CUDA verfügbar: False“ trotz `nvidia-smi` | PyTorch-Build passt nicht zum Treiber | Passenden PyTorch-Build für die Treiberversion installieren (`pip install torch --index-url <passender-index>`), Version laut `nvidia-smi` |
| CTranslate2: `libcublas.so.12` / `libcudnn` nicht gefunden | Bibliotheken fehlen für die Spracherkennung | `pip install nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"` und `LD_LIBRARY_PATH` auf die Ordner setzen (Anleitung der faster-whisper-Projektseite); seit 13.11. in `requirements-asr.txt` und `server_setup.sh` (Suchpfad in `server.env`); trat im ersten Test auf, Wirkung des Fixes: noch ungetestet |
| `Out of memory` beim Laden | VRAM oder RAM zu klein | `nvidia-smi` prüfen; RAM-Limit beim Support erhöhen lassen |
| TranslateGemma: 401 / 403 | Freigabe fehlt oder Token falsch | Freigabe auf Hugging Face prüfen, `HF_TOKEN` neu setzen |
| Übersetzung bricht mit Fehler beim Template ab | Sprachcode wird vom Modell nicht unterstützt oder anders geschrieben | In `server.env` `MT_LANG_CODES=ar=ar-SA,uk=uk-UA` setzen (Schreibweise mit Land, siehe `docs/translategemma-modellkarte.md`), danach `stop` und `start` |
| Übersetzung wirkt falsch oder gibt Zusatztext aus | Prompt-Format | `MT_PROMPT_MODE=plain` ausprobieren und im Qualitätslauf vergleichen |
| Browser: Mikrofon nicht verfügbar | Adresse nicht `localhost` | Über den SSH-Tunnel `http://localhost:8000` öffnen |
| Port 8000 belegt | alter Tunnel/Prozess | Fenster schließen, anderen lokalen Port nehmen: `ssh -L 8001:127.0.0.1:8000 ...` |

## Prompts für das Browser-Plugin (Claude)

Das Plugin arbeitet in Ihrem eingeloggten Browser. Es soll **nie** auf „Erstellen“, „Bestellen“, „Akzeptieren“ oder „Löschen“ klicken, ohne vorher bei Ihnen nachzufragen.

### Prompt A: Instanz vorbereiten (stoppt vor dem Erstellen)

```
Ich bin bei https://cloud.centron.de eingeloggt (ccloud³ Console).
Aufgabe: Eine GPU-Instanz für einen Test VORBEREITEN, aber NICHT erstellen.
Klicke NICHT auf "VM erstellen" oder Ähnliches. Gib keine Zahlungsdaten ein.

0. Vorab nur lesen: Wie hoch ist das Guthaben (Billing)? Wie lange gilt es? Wie lauten jetzt die Team-Limits
   (Avatar oben rechts -> Team Einstellungen -> Tab "Team" -> "Limits")? Nenne mir die Zahlen.

1. SSH-Schlüssel: Gibt es in der Console einen Bereich für SSH-Schlüssel? Wenn ja, lege dort einen
   Schlüssel mit dem Namen "kidolmetscher-test" an und füge diesen öffentlichen Schlüssel ein:
   <HIER DIE EINE ZEILE AUS id_ed25519.pub EINFÜGEN>
   (Das ist ein öffentlicher Schlüssel, nicht geheim. Nach dem Speichern bitte kurz melden.)
2. Öffne ccloud³ -> "Virtuelle Maschine erstellen" -> "Cloud GPU" -> "GPU wählen" und stelle ein:
   - GPU: NVIDIA RTX 6000 ADA 48GB
   - Region: Bamberg (BBG1)
   - vCPU 4, RAM 16 GB (falls das erhöhte Limit es erlaubt, sonst 8 GB), Speicher 300 GB
   - Name: kidolmetscher-test
   - Betriebssystem/Image: das neueste Ubuntu LTS, am liebsten eine Variante mit NVIDIA-Treiber/CUDA,
     falls angeboten. Liste mir ALLE angebotenen Images, die du siehst.
   - SSH-Schlüssel: "kidolmetscher-test" auswählen (kein Passwort-Login, falls wählbar)
   - Firewall/Netzwerk: nur Port 22 (SSH), 80 und 443 (HTTPS) von außen erlaubt, falls einstellbar; keine weiteren Ports freigeben.
3. Berichte mir, was die Console jetzt anzeigt: Gesamtpreis pro Stunde und pro Monat, Preis je Posten,
   ob netto oder brutto, gewähltes Image, Region, Firewall-Einstellung, und ob irgendeine Kostenwarnung oder
   ein Limit angezeigt wird. Rate nichts: Was du nicht siehst, schreibst du als "nicht gefunden".
4. Dann STOPP. Frage mich, ob ich "VM erstellen" klicken soll. Erst nach meiner ausdrücklichen Bestätigung klicken.
   Nach dem Erstellen: Nenne mir die öffentliche IP-Adresse, den Benutzernamen für SSH und den Status.
```

### Prompt B: Hugging-Face-Freigabe für TranslateGemma

```
Ich bin bei https://huggingface.co eingeloggt.
Aufgabe: Zugang zum Modell "google/translategemma-12b-it" beantragen.

1. Öffne https://huggingface.co/google/translategemma-12b-it und lies, was die Seite für den Zugriff verlangt.
2. Fasse mir in Stichworten zusammen, welche Bedingungen ich akzeptieren soll und welche Angaben verlangt werden.
   Zitiere nichts Langes, nenne die Kernpunkte (z. B. Nutzungseinschränkungen, kommerzielle Nutzung, Weitergabe).
3. STOPP. Frage mich, ob ich zustimmen will. Klicke erst nach meiner ausdrücklichen Bestätigung auf die Schaltfläche
   zum Akzeptieren / Zugang anfordern. Erfinde keine Angaben für mich.
4. Danach: Zeige den Status ("Freigabe ausstehend" oder "freigegeben"). Falls die Modellkarte sichtbar wird, nenne
   mir bitte: unterstützte Sprachen (steht Ukrainisch, Arabisch, Türkisch, Persisch dabei?) und das Prompt-/Chat-Format,
   das die Karte empfiehlt (wörtlich den Beispielaufruf, falls vorhanden).
Erzeuge KEIN Zugriffs-Token und zeige keines an. Das mache ich selbst.
```

### Prompt C: Nach dem Test aufräumen

```
Ich bin bei https://cloud.centron.de eingeloggt (ccloud³ Console).
Aufgabe: Die Test-Instanz "kidolmetscher-test" beenden und die Kosten prüfen.

1. Zeige mir die Instanzliste mit Status.
2. STOPP. Frage mich, ob ich die Instanz "kidolmetscher-test" wirklich LÖSCHEN will (nicht nur anhalten: gestoppte
   Instanzen werden weiter berechnet). Erst nach meiner ausdrücklichen Bestätigung löschen.
3. Danach prüfe im Bereich Billing: Verbrauch seit Kontoerstellung, "Vorauss. Verbrauch", Guthaben, laufende Posten.
   Gibt es noch eine laufende Instanz, einen Speicher oder eine IP-Adresse, die weiter berechnet wird? Nenne Zahlen
   mit zwei Nachkommastellen und ob netto oder brutto. Was du nicht findest: "nicht gefunden".
```

### Prompt A3: günstige Variante (RTX A4000, 4B-Modell), Preise lesen, stoppt vor dem Erstellen (Stand 14.11.2026)

Vorher: Starter `scripts/cloud-init-launcher.sh` **lokal** ausfüllen (Token, Bedienschlüssel; `MT_REPO=google/translategemma-4b-it`, `DEFAULT_LANGS=uk`). Das Feld „Cloud-Init“ füllen **Sie** selbst aus (Plugin gibt keine Geheimnisse ein).

```
Ich bin bei https://cloud.centron.de eingeloggt. Lies nur, bestelle nichts. Klicke NIE auf "VM erstellen", Akzeptieren oder Löschen ohne meine ausdrückliche Bestätigung. Gib keine Schlüssel oder Token ein oder aus.
Teil 1 (nur lesen, Wizard "Virtuelle Maschine erstellen" -> Cloud GPU, ohne zu erstellen):
1. Alle wählbaren GPU-Typen mit VRAM, Preis pro Stunde und pro Monat (netto, zwei Nachkommastellen), und ob "belegt" oder verfügbar.
2. Gesamtpreis pro Stunde (netto) für RTX A4000 mit 4 vCPU, 16 GB RAM, 100 GB Speicher, und für Quadro RTX 6000 24 GB gleich konfiguriert. Mindestwerte je GPU?
3. Weitere/günstigere GPUs (L4, L40S, RTX 4000 Ada, A10)? Verfügbar?
4. Network -> Reservierte IPs: Kann ich eine feste IPv4 reservieren und nach dem Zerstören einer VM neu zuweisen? Preis pro Monat auch ohne Zuweisung?
Teil 2 (vorbereiten): Stelle ein: GPU RTX A4000 16 GB, Region Bamberg BBG1, 4 vCPU, 16 GB RAM, 100 GB Speicher, Name kidolmetscher-test, neuestes Ubuntu LTS, SSH-Schlüssel "kidolmetscher-test", Firewall nur 22, 80, 443 falls einstellbar. Das Feld "Cloud-Init" lasse leer, das fülle ich selbst. Berichte den angezeigten Gesamtpreis pro Stunde (netto/brutto) und was angezeigt wird. Dann STOPP und frage mich.
Was du nicht findest: "nicht gefunden". Nichts schätzen.
```

Nach dem Erstellen: IP notieren, bei eigener `DOMAIN` den DNS-Eintrag setzen. Ablauf und Messpunkte siehe Protokoll Abschnitt 15.


# ===== Datei: docs/translategemma-modellkarte.md =====

# TranslateGemma 12B: Angaben aus der Modellkarte (Stand 12.11.2026)

Quelle: Bericht des Browser-Plugins aus dem eingeloggten Hugging-Face-Konto (Zugriff erteilt, Karte gelesen, **von mir nicht selbst geprüft**; für mich bleibt die Seite gesperrt). Modell: `google/translategemma-12b-it`, Lizenz „gemma“.

| Punkt | Angabe |
| --- | --- |
| Sprachen | „55 languages“; **keine Liste** in der Karte. Ukrainisch, Arabisch, Türkisch, Persisch stehen dort nicht ausdrücklich. Laut Technical Report (Tabelle 4, Paare Englisch zu X) kommen vor: `uk_UA`, `ar_EG`, `ar_SA`, `tr_TR`, `fa_IR`, `de_DE`. |
| Sprachcodes | ISO 639-1 (z. B. `en`) oder mit Land (`en_US`, `en-GB`). Beispiele der Karte: Quelle `cs`, Ziel `de-DE`. Ein nicht unterstützter Code löst beim Anwenden der Chat-Vorlage einen Fehler aus. |
| Nachrichtenformat | Liste mit einer Nachricht, `role` = user, `content` = Liste mit **einem** Eintrag: `type`=text, `source_lang_code`, `target_lang_code`, `text`. (Bei Bildern: `type`=image, `url`.) |
| Laden (Beispiel der Karte) | `AutoProcessor` und `AutoModelForImageTextToText`, `device_map="auto"`; `processor.apply_chat_template(tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt")`; `generate(do_sample=False)`; nur Tokens nach der Eingabelänge dekodieren. Alternativ `pipeline("image-text-to-text")`. |
| Speicher | Gewichte ca. 24,4 GB (5 Safetensors-Dateien, BF16). Hardware-Angaben für den Betrieb stehen nicht in der Karte (nur Trainings-Hardware). Quantisierung: nicht gefunden. |
| Kontext | 2K Tokens gesamt (Eingabe Text oder Bild 896x896, je 256 Tokens) |
| Qualität | Nur Durchschnitte: WMT24++ (55 Sprachen) MetricX 3,60 und Comet 83,5; WMT25 (10 Sprachen) MQM 7,94. **Qualität je Sprache: nicht angegeben.** |
| Einschränkungen laut Karte | Bias/Lücken in Daten möglich; besser bei klaren Prompts; Nuancen, Sarkasmus, Bildsprache schwierig; keine Wissensbasis; Common-Sense-Lücken; andere Aufgaben (z. B. Post-Editing) nicht offiziell unterstützt; getestet ohne Safety-Filter, eigene Schutzmaßnahmen empfohlen. |
| Bedingungen | Lizenz „gemma“, Gemma-Nutzungsbedingungen und Prohibited Use Policy; Pflichten bei gehostetem Dienst siehe `docs/lizenzen-recherche.md`. |

## Folgen für die Anwendung

- Der Übersetzer nutzt jetzt standardmäßig dieses Format (`MT_PROMPT_MODE=structured`). Der Plan-Prompt als Text bleibt zum Vergleich (`plain`).
- Sprachcodes: Standard sind unsere Kürzel (`uk`, `ar`, `tr`, `fa`, `en`, `de`). Falls das Modell einen ablehnt: `MT_LANG_CODES=ar=ar-SA,uk=uk-UA` usw.
- Beim ersten Servertest zuerst `scripts/quality_run.py` mit allen vier Sprachen laufen lassen: Fehlerzeilen zeigen abgelehnte Codes, der Bewertungsbogen die Qualität.
- Speicherbedarf: ca. 24,4 GB Gewichte plus Whisper large-v3 (ca. 3 GB in float16, Schätzung) passen rechnerisch in 48 GB VRAM; gemessen ist das nicht.

## Nachtrag 14.11.2026: Freigabe, Größen, Codes (Bericht des Browser-Plugins aus dem eingeloggten Hugging-Face-Konto, nur gelesen; von mir nicht selbst geprüft)

| Modell | Zugriff | Dateien gesamt (main) |
| --- | --- | --- |
| google/translategemma-4b-it | erteilt | 8,64 GB (15 Dateien) |
| google/translategemma-12b-it | erteilt | 24,41 GB (18 Dateien) |
| google/translategemma-27b-it | erteilt | 54,90 GB (25 Dateien) |

- **27B passt in BF16 nicht auf die 48 GB der Ada** (54,90 GB Gewichte); nur quantisiert, Qualität/Aufwand unbekannt.
- Die Modellkarte nennt **keine der vier Sprachen einzeln** („55 languages“, keine Liste). Das `chat_template.jinja` akzeptiert u. a. `uk`/`uk-UA`, `ar`/`ar-EG`/`ar-SA`, `tr`/`tr-TR`, `fa`/`fa-IR`; „akzeptiert“ heißt nicht „Qualität geprüft“.
- **Quantisierungen:** keine offiziellen von Google; nur Community-Varianten (GGUF, MLX 4-bit u. a.), nicht geprüft.
- **4B-Variante:** Repository-Name `google/translategemma-4b-it` bestätigt. Setup: `MT_REPO=google/translategemma-4b-it` im Cloud-Init-Starter. Speicher: 8,64 GB Gewichte + Whisper ca. 4,2 GB (gemessen) = ca. 12,9 GB von 16 GB der A4000; **Reserve für Zwischenwerte: unbekannt, messen**.


# ===== Datei: docs/endgeraete-recherche.md =====

# Endgeräte für Bedienplatz und Zuhörer (Recherche vom 14.11.2026)

Auslöser: Wunsch, drei Geräte zu haben (eines zum Sprechen, zwei zum Zeigen der Übersetzung), möglichst „super sicher“. Quellen: Websuche, **von mir nicht tiefer geprüft**; vieles sind Herstellermeldungen.

## Vorab: was „datenschutzkonform“ bei Geräten heißt
- **Kein Gerät ist für sich „datenschutzkonform“.** Entscheidend ist, wohin Sprache und Text fließen. Bei uns läuft die Übersetzung **auf dem Server**, nicht auf den Geräten. Die Modelle brauchen eine GPU mit 16 bis 48 GB; ein Tablet kann das **nicht**.
- Die Seite speichert nichts (keine Cookies, kein Tracking, Zuhörer-Links mit Ablauf). Auf dem Tablet liegt höchstens Text im Arbeitsspeicher des Browsers. Das Gerät ist hier **Bildschirm und Lautsprecher/Mikrofon**.
- Wichtiger als die Marke sind daher: **frisches Browserprofil oder privater Tab, kein Konto angemeldet, Geräteverschlüsselung und Sperrcode, Updates aktuell, Kiosk-Modus** (iPad: „Geführter Zugriff“; Android: Kiosk/App-Pinning; Chromebook: verwaltetes Kiosk).
- Echte Offline-Lösung (alles lokal, keine Cloud): nur mit einem **eigenen GPU-Rechner vor Ort** (Gehäuse mit 16-GB-GPU oder mehr). Kosten und Aufwand: **unbekannt**, nicht recherchiert. Wäre ein Folgeprojekt, falls Kunden „keine Cloud“ verlangen.

## Kandidaten (Stand der Suche)
| Gerät | Befund laut Suche | Offen |
| --- | --- | --- |
| **iPad (iPadOS)** | BSI hat iPhone/iPad im Oktober 2022 für VS-NfD im Behördeneinsatz freigegeben, mit Auflagen (Presse: ifun.de, channelpartner.de). Anbieter ist US-Firma; für Safari-Nutzung ohne Konto ohne Belang für unseren Datenpfad. | Aktuelle BSI-Lage 2026, Preis, Safari-Verhalten bei WebSocket/Ton (Ton erst nach Tippen): **ungetestet** |
| **Samsung Galaxy Tab mit Knox** | BSI-Konfigurationsempfehlung (2017) und Zulassung für „Knox Native“ (Presse 11/2023). | Welche Modelle aktuell zugelassen: **unbekannt** |
| **Google Pixel Tablet mit GrapheneOS** | Laut GrapheneOS-Seiten offiziell unterstützt; Sicherheitsupdates laut Forum bis Juni 2028 (**Forenangabe, nicht geprüft**). Aufwand: Installation selbst, kein Herstellersupport. | Chrome/Vanadium-Browser mit unserer Seite: **ungetestet** |
| **ASUS Chromebook Plus CX34** (vorhanden) | Als **Bedienplatz** vorgesehen (Mikrofon über Chrome). | Ton/Mikrofon mit HTTPS-Adresse: **ungetestet** |

## Empfehlung (vorläufig, ohne Test)
1. **Bedienplatz (Master):** das vorhandene Chromebook, Mikrofon wie bisher. Kein neuer Kauf nötig.
2. **Zuhörer (2 Geräte):** Tablets reichen als Anzeige. **Vor einem Kauf mit vorhandenen Geräten (Handy, Windows-PC) testen**, ob Untertitel und Ton über die HTTPS-Adresse laufen. Erst danach entscheiden, welche Tablets (Preis: unbekannt, nicht recherchiert).
3. Wenn gekauft wird: iPad (einfachste Verwaltung, Geführter Zugriff) **oder** Pixel Tablet mit GrapheneOS (mehr Kontrolle, mehr Aufwand). Auswahl nach Kundenanforderung klären (Behörden fragen oft nach BSI-Bezug).

## Folgeaufgaben
- Recherche Preise und Verfügbarkeit (Händler), BSI-Seiten im Original lesen.
- Test auf iPad/iPadOS-Safari: Mikrofon (nur Bedienplatz), Ton nach Tippen, Bildschirm bleibt an (Wake Lock).


# ===== Datei: docs/kosten.md =====

# Kosten und Budget (Stand 11.11.2026)

**Preise stammen aus dem Plan (Listenpreise). Die centron-Angaben habe ich am 11.11.2026 auf www.centron.de gegengelesen (siehe Abschnitt „Gegenlesen“), STACKIT nicht. Nichts bestellt.**

| Posten | Preis laut Plan | Hinweis |
| --- | --- | --- |
| Mikrofon, Chromebook, Tablets | 0 € | vorhanden bzw. geliehen |
| GPU-Server centron, RTX 6000 Ada 48 GB | 1,19 € pro Stunde netto | stündliche Abrechnung; Zuschläge für CPU, RAM, Speicher; Kosten pausierter Server: **unklar** (Seite widerspricht sich laut Plan) |
| Server-Test, 2 Stunden | 2,38 € | 2 × 1,19 € |
| Server-Demo, 20 Stunden | 23,80 € bis ca. 26 € | oberer Wert: Annahme des Plans für Zuschläge (ca. 0,11 € pro Stunde) |
| Alternative STACKIT L40S 48 GB | 1,74 € pro Stunde (20 h = 34,80 €) | C5/AVV nicht geprüft |
| Domain und Zertifikat | offen | nicht recherchiert; Zertifikat über Caddy laut Konzept ohne eigene Kosten (Annahme) |
| Optional Router GL.iNet Mudi V2 | 145,11 € inkl. MwSt | nur falls Handy-Hotspot nicht reicht; SIM-Tarif nicht geprüft |
| Optional Kopfhörer Sony WH-CH530 | 39,99 € pro Stück | Preis laut Testberichte.de, Shop nicht genannt |

## Budget 50 € (Vorschlag des Plans) in Stunden

Rechnung aus den Planwerten, **nicht von centron bestätigt**:

- ohne Zuschläge: 50 € ÷ 1,19 € = rund **42 Stunden** netto
- mit der Zuschlags-Annahme des Plans (1,19 € + 0,11 € = 1,30 €): 50 € ÷ 1,30 € = rund **38 Stunden**

Der Bedienplatz zeigt die Laufzeit der Anwendung und (wenn `SERVER_HOURLY_EUR` und `BUDGET_EUR` gesetzt sind) die geschätzten Kosten mit Warnung ab 80 %.
Das ist **nicht** die Laufzeit der gemieteten Maschine. Server nach jeder Sitzung beenden oder pausieren.

## Fragen an centron (vorbereitet, nicht versendet)

1. Auftragsverarbeitungsvertrag nach Art. 28 DSGVO: wie und wo abschließbar?
2. Kosten eines pausierten bzw. gestoppten Servers (GPU-Instanz)?
3. Gesamtpreis der Konfiguration RTX 6000 Ada mit 8 vCPU / 32 GB RAM / 100 GB Speicher pro Stunde und pro Monat?
4. Standort des Rechenzentrums (Hallstadt?) bestätigen; Sitz der Muttergesellschaft?
5. Zertifizierungen (C5, ISO 27001) für die GPU-Instanzen?
6. Welche Firewall ist dem Server vorgelagert; wird der Datenverkehr protokolliert und wie lange (Snapshots, Logs)?
7. Welche CUDA-/Treiberversion hat das Standard-Image (bestimmt das Basis-Image für Docker)?

## Gegenlesen der centron-Angaben (11.11.2026, www.centron.de, nur gelesen)

- **Preis bestätigt:** RTX 6000 Ada 48 GB: 1,1919 € pro Stunde netto (Plan: 1,19 €); 858,19 € pro Monat bei Dauerbetrieb. Alle Preise netto.
- **Zuschläge bestätigt, Höhe unbekannt:** vCPU, RAM und NVMe-Speicher kommen zu den ccloud³-Ressourcenpreisen hinzu; diese Preise habe ich nicht gelesen.
- **Wichtig für das Budget: pausiert/gestoppt kostet laut Seite weiter.** Wörtlich sinngemäß: Gebühren fallen an, solange die Instanz existiert, auch wenn sie gestoppt ist; abgerechnet wird jede angefangene Stunde von der Erstellung bis zum Löschen.
  Die Seite wirbt an anderer Stelle mit Start/Pause und stundengenauer Abrechnung („widerspricht sich“, wie der Plan vermerkt). **Für die Planung gilt vorsichtig: nur Löschen beendet die Kosten.**
  Dann gehen Daten auf der Instanz verloren (Modelle müssten neu geladen werden, Zeit und Datenvolumen unbekannt). Verbindliche Auskunft beim Anbieter einholen (Frage 2 unten).
- **Startguthaben:** 200 € in den ersten 60 Tagen für neue Konten (Angabe von centron; Bedingungen nicht gelesen). Das würde die geplanten rund 24 bis 26 € für die Demo-Stunden decken. Konto anlegen macht laut Plan Jonas.
- Mit 1,1919 € statt 1,19 € ändern sich die Planrechnungen nur geringfügig (50 € ÷ 1,1919 € ≈ 41,9 Stunden ohne Zuschläge).

## Woher die Zahlen kommen und wie es günstiger wird (Stand 12.11.2026)

**Der Plan nennt denselben Preis.** Plan-Zeilen (Abschnitt Kosten): „Server-Test, 2 Stunden | 2,38 €“ und „Server-Demo, 20 Stunden | 23,80 € bis ca. 26 €“. Das sind 2 × 1,19 € bzw. 20 × 1,19 €. Die „2, 3 Euro“ gelten also für **zwei Stunden**, nicht für eine. centron nennt auf der GPU-Seite 1,1919 € pro Stunde netto (Plan: 1,19 €). Alle Preise netto; Umsatzsteuer, vCPU, RAM und Speicher kommen laut centron zusätzlich (Höhe: **unbekannt**).

| Budget | Stunden RTX 6000 Ada (ohne Zuschläge) |
| --- | --- |
| 2 € | ca. 1,7 |
| 5 € | ca. 4,2 |
| 50 € (Plan) | ca. 41,9 |

### Hebel für niedrigere Kosten
1. **Kleinere GPU** (centron-GPU-Seite, netto pro Stunde): RTX A4000 16 GB 0,2069 €, Quadro RTX 6000 24 GB 0,2764 €, A100 ab 0,9583 / 1,7917 € (je nach Ausführung). **Ob Whisper large-v3 und TranslateGemma 12B dort gemeinsam in den Speicher passen und schnell genug sind: unbekannt, nicht gemessen.** Messpunkt: `scripts/bench_*.py` auf der kleineren Karte (Speicher, Verzögerung pro Stufe).
2. **Nur so lange laufen lassen wie nötig, danach Instanz löschen** (Kosten laufen laut centron auch bei gestoppter Instanz weiter).
3. **200 € Startguthaben** für neue Konten in den ersten 60 Tagen (Bedingungen nicht gelesen): der Prototyp-Test kann dadurch laut Seite 0 € kosten, sofern die Bedingungen es erlauben.
4. **Nur ein Termin pro Server-Stunde bündeln**: Vorbereitung (Modelle laden) außerhalb der Demo kostet ebenfalls Servermiete; „Golden Image“/Snapshot mit fertigen Modellen könnte das verkürzen (für GPU-Instanzen unbekannt).
5. **Piper läuft auf CPU**: TTS braucht keine GPU-Zeit.

Langfristig sehr günstig bei hoher Qualität ist **ein Messziel, keine belegte Aussage**: Erst mit gemessener Verzögerung und Qualität je GPU-Klasse lässt sich ein Preis pro Veranstaltungsstunde nennen.


# ===== Datei: docs/datenschutz-nachweis.md =====

# Datenschutz-Nachweis für Gespräche mit Behörden und Unternehmen (Stand 12.11.2026)

Zweck: Sie sollen Kunden nur das zusagen, was belegt ist. **Keine Rechtsberatung, keine Zertifizierung.** Eine Aussage wie „super sicher“ oder „DSGVO-konform zertifiziert“ lässt sich damit **nicht** begründen.

## 1. Was belegt ist

| Aussage | Beleg | Art des Belegs |
| --- | --- | --- |
| Audio und Text werden nicht gespeichert (nur Arbeitsspeicher, Puffer weg bei Sitzungsende) | Tests `test_sitzungsende_benachrichtigt_und_loescht`, `test_finish_gibt_rest_aus_und_leert_puffer` | automatischer Test (mit Attrappen) |
| Keine Inhalte in den Protokollen (nur Zeiten und Zähler) | Test `test_keine_inhalte_in_logs`; Server startet mit `--no-access-log` | automatischer Test |
| Keine Cookies, kein Tracking, kein Browser-Speicher | Prüflauf nach Plan-Prompt F (Speicher leer, 0 Cookies); statische Tests der Web-Dateien | Browser-Test in Chromium |
| Browser lädt nichts von Fremdservern (keine CDNs, Schriften, Skripte) | Prüflauf F: nur der eigene Ursprung; strenge Content-Security-Policy (Test) | Browser-Test, Header-Test |
| Der Anwendungscode baut selbst keine ausgehenden Verbindungen auf | Test `test_keine_ausgehenden_verbindungen.py` (keine Netzwerk-Clients, keine Fremdadressen in `server/app`) | statischer Test, **nur Code der Anwendung**, nicht die späteren Modell-Bibliotheken |
| Zuhörer-Links sind zufällig und laufen ab (auch bei laufender Verbindung) | Tests zu Token und Ablauf | automatischer Test |
| Bedienplatz geschützt (Schlüssel, nur ein Bedienplatz, Herkunftsprüfung) | Tests; die Demo ohne Schlüssel ist nur auf dem eigenen Rechner erlaubt (Test) | automatischer Test |

## 2. Was der Anbieter laut eigenen Angaben bietet (von mir gelesen, nicht unabhängig geprüft)

Quelle: www.centron.de, gelesen am 11./12.11.2026.
- Eigenes Rechenzentrum in Hallstadt bei Bamberg; „Ihre Daten verlassen Deutschland nicht“.
- „Inhabergeführtes deutsches Unternehmen ohne ausländische Konzernmutter“, daher laut centron Unterwerfung nur unter deutsches und europäisches Recht.
- Zertifizierungen laut Seite: ISO 27001 auf Basis IT-Grundschutz, BSI C5:2020 Typ 1, ISO 9001, ISO 14001. **Ob das auch für die GPU-Instanzen gilt: unbekannt.**
- Auftragsverarbeitungsvertrag nach Art. 28 DSGVO samt TOMs öffentlich einsehbar; Abschluss über compliance@centron.de. Der Vertrag sieht u. a. weisungsgebundene Verarbeitung vor, **Drittlandverlagerung nur mit vorheriger dokumentierter Zustimmung**, Löschung oder Rückgabe am Ende. Abschnitt „Unterauftragsverhältnisse“ (Unterauftragnehmer) wurde **nicht im Detail gelesen**.

## 3. Wohin die Daten fließen (Datenpfad der Übersetzung)

Sprecher → Mikrofon → Browser auf dem Bedienplatz → verschlüsselte Verbindung (HTTPS/WSS) → Server in Hallstadt (nur Arbeitsspeicher: Spracherkennung, Übersetzung, Sprachausgabe) → verschlüsselte Verbindung → Browser der Zuhörer (Tablets).

**Im Datenpfad der Übersetzung ist nach der Konzeption kein Dienst eines Dritten vorgesehen** (insbesondere keine Cloud-API von Google, Microsoft, OpenAI u. a.). Das gilt für die Anwendung; die echten Modelle sind noch nicht eingebaut und ihre Bibliotheken noch nicht auf Fremdverbindungen geprüft.

### Drittparteien, die bei Aufbau und Betrieb vorkommen, aber **keine Gesprächsinhalte** sehen

| Drittpartei | Wofür | Sieht | Anmerkung |
| --- | --- | --- | --- |
| Hugging Face | einmaliger Download der Modelle (Whisper, TranslateGemma) vor dem Termin | Anfrage des Servers, ggf. Ihr Zugriffs-Token | Sitz des Unternehmens von mir nicht geprüft. Modelle danach lokal; Compose schaltet Abrufe zur Laufzeit ab. |
| Paket- und Container-Register (z. B. PyPI, Docker Hub) | Installation vor dem Termin | Anfrage des Servers | Sitz nicht geprüft; vor dem Termin erledigen, danach ausgehenden Verkehr sperren. |
| Zertifizierungsstelle (Caddy nutzt standardmäßig eine öffentliche Stelle für HTTPS-Zertifikate; welche, habe ich nicht geprüft) | HTTPS-Zertifikat der Domain | Domainname, Serveradresse | keine Gesprächsdaten; Domainname kann in öffentlichen Zertifikatsprotokollen stehen. |
| Anbieter der Domain/DNS | Namensauflösung | Anfragen an den Domainnamen | beim Domain-Anbieter klären. |
| Browser- und Geräte-Hersteller | Chromebook (Chrome/ChromeOS), Tablets | je nach Einstellung Telemetrie, Synchronisierung, Diktier-/Assistenzfunktionen | **außerhalb unserer Kontrolle.** Empfehlung (Plan): Gastprofil oder zurückgesetzte Geräte, kein Konto, keine fremden Apps, privater Modus, Verlauf danach löschen. Diktier- und Sprachassistenz-Funktionen prüfen und abschalten. Was ChromeOS genau sendet: unbekannt. |

## 4. Was Sie Kunden (noch) nicht sagen sollten

- „Läuft nicht über amerikanische Server“ **ohne Zusatz**: Zutreffend und belegbar ist nur: „Die Verarbeitung der Sprache und der Texte erfolgt auf einem Server in Deutschland; im Datenpfad ist kein Dienst eines Drittanbieters vorgesehen.“ Einmalige Vorbereitungsschritte (Modell-Download) laufen über Dienste, deren Sitz ich nicht geprüft habe, und enthalten keine Gesprächsdaten.
- „DSGVO-konform“, „BSI-zertifiziert“, „C5-konform“, „behördentauglich“: Das sind Bewertungen, die Ihnen dieses Dokument nicht liefert (Anbieterangaben ≠ Zertifizierung Ihrer Lösung).
- „Fehlerfrei“ oder „vollständig“: Die Übersetzung ist KI-erzeugt; Hinweis laut Plan nötig (Art. 50 KI-VO, Übergangsfrist laut Plan bis 02.12.2026).

## 5. Offene Punkte vor einem Einsatz bei Behörden/Unternehmen

1. Rechtliche Prüfung (Datenschutzbeauftragte/r bzw. Fachleute): Datenschutz-Merkblatt, KI-Hinweis, AVV, Verzeichnis der Verarbeitungstätigkeiten, ggf. Datenschutz-Folgenabschätzung.
2. AVV mit dem Anbieter abschließen, TOMs und Unterauftragnehmer prüfen.
3. **Gemma-Bedingungen:** Das Bereitstellen als gehosteter Dienst gilt laut Text als „Distribution“; Nutzungseinschränkungen sind in Ihre Nutzungsbedingungen aufzunehmen (Details: `docs/lizenzen-recherche.md`).
4. Ausgehenden Verkehr auf dem Server sperren und mit einer Messung belegen (`docs/firewall-vorschlag.md`); Bibliotheken der echten Stufen prüfen.
5. Protokolle des vorgeschalteten Proxys (Caddy) und des Anbieters (Server-Logs, Snapshots) klären: Aufbewahrung, Inhalt.
6. Penetrationstest, Verschlüsselung der Verbindung (TLS-Konfiguration prüfen), Zugriffsschutz des Bedienplatzes bei öffentlicher Erreichbarkeit (kein Schutz gegen Dauer-Raten des Schlüssels).
7. Geräteleitfaden für Chromebook und Tablets (Gastprofil, Diktier-/Assistenzfunktionen aus).

## 6. Formulierungsvorschlag (nur belegte Aussagen, vor Verwendung rechtlich prüfen lassen)

> Die Sprache wird live auf einem Server in Deutschland verarbeitet (Rechenzentrum Hallstadt, Anbieter mit eigenem Rechenzentrum). Es werden weder Audio noch Text gespeichert; Protokolle enthalten nur Zeiten und Zähler. Die Seiten für Bedienplatz und Zuhörer laden keine Inhalte von Drittanbietern und verwenden keine Cookies oder Tracking. Zuhörer treten über zufällige, zeitlich begrenzte Links bei. Die Übersetzung wird von einer KI erzeugt und kann Fehler enthalten.


# ===== Datei: docs/tts-kandidaten-ar-tr.md =====

# Sprachausgabe für Arabisch und Türkisch: Kandidaten (Stand 12.11.2026)

Ausgangslage: Piper hat für Türkisch nur eine nicht-kommerzielle Stimme (`tr_TR-dfki`), für Arabisch nur eine mit ungeklärter Lizenz (`ar_JO-kareem`). Gesucht: Sprachausgabe auf dem eigenen Server (kein Cloud-Dienst) mit freier Lizenz.

Quelle: Modellkarten auf huggingface.co, gelesen am 12.11.2026 (Lizenz laut Karte). **Gehört, ausprobiert oder gemessen habe ich keinen der Kandidaten.** Die Lizenz der Trainingsdaten ist nicht geprüft.

| Modell | Lizenz laut Karte | Arabisch | Türkisch | Ukrainisch | Persisch | Angaben zu Tempo und Speicher |
| --- | --- | --- | --- | --- | --- | --- |
| VoxCPM2 (openbmb/VoxCPM2) | Apache-2.0 | ja | ja | nicht genannt | nicht genannt | ca. 8 GB VRAM; RTF ca. 0,30 auf RTX 4090 (1 s Ton braucht 0,3 s Rechenzeit, laut Karte); Streaming vorhanden |
| MOSS-TTS (OpenMOSS-Team/MOSS-TTS-Local-Transformer) | Apache-2.0 | ja | ja | nicht genannt | ja | in der gelesenen Karte keine Zahlen; es gibt eine „Realtime“-Variante (1,7B) |
| Chatterbox Multilingual V3 (ResembleAI/chatterbox) | MIT | ja | ja | nicht genannt | nicht genannt | Größe 0,5B; Zahlen zu Tempo nicht gelesen |
| XTTS-v2 (coqui/XTTS-v2) | Coqui Public Model License | ja | ja | nicht genannt | nicht genannt | **nicht-kommerziell, ausgeschlossen** |
| OmniVoice (k2-fsa/OmniVoice) | Modell CC-BY-NC | (600+ Sprachen) | | | | **nicht-kommerziell, ausgeschlossen** |

**Ukrainisch** steht bei keinem der freien Kandidaten in der Sprachliste; dafür bleibt Piper (`ukrainian_tts`, CC0, bzw. die `high`-Stimmen mit offener Datenlage).

## Empfehlung

1. Beim ersten Servertest **VoxCPM2** für Arabisch und Türkisch hören (Apache-2.0, nach Karte etwa 8 GB VRAM und schnell genug, wenn die Zahl auf unserer Karte ähnlich ausfällt: **unbekannt**). Danach MOSS-TTS und Chatterbox als Alternativen.
2. Wichtige Einschränkung: Diese Modelle sind auf Stimmklonen und freie Stimmen ausgelegt. Ohne Referenzstimme klingt die Stimme je Satz womöglich anders; es braucht eine feste Stimme (Stimmbeschreibung oder eine eigene, lizenzfreie Referenzaufnahme). **Stimmen echter Personen nicht klonen.**
3. Verzögerung: Zusätzliche Rechenzeit der Sprachausgabe geht vom Budget (3 bis 5 s gesamt) ab; vier Sprachen laufen auf derselben GPU.
4. Einbau erst nach dem Hörvergleich. Die Sprachausgabe-Stufe ist heute nur für Piper umgesetzt; die Anbindung eines zweiten Modells (je Sprache wählbar) ist noch nicht geschrieben.

## Hörvergleich auf dem Server (vorbereitet)

`scripts/tts_candidate_try.py` erzeugt für VoxCPM2 je Sprache einige Sätze aus den Qualitätssätzen und misst Rechenzeit und Speicher (Beispielaufruf aus der Modellkarte; **nicht getestet**, da hier keine GPU).


# ===== Datei: docs/messprotokoll.md =====

# Messprotokoll (Stand 09.11.2026)

Regel: Was nicht gemessen ist, steht als „unbekannt“. Messwerte nie ohne Datum, Gerät und Aufbau eintragen.
Keine Inhalte aus Gesprächen eintragen, nur Zahlen.

## A. Mikrofon-Test (Etappe 0) – vom Betreiber auszufüllen

Gerät: ASUS Chromebook Plus CX34, Mikrofon DJI Mic Mini (USB-C-Empfänger). Seite: `web/mic-test.html`.

| Größe | Wert (Datum) | Bemerkung |
| --- | --- | --- |
| `AudioContext.sampleRate` | unbekannt | |
| `track.getSettings().sampleRate` | unbekannt | |
| Kanäle (`channelCount`) | unbekannt | Mono/Stereo des Empfängers |
| Echo-Unterdrückung (Standard) | unbekannt | |
| Rauschunterdrückung (Standard) | unbekannt | |
| Pegelregelung (Standard) | unbekannt | |
| Sprechpegel RMS / Spitze (dBFS) | unbekannt | normale Sprechlautstärke, 1 m / Ansteckposition |
| Übersteuerung bei lautem Sprechen | unbekannt | |
| Qualität der Aufnahme mit allen Filtern aus vs. an | unbekannt | Höreindruck |

## B. Testlauf Entwicklungs-Container (Etappe 1, nur Attrappen)

Aufbau: Cloud-Container, Chromium mit Fake-Mikrofon (Testton), Mock-Stufen, Mock-ASR-Segment 1 s.
**Diese Werte sagen nichts über das echte System aus**; sie belegen nur, dass die Zeitstempel erzeugt und angezeigt werden.

| Größe | Wert | Bemerkung |
| --- | --- | --- |
| Mic-Test Fake-Gerät: AudioContext / Track | 44100 Hz / 48000 Hz, 1 Kanal | Fake-Gerät des Browsers, nicht DJI |
| Mock-Stufen MT / TTS / Ausgabe | 4 ms / 4 ms / 0 ms (ein Lauf) | Attrappen ohne Rechenaufwand |
| Mock-ASR | 939 ms | entspricht der eingestellten Segmentlänge von 1 s, keine Erkennungszeit |

## C. Offene Messpunkte (Pipeline mit GPU)

| Messpunkt | Wie messen | Wert |
| --- | --- | --- |
| ASR-Dauer (`t_asr − t_audio_in`) | Zeitstempel in Nachricht | unbekannt |
| MT-Dauer je Sprache (`t_mt − t_asr`) | Zeitstempel | unbekannt |
| MT bei 4 Sprachen gleichzeitig | Zeitstempel, 4 Zuhörer | unbekannt |
| TTS-Dauer (`t_tts − t_mt`) | Zeitstempel | unbekannt |
| Gesamt serverseitig (`t_out − t_audio_in`) | Zeitstempel | unbekannt |
| Strecke Mikrofon -> Server | **Messpunkt fehlt**: Client-Zeitstempel im Audio-Block, Uhrenabgleich nötig | unbekannt |
| Strecke Server -> Zuhörer-Lautsprecher | **Messpunkt fehlt**: Rückmeldung des Clients bei Wiedergabebeginn | unbekannt |
| Ende-zu-Ende (Sprecher -> Ohr) | externe Messung (z. B. Klatsch-Test mit Stoppuhr/Video), Methode noch festlegen | unbekannt |
| GPU-Speicher und -Auslastung | `nvidia-smi` während des Betriebs | unbekannt |
| Maximale Zuhörerzahl je Raum | Lasttest | unbekannt |

## D. Zielwerte aus dem Plan (Abschnitt 5)

| Messpunkt | Zielwert laut Plan | Ergebnis |
| --- | --- | --- |
| t1 Audio im Browser bis Server | unter 0,3 s | unbekannt (Schätzung am Bedienplatz: halber Ping + 50 ms Blockgröße + Eingangslatenz; keine Messung der echten Strecke) |
| t2 Spracherkennung (Satzteil stabil) | offen | unbekannt |
| t3 Übersetzung je Sprache | offen | unbekannt |
| t4 Sprachausgabe je Sprache | offen | unbekannt |
| Gesamt Sprecher bis Untertitel (t1 bis t3) | 3–5 s | unbekannt |
| Gesamt Sprecher bis Ton (t1 bis t4) | nahe 5 s | unbekannt |
| VRAM belegt bei 4 Sprachen | unter 48 GB mit Reserve | unbekannt |
| Qualität uk / ar / en / tr (Muttersprachler, Skala 1–5) | mindestens 4 | unbekannt (Bogen: `docs/bewertungsbogen.md`) |
| Direkt vs. Umweg über Englisch | besserer Weg je Sprache | unbekannt (`scripts/bench_mt.py`) |
| Ausfälle in 10 Minuten | 0 | unbekannt |

Annahme der Skripte: Das Gesamtbudget von 5000 ms wird gleichmäßig auf ASR, MT und TTS verteilt (je 1666 ms). Das ist **keine Planvorgabe**, nur ein Markierungs-Schwellenwert („ZU HOCH“).

## E. Messwerkzeuge (Plan, Prompt C)

| Skript | Misst | Hinweis |
| --- | --- | --- |
| `scripts/bench_asr.py` | Zeit bis erstes Wort, Ende-Verzögerung, Wortfehlerrate je Testsatz | Echtzeit-Wiedergabe als Standard; `--fast` macht Latenzwerte ungültig |
| `scripts/bench_mt.py` | Zeit je Satz und Sprache, Wege direkt und über Englisch | Qualität wird nicht gemessen |
| `scripts/bench_tts.py` | Zeit bis Audio je Stimme | Hörprobe separat |
| `scripts/bench_load.py` | 4 Übersetzungen und 4 Stimmen gleichzeitig, VRAM vorher/nachher | |
| `scripts/smoke_test.sh` | lädt jede Stufe, verarbeitet einen Satz | |
| `scripts/fake_speaker.py` | speist eine WAV-Datei wie ein Mikrofon ein, zeigt Zeitstempel | Rundlauf siehe Testbericht |

Ergebnisse der Skripte mit echtem Backend lassen sich mit `--write` an dieses Protokoll anhängen. Bisher wurde **nichts** mit echtem Backend gemessen.


## Nachtrag 12.11.2026: Sprachausgabe auf der CPU der Entwicklungsumgebung (keine Servermessung)

Piper 1.8.0, `uk_UA-ukrainian_tts-medium` (Sprecher 0) und `en_GB-alba-medium`, je drei erfundene Sätze nach einem Aufwärmlauf, Rechenzeit pro Satz. **Nicht der gemietete Server, Wert ist eine Orientierung.** Ladezeit beider Stimmen: 3,6 s.

| Sprache | Rechenzeit je Satz | Länge des Audios |
| --- | --- | --- |
| uk | 71 ms, 158 ms, 132 ms | 2,3 s, 4,1 s, 4,1 s |
| en | 75 ms, 168 ms, 121 ms | 1,9 s, 4,9 s, 3,5 s |

Qualität (Klang) habe ich nicht beurteilt; das ist eine Hörprobe (`docs/bewertungsbogen.md`).


## 13.11.2026: Einrichtung auf der GPU-VM (centron, RTX 6000 Ada, Ubuntu 26.04)

| Schritt | Messung |
| --- | --- |
| `server_setup.sh` gesamt (Pakete, Whisper large-v3, 2 Stimmen, ohne TranslateGemma) | **2 min 10 s** (real), user 50,6 s, sys 19,7 s |
| Whisper large-v3 laden (Hugging Face, 7 Dateien) | ca. 15 s |
| GPU-Prüfung | PyTorch 2.15.0+cu132 CUDA True; CTranslate2 4.9.0, 1 Gerät, float16 möglich; Whisper auf der GPU geladen, 436 MiB von 49.140 MiB belegt (Wert wirkt niedrig, nicht weiter geprüft) |
| Treiber `nvidia-driver-595-open` (apt, DKMS) mit Neustart | Dauer nicht gemessen |
| TranslateGemma 12B laden (24,4 GB, 18 Dateien, Hugging Face mit Token) | **1 min 43 s** (Lauf `server_setup.sh` gesamt 1 min 53 s) |
| Server starten (Modelle in die GPU laden) | noch nicht gemessen |

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

## Abkürzung: Einrichtung beim Anlegen automatisch (Cloud-Init, NICHT GETESTET)

Beim Anlegen der VM gibt es unter „Erweiterte Optionen“ das Feld **Cloud-Init Initialisierungsskripte** (kostenlos). Den Inhalt von `scripts/cloud-init-gpu.sh` dort einfügen (Format, das das Feld erwartet: unbekannt; das Skript beginnt mit `#!/bin/bash`). Es installiert die Pakete, lädt Code, Whisper und die Stimmen, installiert den GPU-Treiber und startet neu. Danach: per SSH anmelden, `tail /var/log/kidolmetscher-init.log` und prüfen, ob `/root/kidolmetscher/INIT_FERTIG` existiert, dann `nvidia-smi`, dann TranslateGemma mit dem Token laden (`HF_TOKEN=... bash ~/kidolmetscher/src/kidolmetscher/scripts/server_setup.sh`, überspringt Fertiges) und weiter wie oben. Dauer: unbekannt (die Instanz kostet in dieser Zeit schon). Das Skript steht öffentlich im Repository; es enthält keine Geheimnisse und darf keine enthalten.

## Fehlersuche

| Meldung / Problem | Wahrscheinliche Ursache | Was tun |
| --- | --- | --- |
| `nvidia-smi nicht gefunden` | Image ohne GPU-Treiber | Anderes Image mit NVIDIA-Treiber wählen oder Treiber installieren (Anbieter-Doku; ob vorhanden: unbekannt) |
| PyTorch: „CUDA verfügbar: False“ trotz `nvidia-smi` | PyTorch-Build passt nicht zum Treiber | Passenden PyTorch-Build für die Treiberversion installieren (`pip install torch --index-url <passender-index>`), Version laut `nvidia-smi` |
| CTranslate2: `libcublas.so.12` / `libcudnn` nicht gefunden | Bibliotheken fehlen für die Spracherkennung | `pip install nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"` und `LD_LIBRARY_PATH` auf die Ordner setzen (Anleitung der faster-whisper-Projektseite); ob das mit der installierten PyTorch-Version verträglich ist: unbekannt |
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
   - Firewall/Netzwerk: nur Port 22 (SSH) von außen erlaubt, falls einstellbar; keine weiteren Ports freigeben.
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

# Server für einen Test von etwa einer Stunde (centron) – Stand 12.11.2026

Ziel: Den GPU-Server nur für einen Termin oder Test buchen und danach wieder abschalten. **Nichts davon habe ich ausgeführt oder bestellt.**
Quellen: die öffentlichen centron-Seiten (www.centron.de, gelesen am 11./12.11.2026). Die Anmelde- und Konsolenseiten selbst (`cloud.centron.de`, `docs.centron.de`) konnte ich **nicht öffnen** (Hosts nicht freigegeben). Was dort verlangt wird, ist daher **unbekannt**.

## Wichtig vorab

1. **Die echten Modelle sind noch nicht in der Anwendung.** Whisper, TranslateGemma und Piper sind als Gerüst mit TODO angelegt (`server/app/pipeline/*_real.py`). Eine gebuchte Server-Stunde liefert erst dann eine echte Übersetzung, wenn diese drei Stufen eingebaut und auf dem Server getestet sind. Das ist der größte offene Arbeitsschritt, nicht die Anmeldung.
2. **Kosten laufen laut centron-Seite weiter, solange die Instanz existiert, auch wenn sie gestoppt ist.** Nach dem Test die Instanz **löschen**, nicht nur anhalten. Verbindliche Auskunft: Frage an centron (siehe `docs/kosten.md`).
3. Die Leistungen richten sich laut centron-AGB-Seite **nur an Unternehmer** (§ 14 BGB), juristische Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen, **nicht an Privatkunden**. Die Anmeldung muss also als Firma erfolgen. Welche Angaben dafür verlangt werden: unbekannt.

## Wo anmelden (Reihenfolge)

| Schritt | Wo | Stand |
| --- | --- | --- |
| 1. Kundenkonto anlegen | https://cloud.centron.de/register/ (Adresse von der centron-GPU-Seite; Seite nicht geöffnet) | Die GPU-Seite sagt: Konto kostenlos anlegen, Instanz konfigurieren, **keine Vertragsbindung**; neue Konten bekommen **200 € Startguthaben in den ersten 60 Tagen** (Bedingungen nicht gelesen). Zahlungsweg und Verifizierung: unbekannt. Konto und Zahlungsweg legen laut Plan Sie selbst an (nicht Claude). |
| 2. Anmelden | https://cloud.centron.de/login | „ccloud³ Console“ laut centron-Seiten. Bedienung nicht gelesen. |
| 3. Auftragsverarbeitungsvertrag (AVV) | https://www.centron.de/rechtliches/agb/auftragsverarbeitung (Vertragstext), https://www.centron.de/rechtliches/agb/toms (technische Maßnahmen) | centron stellt den AVV nach Art. 28 DSGVO mit TOMs als Anlage bereit. **Abschluss und Fragen: compliance@centron.de.** Der Vertrag sagt u. a.: Verarbeitung nur auf Weisung, Verlagerung in ein Drittland nur mit vorheriger dokumentierter Zustimmung, Löschung oder Rückgabe am Ende. Ob für eine Demo mit ausschließlich erfundenen Texten ein AVV rechtlich nötig ist, ist **keine Aussage von mir**; der Plan sieht ihn für echten Einsatz vor. |
| 4. GPU-Instanz anlegen | in der Console | Wählen: **NVIDIA RTX 6000 Ada (48 GB)**, Standort in der Console **„Bamberg · Datacenter 1 · BBG1“** (laut centron-Doku dasselbe wie Hallstadt; „eu-de“ steht in der Console nicht, Stand 12.11.2026, siehe `docs/centron-console-befund.md`). Laut Seite ist eine Instanz in etwa zwei Minuten bereit; die Ladezeit der Modelle danach ist **unbekannt** (messen). Zusätzlich zu 1,1919 € pro Stunde netto kommen vCPU, RAM und Speicher zu den ccloud³-Ressourcenpreisen (Höhe: unbekannt). Preisrechner: https://www.centron.de/en/preisrechner |
| 5. Zugang | SSH-Schlüssel | Auf dem Windows-Rechner in der Eingabeaufforderung `ssh-keygen` (Windows 10/11 bringen den OpenSSH-Client meist mit; ob er bei Ihnen vorhanden ist: unbekannt). Den öffentlichen Schlüssel (`.pub`) in der Console hinterlegen. Den privaten Schlüssel niemals weitergeben oder ins Repository legen. |
| 6. Zugriff auf TranslateGemma | Hugging-Face-Konto | Das Modell hat **manuelle Freigabe**: Konto anlegen, Gemma-Bedingungen akzeptieren, Freigabe abwarten (Dauer: unbekannt), danach ein Zugriffs-Token erzeugen. Das Token nie in den Chat oder ins Repository schreiben, nur als Umgebungsvariable `HF_TOKEN` auf dem Server. Erst planen, dann buchen: Die Freigabe sollte **vor** dem Servertermin vorliegen. |
| 7. Adresse mit HTTPS | Domain oder Subdomain (z. B. von kischub.de) | Ohne HTTPS gibt der Browser das Mikrofon auf einer fremden Adresse nicht frei. Bei wem die Domain liegt und wie ein Eintrag geändert wird: unbekannt. Caddy ist vorbereitet (`docker/Caddyfile`). |
| 8. Ende | Console | **Instanz löschen**, Kosten in der Console prüfen. Snapshots sind laut centron-Seite für ccloud³-VMs kostenlos (an anderer Stelle derselben Seite steht „nach genutztem Speicher abgerechnet“: Widerspruch, bei centron klären). Ein Snapshot könnte als „Golden Image“ mit fertig geladenen Modellen den nächsten Termin beschleunigen; **ob das für GPU-Instanzen gilt, ist unbekannt**. |

## Ablauf pro Kundentermin (Entwurf, noch nicht erprobt)

1. Tage vorher: Hugging-Face-Freigabe prüfen, Domain bereit, Hörproben/Übersetzung mit erfundenen Texten bei einem früheren Test geprüft.
2. Vor dem Termin (Vorlauf: **messen**, laut Seite etwa 2 Minuten für die Instanz plus unbekannte Zeit für Modelle): Instanz anlegen, Anwendung starten, `scripts/smoke_test.sh`, Adresse auf den Server zeigen lassen.
3. Am Bedienplatz: Sitzung starten, QR-Code zeigen, „Senden starten“.
4. Nach dem Termin: Sitzung beenden, **Instanz löschen**, Kosten prüfen.

## Was ich tun kann, sobald Sie wollen

- Die echten Stufen einbauen (Piper kann ich hier auf CPU testen; Whisper und TranslateGemma erst mit GPU-Server).
- Ein Einrichtungsskript für einen frischen Server schreiben (Docker, Modelle laden, starten). Auf dem Server selbst nur nach Ihrer Freigabe und unter Ihrer Aufsicht.
- Das Unternehmens-Konto, den Zahlungsweg und das Hugging-Face-Konto legen Sie selbst an (laut Plan nicht Claude).

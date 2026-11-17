# Kosten und Budget (Stand 11.11.2026, berichtigt 17.11.2026)

## Aktueller Stand der Preise (17.11.2026)

**Alle Preise netto, ohne 19 % Umsatzsteuer. Maßgeblich ist die Checkout-Anzeige der centron-Console, nicht die Doku-Seiten.** Die Zahlen in den älteren Abschnitten dieser Datei (1,19 € pro Stunde, 0,2069 € für die A4000) sind **nur der GPU-Anteil** und gelten als überholt, sobald vCPU, RAM und Speicher dazukommen.

| Konfiguration | Preis pro Stunde (netto) | Quelle |
| --- | --- | --- |
| RTX A4000 16 GB mit 4 vCPU / 16 GB RAM / 100 GB Speicher (im Einsatz seit 14.11.2026) | **0,2652 €** (190,96 € pro Monat bei Dauerbetrieb) | Checkout-Anzeige, Bericht vom 14.11.2026, Protokoll Abschnitt 15 |
| RTX 6000 Ada 48 GB mit 4 vCPU / 16 GB RAM / 300 GB Speicher | **1,2641 €** (910,15 € pro Monat) | Console, Protokoll Abschnitt 7 |
| nur GPU-Anteil: A4000 / Ada | 0,2069 € / 1,1919 € | centron-Doku, nicht der Gesamtpreis |

- Die Anzeige am Bedienplatz nimmt `SERVER_HOURLY_EUR` und `BUDGET_EUR` aus der Konfiguration. **Die Standardwerte der Skripte weichen davon ab:** `scripts/server_setup.sh` setzt `SERVER_HOURLY_EUR=1.24` und `BUDGET_EUR=20` (weder Plan-Budget 50 € noch ein centron-Preis); `windows/vm-einrichten.ps1` trägt `0.2652` ein. Vor dem Termin die Werte in `server.env` prüfen.
- Widerspruch in den Quellen: Der RAM-Preis steht in der Doku mit 0,97 € pro GB, im Protokoll mit 1,90 € pro GB; im Checkout gilt die Anzeige. Der A4000-Preis steht auf centron-Seiten uneinheitlich (0,2069 €, 0,13 €, 0,067 € pro Stunde), gültig ist die Checkout-Anzeige (Stand 14.11.2026; vor einer Buchung erneut ablesen).
- **Nach dem Termin die VM in der centron-Console zerstören (VM-Name bestätigen).** Stoppen, Ausschalten oder Pausieren beendet weder die Kosten noch löscht es die Daten auf dem Datenträger (Support bestätigt; Protokoll Abschnitt 7, `docs/betrieb.md`, `scripts/server_ctl.sh`).
- Kein Kostenlimit, keine Vorauszahlung, keine Warnschwelle bei centron (Support bestätigt). Startguthaben 200,00 € in den ersten 60 Tagen (Support bestätigt; netto oder brutto unbekannt).
- Ein Test von 2 bis 3 Stunden auf der A4000: **ca. 0,53 bis 0,80 €** netto (2 bis 3 mal 0,2652 €; eigene Rechnung). Ein vergessener Tag auf der A4000: ca. 6,36 € netto (24 mal 0,2652 €); auf der Ada ca. 30,34 € (24 mal 1,2641 €). Budget 50 € auf der A4000: rund 188 Stunden (50 ÷ 0,2652), **nicht von centron bestätigt**.

**Die folgenden Abschnitte sind der Stand vom 11./12.11.2026 und bleiben als Geschichte erhalten. Überholt seit 14.11.2026: alle Rechnungen mit 1,19 € pro Stunde und die Aussage, die Ada-Karte sei das Ziel; ersetzt durch die Tabelle oben.**

**Preise stammen aus dem Plan (Listenpreise). Die centron-Angaben habe ich am 11.11.2026 auf www.centron.de gegengelesen (siehe Abschnitt „Gegenlesen“), STACKIT nicht. Nichts bestellt.**

| Posten | Preis laut Plan | Hinweis |
| --- | --- | --- |
| Mikrofon, Chromebook, Tablets | 0 € | vorhanden bzw. geliehen |
| GPU-Server centron, RTX 6000 Ada 48 GB | 1,19 € pro Stunde netto | stündliche Abrechnung; Zuschläge für CPU, RAM, Speicher; Kosten pausierter Server: *Überholt seit 13.11.2026 (war „unklar“): gestoppte VMs werden weiter berechnet, nur Zerstören beendet die Kosten (Support bestätigt)* |
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
Das ist **nicht** die Laufzeit der gemieteten Maschine. *Überholt seit 13.11.2026: „Server nach jeder Sitzung beenden oder pausieren“, ersetzt durch: **Server nach dem Termin in der centron-Console zerstören** (Name bestätigen); Stoppen oder Pausieren beendet die Kosten nicht und löscht die Daten auf dem Datenträger nicht.*

## Fragen an centron (vorbereitet, nicht versendet)

1. Auftragsverarbeitungsvertrag nach Art. 28 DSGVO: wie und wo abschließbar?
2. Kosten eines pausierten bzw. gestoppten Servers (GPU-Instanz)? *(Beantwortet am 13.11.2026 durch den Support: gestoppte und ausgeschaltete VMs werden weiter berechnet, nur Zerstören beendet die Kosten.)*
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
1. **Kleinere GPU** (centron-GPU-Seite, netto pro Stunde, **nur GPU-Anteil**; Gesamtpreis der A4000-Konfiguration laut Checkout 0,2652 €): RTX A4000 16 GB 0,2069 €, Quadro RTX 6000 24 GB 0,2764 €, A100 ab 0,9583 / 1,7917 € (je nach Ausführung). *Überholt seit 14.11.2026:* 12B (24,41 GB Gewichte) passt nicht in 16 GB; im Einsatz ist TranslateGemma 4B (8,64 GB) mit Whisper (ca. 4,2 GB). **Speicherreserve, Verzögerung und Qualität der 4B-Variante: unbekannt, nicht gemessen.** Messpunkt: `scripts/bench_*.py` auf der kleineren Karte (Speicher, Verzögerung pro Stufe).
2. **Nur so lange laufen lassen wie nötig, danach Instanz löschen** (Kosten laufen laut centron auch bei gestoppter Instanz weiter).
3. **200 € Startguthaben** für neue Konten in den ersten 60 Tagen (Bedingungen nicht gelesen): der Prototyp-Test kann dadurch laut Seite 0 € kosten, sofern die Bedingungen es erlauben.
4. **Nur ein Termin pro Server-Stunde bündeln**: Vorbereitung (Modelle laden) außerhalb der Demo kostet ebenfalls Servermiete; „Golden Image“/Snapshot mit fertigen Modellen könnte das verkürzen (für GPU-Instanzen unbekannt).
5. **Piper läuft auf CPU**: TTS braucht keine GPU-Zeit.

Langfristig sehr günstig bei hoher Qualität ist **ein Messziel, keine belegte Aussage**: Erst mit gemessener Verzögerung und Qualität je GPU-Klasse lässt sich ein Preis pro Veranstaltungsstunde nennen.

# Kosten und Budget (Stand 11.11.2026)

**Alle Preise stammen aus dem Plan (Listenpreise, vom Plan als „belegt“ bzw. „Annahme“ gekennzeichnet). Ich habe sie nicht selbst geprüft
(centron-Seiten waren aus dieser Sitzung nicht erreichbar). Nichts bestellt.**

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

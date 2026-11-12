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

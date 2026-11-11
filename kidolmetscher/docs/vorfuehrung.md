# Vorführung vorbereiten (Plan, Phase 7 und Prompt G) – Stand 11.11.2026

Nur erfundene Texte und Namen. Keine echten Daten.

## Ablauf (laut Plan)

1. Begrüßung und **Hinweis auf die KI-Übersetzung** (Teilnehmende vorab informieren).
2. Zuhörer scannen den QR-Code und tippen auf ihre Sprache, dann „Tippen zum Starten“ (Ton) oder „Nur Untertitel“.
3. Live-Teil (Skript unten, 3–5 Minuten).
4. Feedback (Bewertungsbogen `docs/bewertungsbogen.md`).
5. Sitzung beenden, **Server beenden oder pausieren**, auf den Tablets den Browserverlauf löschen.

## Skript (erfundener Text; Länge beim Probelesen stoppen, Ziel laut Plan 3–5 Minuten)

> Guten Tag und herzlich willkommen im Haus der Erfindungen. Mein Name ist Frau Beispielmann, und ich freue mich, dass Sie heute
> alle gekommen sind. Bevor wir beginnen, noch ein Hinweis: Diese Veranstaltung wird live von einer künstlichen Intelligenz übersetzt.
> Die Untertitel und die Sprachausgabe können Fehler enthalten. Es werden keine Aufnahmen gespeichert.
>
> Heute geht es um ein erfundenes Projekt in Teststadt. Der Bau des neuen Gemeinschaftsgartens beginnt am 14. März. Insgesamt sind
> 85 Beete vorgesehen, und jedes Beet ist 6 Quadratmeter groß. Die Anmeldung ist ab dem 1. Februar möglich und kostet 12 Euro 50 pro Jahr,
> ermäßigt 7 Euro.
>
> Herr Musterfeld leitet die Gartengruppe. Er erklärt gleich, wie die Beete verteilt werden. Wer zuerst kommt, wählt zuerst. Familien
> mit Kindern bekommen ein Beet in der Nähe des Spielplatzes. Gießwasser steht im Gerätehaus bereit, und Werkzeug kann montags und
> donnerstags zwischen 16 Uhr und 18 Uhr ausgeliehen werden.
>
> Noch ein Wort zur Technik: Das Mikrofon an meinem Revers sendet an einen kleinen Empfänger, und der Computer schickt die Sprache
> an einen Server. Dort wird sie in Text umgewandelt, übersetzt und für jede Sprache als Untertitel und Ton an Ihr Gerät gesendet.
> Dieser ganze Weg dauert nur wenige Sekunden. Wenn Ihnen etwas unklar ist, heben Sie bitte die Hand.
>
> Zum Schluss ein Überblick über die nächsten Schritte. Erstens: Wir sammeln bis Ende Februar die Anmeldungen. Zweitens: Im März
> bereiten wir den Boden vor. Drittens: Im April feiern wir die Eröffnung mit Musik und einer kleinen Pflanzenbörse. Vielen Dank für Ihre
> Aufmerksamkeit. Haben Sie noch Fragen?

## Checkliste vor der Vorführung

**Server und Software**
- [ ] Server **1 Stunde vorher starten**, Aufwärmtest, danach nur bei Bedarf laufen lassen und **am Ende beenden/pausieren**.
- [ ] `scripts/smoke_test.sh` auf dem Server ohne Fehler.
- [ ] `OPERATOR_KEY` gesetzt (nicht im Repository), `PUBLIC_URL` auf die HTTPS-Adresse, Budgetgrenze notiert.

**Prüfung am Bedienplatz (Plan, Prompt G)**
- [ ] 1. Seite lädt, Verbindung zum Server steht („Mikrofon“-Bereich zeigt keine Fehler).
- [ ] 2. „DJI Mic Mini“ ist in der Mikrofonliste vorgewählt, Pegel bewegt sich beim Sprechen, **kein Übersteuern** (Balken nicht dauerhaft am Anschlag; Mikrofontest-Seite hilft).
- [ ] 3. Sitzung starten, zwei Zuhörer-Tabs (z. B. Ukrainisch, Englisch) öffnen.
- [ ] 4. Testsatz „Dies ist ein Testsatz mit erfundenen Daten.“: Untertitel erscheinen in beiden Tabs; angezeigte Verzögerung notieren.
- [ ] 5. Ton: „Tippen zum Starten“ gedrückt, Ton hörbar (mit Kopfhörern prüfen).
- [ ] 6. Sitzung beenden: Zuhörer-Seiten zeigen das Ende.
- [ ] 7. **Server beenden oder pausieren, Verlauf auf den Tablets löschen.**

**Geräte**
- [ ] Tablets: Betriebssystem und Browser aktualisiert, Gastprofil oder zurückgesetzt, kein Google-Login, keine fremden Apps, privater Modus, Kopfhörer-Anschluss geklärt (3,5 mm, Bluetooth, USB-C).
- [ ] DJI-Sender und Empfänger gekoppelt und geladen.
- [ ] Ladegeräte, USB-C-Kabel, **Ersatzkopfhörer**, **Hotspot-Handy**.
- [ ] Backup bei Netzausfall: laut Plan eine aufgenommene Beispielübersetzung auf dem Tablet. **Nicht gebaut** (Speicherung widerspricht der Datenschutzregel); Alternative: Folien mit Text vorab.

**Information und Datenschutz**
- [ ] Teilnehmende vorab über die KI-Übersetzung informiert (Art. 50 KI-VO; Übergangsfrist laut Plan bis 02.12.2026, rechtlich prüfen lassen).
- [ ] Datenschutz-Merkblatt (`web/datenschutz.html`) ergänzt und rechtlich geprüft; AVV mit dem Anbieter abgeschlossen.
- [ ] Muttersprachler haben die Oberflächentexte geprüft (`docs/bewertungsbogen.md`, Teil C).

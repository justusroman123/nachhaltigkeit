# Architektur, Betrieb und Datenschutz

## Ablauf einer Ansage

```
Führungskraft (Headset / Tablet)
   │  Sprache
   ▼
Edge-Server im Werk (Laptop oder Industrie-PC, eigenes WLAN, ohne Internet)
   1  Spracherkennung (Whisper, lokal)          → Text, Audio nur im Arbeitsspeicher
   2  Übersetzung mit Werks-Glossar             → je Zielsprache
   3  Rückübersetzung mit zweiter Engine        → zurück ins Deutsche
   4  Sinnvergleich (app/js/guardrail.js)       → grün / gelb / rot je Sprache
   ▼
Freigabe am Leitstand (Führungskraft)
   ▼
Ausgabe: Hallen-Display · Handy (QR, Browser) · Smart-Brille · Funkkanal in den Gehörschutz
   ▼
Verständnis-Check (anonym) · Rückkanal „nicht verstanden“ · Nachweis
```

## Sinnvergleich – was geprüft wird

| Prüfung | Beispiel | Folge |
| --- | --- | --- |
| Verneinung / Verbot (Parität) | „nicht betreten“ → „betreten“ | rot |
| Gegensatzpaare | freischalten ↔ einschalten, links ↔ rechts, öffnen ↔ schließen, anheben ↔ absenken | rot |
| Zahlen und Werte (auch arabische Ziffern) | 6 km/h → 60 km/h | rot |
| Unzulässiger Fachbegriff laut Glossar | „freischalten“ als „włącz“ | rot |
| Fachbegriff nicht wie freigegeben | „Gabelstapler“ als „Bodenfahrzeug“ | gelb |
| Sicherheitskritische Handlung fehlt in Rückübersetzung | „freischalten“ verschwindet | gelb |
| Rückübersetzung inhaltlich weit weg | Übereinstimmung < 30 % | gelb |
| Notfallbegriffe in freiem Text | „Feueralarm“ live übersetzt | gelb (einstellbar: rot) |
| Nicht übersetzt / falsche Schrift | Deutsch statt Kyrillisch | rot / gelb |

Die Regeln sind deterministisch und damit für Sifa, Betriebsrat und Auditoren nachvollziehbar.
Sie ergänzen die Freigabe durch die Führungskraft, ersetzen sie nicht.

## Betriebsmodi

| Modus | Daten | Wofür |
| --- | --- | --- |
| Edge-Server im Werk | bleiben auf dem Gelände, kein Internet | Pilot und Betrieb (empfohlen) |
| EU-Cloud mit Glossar | Auftragsverarbeitung, AV-Vertrag | schneller Start, wenn die IT zustimmt |
| Online-Demo / Browser | Demo-Inhalte, keine Betriebsdaten | Vorführung |

Für Konzern-Lieferanten verlangen Informationssicherheits-Anhänge häufig TISAX oder ISO 27001 und
eine Meldung jeder Cloud-Nutzung. Der lokale Betrieb ist dafür der einfachere Weg.

## Geräte in der Halle

- **Hallen-Display / Beamer:** alle Sprachen gleichzeitig plus Sicherheitszeichen – hilft auch
  Beschäftigten mit geringer Lesekompetenz.
- **Handy per QR-Code:** Browser, keine App, keine Anmeldung; Vorlesen über die Stimmen des Geräts;
  Rückkanal und Verständnisfrage. Wo private Handys nicht erlaubt sind: Leih-Tablets.
- **Smart-Brille:** monochrome Ansicht `#brille-xx`. Geeignet für Brillen mit Browser oder Begleit-App.
  Vor einem Pilot prüfen: Kompatibilität mit Schutzbrille (EN 166), Kamera (Werkschutz, Betriebsrat),
  Akkulaufzeit über die Schicht, Hygiene bei geteilten Geräten, Kosten je Gerät. Die aktuelle
  Geräte- und SDK-Lage habe ich nicht abschließend geprüft.
- **Ton in den Gehörschutz:** je Sprache ein Funkkanal, Empfänger per Kabel an Kapselgehörschutz mit
  Audioeingang; Pegelbegrenzung nach Herstellerangabe prüfen (EN 352-6/-8).
- **Mikrofon der Führungskraft:** Nahbesprechungs-Headset statt Raummikrofon.

## Datenschutz und Mitbestimmung (Entwurf für den Steckbrief)

| Daten | Zweck | Speicherung |
| --- | --- | --- |
| Audio der Führungskraft | Spracherkennung | keine, nur Arbeitsspeicher |
| Ansagen, Übersetzungen | Anzeige, Inhalt des Nachweises | wie Unterweisungsnachweise |
| Teilnahme (Name, Firma, Sprache, Datum) | Nachweis § 12 BetrSichV, § 4 DGUV Vorschrift 1 | betriebliche Frist |
| Antworten auf Verständnisfragen | Wirksamkeit | nur als Summe |
| Rückmeldungen „nicht verstanden“ | Unterweisung verbessern | anonym, Sitzungsende |

- Keine Sprechererkennung, keine Stimmprofile, keine Leistungs- oder Verhaltenskontrolle.
  Eine Betriebsvereinbarung ist trotzdem sinnvoll (§ 87 Abs. 1 Nr. 6 und 7 BetrVG).
- KI-Übersetzungen und synthetische Stimmen sind gekennzeichnet (Art. 50 KI-VO).
- Lokaler Betrieb ohne Zugriff des Anbieters: in der Regel keine Auftragsverarbeitung; bei Cloud
  AV-Vertrag nach Art. 28 DSGVO.
- Der Edge-Server protokolliert nur Methode, Pfad, Status und Dauer – keine Inhalte, keine IP-Adressen.

Keine Rechtsberatung. Vor dem Pilot mit Datenschutz, Informationssicherheit und Betriebsrat abstimmen.

## Technischer Ausbau nach dem Prototyp

1. Edge-Koffer: GPU-Laptop, faster-whisper (Hotwords aus dem Glossar), lokale Übersetzung, eigenes WLAN.
2. Messung im Pilot: Latenz je Satz, Erkennungsquote im Hallenlärm, Sperrquote, Verständnis vorher/nachher.
3. Glossar-Pflege mit Freigabe-Workflow und Versionierung; Export für Betriebsanweisungen.
4. Anbindung an LMS / EHS-Software für Nachweise.
5. Mehrsprachige Sprachausgabe je Funkkanal; Notfallhinweise vorab eingesprochen.

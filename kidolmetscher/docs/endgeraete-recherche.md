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

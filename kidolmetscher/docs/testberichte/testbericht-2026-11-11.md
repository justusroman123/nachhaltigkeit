# Testbericht (Stand 11.11.2026)

Umgebung: Cloud-Entwicklungscontainer (Linux), Python 3.13, Chromium mit **Fake-Mikrofon** (Testton), Mock-Stufen (keine echten Modelle), Mock-ASR-Segment 1 s.
**Nicht geprüft:** echtes DJI Mic Mini, Chromebook, echte Tablets, Safari/iPad, echte Modelle, echte Verzögerung, hörbarer Ton, GPU-Server.
Alle Werte der Zeitstempel stammen von Attrappen und sagen nichts über das echte System aus.

## 1. Automatische Tests (pytest)

`cd server && pytest`: **151 Tests bestanden**, 0 fehlgeschlagen (Räume, Token-Ablauf, Sprachwahl, Nachrichtenformat und Zeitstempel, Mock-Pipeline,
Segmentierer, Rückstau je Sprache, Orchestrator, WebSocket von Sprecher bis Zuhörer, Sitzungsende mit Löschung, Ping, `/api/session`, QR-Endpunkt,
Sicherheits-Header, Konfiguration, Messhilfen inklusive Wortfehlerrate, Rauchtest, statische Prüfung der Web-Dateien auf externe Adressen, Cookies und Speicher-APIs).
Ein Test liest den QR-Code mit OpenCV zurück und wird ohne OpenCV übersprungen.

## 2. Browser-Durchlauf (`server/tests/e2e/browser_smoke.js`)

**27 Prüfungen ok, 0 Fehler.** Inhalt: Sprachen wählbar (Persisch optional und aus), falscher Schlüssel, Sammel-Link, **QR-Code im Browser gerendert und per Decoder
als derselbe Link zurückgelesen**, drei Zuhörergeräte wählen Ukrainisch/Arabisch/Arabisch, „Tippen zum Starten“ in der gewählten Sprache (Ton erst nach Tippen an,
„Nur Untertitel“ lässt ihn aus), KI-Hinweis, Untertitel (Arabisch rechts-nach-links), Sprachwechsel mitten in der Sitzung, Lautstärkeregler, Neuladen behält die Sprache,
Einzel-Link je Sprache mit QR, Ping und Laufzeit am Bedienplatz, Sitzungsende erreicht alle Zuhörer, keine Konsolen- oder CSP-Fehler.

## 3. Prüflauf nach Plan, Prompt F (`server/tests/e2e/pruefung_f.js`)

19 Punkte ok, 0 Fehler. Nicht geprüft: echtes WLAN aus/an am Tablet (der Verbindungsabbruch wurde durch Schließen der WebSocket-Verbindung ausgelöst).

| Pruefpunkt | Ergebnis | Beleg | Vorschlag zur Behebung |
|---|---|---|---|
| 6 Ton-Freigabe | ok | vor dem Tippen 🔇, danach 🔊; Lautstaerke-Regler: vorhanden | - |
| 4 Layout Chromebook 1280x800 Zuhoerer | ok | scrollWidth 1280 <= clientWidth 1280; Untertitel 32 px | - |
| 4 Layout Chromebook 1280x800 Bedienplatz | ok | scrollWidth 1280 <= clientWidth 1280 | - |
| 4 Layout Tablet hochkant 800x1280 Zuhoerer | ok | scrollWidth 800 <= clientWidth 800; Untertitel 32 px | - |
| 4 Layout Tablet hochkant 800x1280 Bedienplatz | ok | scrollWidth 800 <= clientWidth 800 | - |
| 4 Layout Handy 390x844 Zuhoerer | ok | scrollWidth 390 <= clientWidth 390; Untertitel 32 px | - |
| 4 Layout Handy 390x844 Bedienplatz | ok | scrollWidth 390 <= clientWidth 390 | - |
| 5 Arabisch rechts-nach-links | ok | dir der Untertitel: rtl,rtl; lang=ar | Satzzeichen-Platzierung bei echtem arabischem Text von Muttersprachler pruefen |
| 3 Speicher (localStorage, sessionStorage, Cookies, IndexedDB) | ok | Zuhoerer {"ls":0,"ss":0,"ck":0,"idb":0}, Bedienplatz {"ls":0,"ss":0,"idb":0}, Cookies im Browser: 0 | - |
| 2 Netzwerk: Anfragen an Fremdserver | ok | Ursprunege: http://127.0.0.1:8123, ws://127.0.0.1:8123; fremd: keine | - |
| 2 Netzwerk: WebSocket-Nachrichten kommen an | ok | 2 Untertitelzeilen empfangen | - |
| 7a Verbindungsabbruch Zuhoerer: Wiederverbinden | ok | Status "Verbindung weg" gesehen: true; danach wieder "live" mit neuer Verbindung: true | - |
| 7a Sprache bleibt nach Wiederverbinden | ok | Sprache: العربية | - |
| 7b Verbindungsabbruch Bedienplatz: Wiederverbinden | ok | Meldung "Wieder verbunden, sendet" nach automatischem Neuaufbau (Mikrofon lief weiter) | - |
| 7b Untertitel kommen nach Wiederverbinden weiter | ok | neuer Untertitel nach dem Neuaufbau empfangen | - |
| 8 Token: erfundener oder fehlender Link | ok | erfunden: "Link ungültig", ohne Token: "Link ungültig" (keine Abstuerze) | - |
| 8 Token: abgelaufener Link | ok (pytest) | tests/test_api.py::test_abgelaufener_token_wird_abgewiesen und ::test_verbundener_zuhoerer_wird_bei_ablauf_getrennt | - |
| 1 Konsole beider Seiten | ok | keine Fehler (erwartete Verbindungsmeldungen beim absichtlichen Verbindungsabbruch ausgenommen) | - |
| Sitzungsende | ok | Zuhoererseite zeigt "Ende" | - |

## 4. Rundlauf mit `scripts/fake_speaker.py`

Aufruf: Platzhalter-Audio `satz05.wav` (kein Sprechen), Sprachen uk und en, Server mit Mock-Stufen, Segmentlänge 1 s. Alle Spalten in Millisekunden.
„ASR ms“ enthält bei der Attrappe die Segmentlänge (1 s), keine Erkennungszeit. „Server→Zuhörer“ gilt nur, weil alles auf demselben Rechner lief.

Bloecke gesendet: 70, Nachrichten empfangen: 14, Sprachen: uk, en
| seq | Sprache | t_audio_in (ms, letzte 7 Ziffern) | ASR ms | MT ms | TTS ms | Ausgabe ms | gesamt (serverseitig) ms | Server->Zuhoerer ms (gleiche Uhr) | Audio |
|---|---|---|---|---|---|---|---|---|---|
| 0 | en | 9799370 | 1008 | 0 | 2 | 0 | 1010 | 4 | ja |
| 0 | uk | 9799370 | 1008 | 3 | 2 | 0 | 1013 | 2 | ja |
| 1 | en | 9800480 | 1008 | 0 | 2 | 0 | 1010 | 4 | ja |
| 1 | uk | 9800480 | 1008 | 2 | 2 | 0 | 1012 | 2 | ja |
| 2 | en | 9801589 | 1007 | 0 | 2 | 0 | 1009 | 4 | ja |
| 2 | uk | 9801589 | 1007 | 3 | 2 | 0 | 1012 | 2 | ja |
| 3 | en | 9802698 | 1007 | 0 | 4 | 0 | 1011 | 5 | ja |
| 3 | uk | 9802698 | 1007 | 4 | 4 | 0 | 1015 | 3 | ja |
| 4 | en | 9803807 | 1007 | 0 | 2 | 0 | 1009 | 4 | ja |
| 4 | uk | 9803807 | 1007 | 3 | 1 | 0 | 1011 | 2 | ja |
| 5 | en | 9804915 | 1009 | 0 | 3 | 0 | 1012 | 6 | ja |
| 5 | uk | 9804915 | 1009 | 4 | 3 | 0 | 1016 | 3 | ja |
| 6 | en | 9806025 | 2405 | 0 | 3 | 0 | 2408 | 6 | ja |
| 6 | uk | 9806025 | 2405 | 4 | 3 | 0 | 2412 | 3 | ja |

Hinweis: 'ASR ms' enthaelt bei Mocks die Segmentlaenge; Server->Zuhoerer gilt nur, wenn alles auf demselben Rechner laeuft.

## 5. Beobachtungen und gefundene Fehler (während dieser Etappe behoben)

- Der Segmentierer hielt „Nummer 1.“ für eine Ordnungszahl und gab den Satz nie weiter; die Tests hingen dadurch. Behoben: Ordnungszahlen nur ein- bis zweistellig.
- Der Test-Hilfsaufruf erzeugte stillschweigend Einzel-Links statt Sammel-Links; behoben.
- Compose verlangte `DOMAIN` auch für das Mock-Profil; behoben (Platzhalter-Standardwert).
- Der Prüflauf konnte den Verbindungsabbruch zunächst nicht auslösen (Chromium trennt WebSockets beim Offline-Schalten nicht); ersetzt durch gezieltes Schließen der Verbindung.

## 6. Offen (nicht in dieser Umgebung prüfbar)

DJI Mic Mini am Chromebook; Ton hörbar auf Tablets mit Kopfhörern; Safari/iPad und Android-Tablets; Scannen des QR-Codes mit echter Handy-Kamera; WLAN-Ausfall am Gerät;
echte Modelle, Qualität (Muttersprachler), echte Verzögerung, VRAM; Docker-Build und HTTPS mit Caddy; Lizenzen der Modelle und Stimmen (Netzsperre bei Hugging Face/Google);
Anbieterangaben centron/STACKIT; rechtliche Prüfung von Datenschutz-Merkblatt und KI-Hinweis; Übersetzung der Oberflächentexte durch Muttersprachler.

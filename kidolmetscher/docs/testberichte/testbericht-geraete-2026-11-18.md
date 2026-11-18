# Geräte- und Browser-Test (Stand 18.11.2026)

**Kurz:** Zuhörer-Seite und Bedienplatz wurden mit **Chromium-Emulation** auf 11 Gast-Profilen (Telefone, Tablets, Desktop) und 5 Bedienplatz-Profilen (Chromebook in vier Anzeige-Größen, iPad Pro quer) geprüft. **Nicht geprüft:** echte Geräte, die Browser-Engines von Safari (WebKit) und Firefox, echter Ton, echtes Mikrofon, echter Mobilfunk. Ergebnis der Emulation: 34 Läufe, 1971 Prüfungen bestanden, 0 Prüfungen fehlgeschlagen, 0 Läufe mit Fehlern.

## Was ein Profil ist (und was nicht)

Ein Profil setzt in Chromium Fenstergröße, Pixeldichte, Touch-Bedienung und die Gerätekennung. Es ersetzt **nicht** das Gerät und **nicht** die Browser-Engine: Ein „iPhone“-Profil läuft weiterhin in Chromium, nicht in Safari. Die Fenstergrößen der Telefone und Tablets stammen aus der Geräteliste von Playwright, die Chromebook-Größen sind aus der Bildschirmauflösung (1920 × 1080) und der Anzeige-Skalierung **abgeleitet, nicht am echten ASUS Chromebook Plus CX34 gemessen**.

## Profile

| Rolle | Profil | Fenster (CSS-Pixel) | Pixeldichte |
| --- | --- | --- | --- |
| Gast | iPhone SE | 320 × 568 | 2 |
| Gast | iPhone 13 | 390 × 664 | 3 |
| Gast | iPhone 15 Pro Max | 430 × 739 | 3 |
| Gast | Pixel 7 | 412 × 839 | 2,625 |
| Gast | Galaxy S9+ | 320 × 658 | 4,5 |
| Gast | iPad (7. Generation), hoch und quer | 810 × 1080 / 1080 × 810 | 2 |
| Gast | iPad Pro 11 | 834 × 1194 | 2 |
| Gast | Galaxy Tab S4, hoch und quer | 712 × 1138 / 1138 × 712 | 2,25 |
| Gast | Desktop Chrome | 1280 × 720 | 1 |
| Bedienplatz | Chromebook 100 %, 125 %, 150 %, „klein“ | 1920 × 969, 1536 × 730, 1280 × 600, 1366 × 657 | 1 / 1,25 / 1,5 / 1 |
| Bedienplatz | iPad Pro 11 quer | 1194 × 834 | 2 |

## Was je Gast-Profil geprüft wird (`geraete_layout.js`)

- Sprachwahl und Startseite: Anfang und Ende durch Scrollen erreichbar, Knöpfe mindestens 44 × 44 Pixel, kein Querscrollen.
- Bedienplatz sendet, Gast sieht Untertitel: alle fünf Sprachen nacheinander (Arabisch und Persisch von rechts nach links), Schriftgröße mindestens 16 Pixel, neueste Zeile ganz im Fenster.
- Netzabbruch (WebSocket wird getrennt): „Verbindung weg“ erscheint, mehrere Wiederverbindungsversuche, danach wieder „live“, keine doppelten Zeilen.
- Sendepause, Drehen und Zurückdrehen: neueste Zeile bleibt ganz sichtbar.
- Späteinsteiger sieht den Verlauf; Neuladen behält Sprache und Verlauf.
- „Alle trennen, neuen Link erzeugen“: beide Gäste getrennt, alter Link ungültig, neuer Link ohne alten Verlauf.
- Gespräch: Sprechleiste im Hoch- und Querformat erreichbar.
- Datenschutz-Querprüfungen: keine externen Anfragen, nur erlaubte WebSocket-Ziele, keine JavaScript- oder CSP-Fehler, keine Cookies, nichts in `localStorage`/`sessionStorage`.

Weitere vorhandene Browser-Tests laufen zusätzlich mit Geräteprofil: `gast_ohne_server.js` und `gespraech.js` (Gast), `operator_ohne_server.js` und `browser_smoke.js` (Bedienplatz).

## Ergebnis

**Endlauf (Stand nach allen Korrekturen, 18.11.2026):** 34 Läufe, 1971 Prüfungen bestanden, 0 Prüfungen fehlgeschlagen, 0 Läufe mit Fehlern. Die Zeitangaben sind Laufzeiten des Tests auf einem Rechner ohne GPU mit Attrappen, keine Messung des Echtbetriebs.

**Vorgeschichte:** Die erste Matrix vor den Korrekturen 5 und 6 und vor der Testkorrektur hatte 33 Läufe, 1781 bestandene Prüfungen und **einen roten Lauf** (iPad Pro 11, siehe unten). Beide Läufe sind in der Entwicklungsumgebung gelaufen; Zahlen aus früheren Läufen gelten nicht für den Endstand.

**Teil 1: Layout, Sprachen, Verlauf, Netzabbruch, Drehen, „Alle trennen“, Gesprächsleiste (je Gast-Profil)**

| Gast-Profil | Bedienplatz-Profil | Prüfungen bestanden | Fehler | Testdauer |
| --- | --- | --- | --- | --- |
| iPhone SE | Chromebook 100% | 89 | 0 | 27 s |
| iPhone 13 | Chromebook 125% | 89 | 0 | 27 s |
| iPhone 15 Pro Max | Chromebook 150% | 89 | 0 | 27 s |
| Pixel 7 | Chromebook klein | 89 | 0 | 27 s |
| Galaxy S9+ | Chromebook 125% | 89 | 0 | 27 s |
| iPad (gen 7) | Chromebook 100% | 89 | 0 | 27 s |
| iPad (gen 7) landscape | Chromebook 125% | 89 | 0 | 27 s |
| iPad Pro 11 | iPad Pro 11 landscape | 89 | 0 | 27 s |
| Galaxy Tab S4 | Chromebook 150% | 89 | 0 | 27 s |
| Galaxy Tab S4 landscape | Chromebook klein | 89 | 0 | 27 s |
| Desktop Chrome | Chromebook 125% | 89 | 0 | 27 s |

**Teil 2a: Gast-Zustandsautomat mit Geräteprofil**

| Gast-Profil | Bedienplatz-Profil | Prüfungen bestanden | Fehler | Testdauer |
| --- | --- | --- | --- | --- |
| iPhone SE | Chromebook 125% | 54 | 0 | 25 s |
| iPhone 13 | Chromebook 125% | 54 | 0 | 25 s |
| Pixel 7 | Chromebook 125% | 54 | 0 | 25 s |
| iPad (gen 7) | Chromebook 125% | 54 | 0 | 25 s |
| Galaxy Tab S4 landscape | Chromebook 125% | 54 | 0 | 25 s |
| Desktop Chrome | Chromebook 125% | 54 | 0 | 25 s |

**Teil 2b: Gespräch (Wortmeldung, Übergabe, Stopp) mit Geräteprofil**

| Gast-Profil | Bedienplatz-Profil | Prüfungen bestanden | Fehler | Testdauer |
| --- | --- | --- | --- | --- |
| iPhone SE | Chromebook 125% | 19 | 0 | 11 s |
| iPhone 13 | Chromebook 125% | 19 | 0 | 11 s |
| Pixel 7 | Chromebook 125% | 19 | 0 | 11 s |
| iPad (gen 7) | Chromebook 125% | 19 | 0 | 11 s |
| Galaxy Tab S4 landscape | Chromebook 125% | 19 | 0 | 11 s |
| Desktop Chrome | Chromebook 125% | 19 | 0 | 11 s |

**Teil 3a: Bedienplatz im Gespräch mit Geräteprofil**

| Gast-Profil | Bedienplatz-Profil | Prüfungen bestanden | Fehler | Testdauer |
| --- | --- | --- | --- | --- |
| – | Chromebook 100% | 74 | 0 | 36 s |
| – | Chromebook 125% | 74 | 0 | 36 s |
| – | Chromebook 150% | 74 | 0 | 36 s |
| – | Chromebook klein | 74 | 0 | 36 s |
| – | iPad Pro 11 landscape | 74 | 0 | 36 s |

**Teil 3b: Bedienplatz im Vortrag mit Geräteprofil**

| Gast-Profil | Bedienplatz-Profil | Prüfungen bestanden | Fehler | Testdauer |
| --- | --- | --- | --- | --- |
| iPhone 13 | Chromebook 100% | 26 | 0 | 5 s |
| iPhone 13 | Chromebook 125% | 26 | 0 | 5 s |
| iPhone 13 | Chromebook 150% | 26 | 0 | 5 s |
| iPhone 13 | Chromebook klein | 26 | 0 | 6 s |
| iPhone 13 | iPad Pro 11 landscape | 26 | 0 | 5 s |

**Teil 4: Mikrofon-Abtastrate (Bedienplatz und Gast; Verhalten anderer Browser nachgestellt)**

| Gast-Profil | Bedienplatz-Profil | Prüfungen bestanden | Fehler | Testdauer |
| --- | --- | --- | --- | --- |
| – | – | 54 | 0 | 49 s |


## Gefundene und behobene Mängel

Gefunden vom Test auf den Profilen und behoben (jeweils mit Gegenprobe: der Test ist mit dem alten Code rot, mit dem neuen grün):

| Nr. | Befund | Betroffen | Behebung |
| --- | --- | --- | --- |
| 1 | Sprachwahl und Startseite oben abgeschnitten, nicht erreichbar (109 Pixel) | kleine Telefone (320 × 568, 320 × 658) | scrollbar, bei geringer Höhe kompakter (`web/css/listener.css`) |
| 2 | Gespräch im Querformat: Untertitelfläche nur 32 Pixel hoch | kleine Telefone quer | Kopf, Fuß und Sprechleiste kompakter ab 520 Pixel Höhe |
| 3 | Nach Drehen oder Größenänderung blieb die neueste Zeile nicht sichtbar (159 Pixel nach unten zu scrollen) | alle Geräte, beim Zurückdrehen | `ResizeObserver` hält die neueste Zeile sichtbar (`web/js/listener.js`) |
| 4 | „1 Geräte“; führender Punkt in der Fußzeile | Bedienplatz, Gast | Singular, Punkt entfernt |
| 5 | Nach „Alle trennen“ blieb bei langsamem Gerät oder Netz der **ungültige alte Link samt QR-Code** sichtbar (406 ms bei 20-facher CPU-Drosselung, 800 und 3000 ms bei verzögerter Antwort); schlug das Erzeugen des neuen Links fehl, behauptete die Meldung trotzdem einen neuen Link | Bedienplatz | Link und QR-Code sofort entfernen, Fehler benennen, „Link kopieren“ nur bei echtem Link (`web/js/operator.js`) |
| 6 | Mikrofon: Hält ein Browser die Abtastrate 16 kHz nicht ein oder kann die Quelle damit nicht anbinden, käme die Sprache auf ein Drittel der Tonhöhe gedehnt beim Server an (nachgestellt: 333 statt 1000 Hz, dreifache Blockrate) oder gar nicht | Vorsorge für Safari und Firefox, **dort nicht geprüft** | Rückfall auf die Geräterate, Umrechnung im Worklet (`web/js/capture.js`, `pcm-worklet.js`; Entscheidung E54) |

Ein Fehler lag **im Test**: In der ersten Matrix war ein Lauf (iPad Pro 11) rot, weil der Test den neuen Link sofort nach dem Trennen las. Gegenversuche (gedrosselte CPU, verzögerte Serverantwort) zeigen, dass bei langsamem Bedienplatz noch der alte Link da steht; der Test wartet jetzt (10 von 10 Wiederholungen grün). Dass genau diese Ursache den ersten roten Lauf ausgelöst hat, ist die plausibelste Erklärung, aber nicht mit den Zeitwerten des damaligen Laufs belegt. Daraus folgte Befund 5.

## Grenzen: was dieser Test nicht zeigt

- **Keine echte Safari- oder Firefox-Engine.** Verhalten von Audio (Autoplay-Regeln, Abtastrate, `AudioWorklet`), Bildschirm-wach-Funktion und Schriftdarstellung kann dort abweichen. Die Mikrofon-Absicherung für abweichende Abtastraten ist vorsorglich eingebaut und nur in Chromium nachgestellt.
- **Kein echtes Gerät:** Berührungsgenauigkeit, Bildschirmgröße in der Hand, Helligkeit im Raum, Lautsprecher und Stummschalter sind nicht geprüft.
- **Kein echter Ton:** Die Prüfung zählt abgespielte Audio-Blöcke, hört aber nichts.
- **Kein echtes Mikrofon:** Chromiums Fake-Mikrofon liefert einen Testton; das DJI Mic Mini wurde nicht geprüft.
- **Attrappen statt Modelle:** Die Untertitel stammen aus einer Test-Attrappe, nicht aus Spracherkennung und Übersetzung. Aussagen zur Übersetzungsqualität sind damit **nicht** möglich.
- **Zeiten sind Obergrenzen eines Testservers im selben Rechner**, keine Messung des Echtbetriebs.
- Arabisch, Türkisch und Persisch (Gesprächstexte, KI-Hinweis) wurden **nicht von Muttersprachlern** gegengelesen.

## Handprüfung auf einem echten Gerät (etwa 5 Minuten je Gerät)

1. Link oder QR-Code öffnen: Sprachwahl komplett sichtbar, ohne Zoomen bedienbar.
2. Sprache wählen, „Tippen zum Starten“: Untertitel erscheinen, Schrift gut lesbar.
3. Ton: nach dem Tippen kommt Ton (iPhone: Stummschalter beachten); Ton aus und an.
4. Drehen (Hoch/Quer) mehrmals: neueste Zeile bleibt sichtbar.
5. Bildschirm bleibt 2 Minuten ohne Berührung an.
6. Netzwechsel (WLAN aus und an, Flugmodus 5 Sekunden): „Verbindung weg“, danach wieder „live“, keine doppelten Zeilen.
7. Gespräch: „Ich möchte sprechen“, Mikrofon-Freigabe, sprechen, am Bedienplatz wird vorgelesen; nach „Fertig“ geht die Mikrofon-Anzeige des Geräts aus.
8. Am Bedienplatz „Alle trennen“: das Gerät zeigt „Vom Mitarbeiter getrennt“.
9. Schriftgröße des Geräts auf „groß“: nichts wird abgeschnitten.
10. Hell- und Dunkelmodus des Geräts: Text bleibt lesbar.

## Wiederholen

Testserver mit Attrappen starten (siehe README), dann zum Beispiel:

```
cd server/tests/e2e
BASE=http://127.0.0.1:8123 OPERATOR_KEY=... GERAET="iPhone SE" OP_GERAET="Chromebook 125%" node geraete_layout.js
BASE=http://127.0.0.1:8123 OPERATOR_KEY=... OUT=/pfad/ergebnis node geraete_matrix.js   # alle Profile, etwa 20 bis 30 Minuten
```

Optional: `GAST_CPU` und `OP_CPU` drosseln die Rechenleistung der Seite (Faktor), `LINK_DELAY_MS` verzögert die Serverantwort auf „neuer Link“.

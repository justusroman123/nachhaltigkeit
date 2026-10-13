# Passwächter: Anleitung

Der StickS3 in der Jacke merkt, wenn sich der Reisepass mit der Beacon-Karte entfernt. Dann vibriert der Vibrator und der Stick piept.

---

## 1. Welche Teile werden gebraucht?

| Teil | Wofür | Wo |
|---|---|---|
| **M5Stack StickS3** (K150, ESP32-S3, 250 mAh Akku) | „Gehirn“: sucht alle 5 s per Bluetooth nach der Karte | Jacke |
| **Unit Vibrator** (U059, Aufdruck „DC MOTOR N20“) + Grove-Kabel | Vibrationsalarm | Jacke, am StickS3 |
| **Minew C10 Card Beacon** (weiße Karte, „Model C10“, Einschalttaste) | Sendet Bluetooth-Signal | Im Reisepass |
| ~~DualKey NTAG215 NFC-Karte (pink)~~ | Wird **nicht** gebraucht. Das ist eine Werbe-/NFC-Karte von M5Stack. | – |

## 2. So funktioniert es

```
 Reisepass + C10-Karte  ))) Bluetooth )))  StickS3 (Jacke) ──Grove-Kabel── Vibrator
   sendet ständig                           prüft alle 5 s:
   ein Signal                               • Karte empfangen?
                                            • Signal stark genug (= nah genug)?
```

- Alle **5 Sekunden** hört der Stick **2 Sekunden lang** auf die angelernte Karte.
- **Alarm**, wenn die Karte **2 Prüfungen hintereinander** fehlt (ca. 10–15 s) oder das Signal 2× zu schwach ist.
  Dann kommen 3× Vibration mit Piepton. Das wiederholt sich 1 Minute lang alle 5 s und danach alle 30 s.
- Ist der Pass wieder in der Nähe, kommt **1× kurz Vibration und ein Doppelton** als Entwarnung.
- Der Stick reagiert **nur auf die eigene Karte** (MAC-Adresse). Fremde Bluetooth-Geräte auf der Messe stören also nicht.
- Solange die Karte nach dem Einschalten noch nie gesehen wurde, gibt es keinen Alarm. Die Anzeige lautet dann „SUCHE KARTE“.

---

## 3. Beacon-Karte (C10) vorbereiten

1. **Einschalten:** Die Taste mit dem Power-Symbol lange drücken (ca. 3 s), bis die LED blinkt.
   *Hinweis: Die Angaben im Netz zum Ein- und Ausschalten sind nicht ganz eindeutig. Bitte auf die LED achten oder ins beiliegende Handbuch schauen.*
2. **Empfohlen:** App **„BeaconSET+“** von Minew installieren (Android/iOS) und die Karte verbinden:
   - **Sendeintervall (Advertising Interval): 300–500 ms** einstellen. Dann erkennt der Stick die Karte zuverlässiger. Den Werkswert der Karte kenne ich nicht sicher.
   - **Sendeleistung (TX Power):** mittlere Stufe, z. B. 0 dBm. Weniger Leistung löst den Alarm früher aus und eignet sich gut für die Messe-Demo.
   - Wichtig: **Bewegungs-/Trigger-Modus ausschalten**. Die Karte hat einen Beschleunigungssensor. Würde sie nur bei Bewegung senden, gäbe es in ruhiger Lage Fehlalarme.
   - Die **MAC-Adresse** notieren. Sie wird nach dem Anlernen auf dem Stick angezeigt und lässt sich so vergleichen.
   - Das Standard-Passwort der App kenne ich nicht sicher. Es steht im Handbuch bzw. in der Minew-Doku.
3. Batterie: Minew gibt mit Werkseinstellungen **1,5–2 Jahre** an. Ein kürzeres Sendeintervall verkürzt das, für Messetage spielt es aber keine Rolle.

---

## 4. Hardware anschließen

- Das Grove-Kabel vom **Vibrator** in den **Grove-Port (HY2.0-4P) unten am StickS3** stecken.
- Der Port ist ab Werk auf „Eingang“ geschaltet. Die Software schaltet die 5 V nur **während eines Alarms** ein, das spart Akku.
- Die Signalleitung ist **G9** (gelb).

---

## 5. Arduino IDE einrichten (einmalig)

1. **Arduino IDE 2.x** installieren (arduino.cc).
2. *Datei → Einstellungen → Zusätzliche Boardverwalter-URLs:*
   ```
   https://static-cdn.m5stack.com/resource/arduino/package_m5stack_index.json
   ```
3. *Boardverwalter* (linke Leiste) → nach **„M5Stack“** suchen → **installieren** (aktuelle Version).
4. *Bibliotheksverwalter* → **„M5Unified“** suchen → **installieren**. Die Frage nach Abhängigkeiten (M5GFX) mit **„Alle installieren“** beantworten.
   Die Bluetooth-Bibliothek ist schon im Boardpaket enthalten und muss nicht extra installiert werden.
5. *Werkzeuge → Board → M5Stack →* **M5StickS3** auswählen.

## 6. Programm hochladen

1. Den Ordner `Passwaechter` öffnen und darin `Passwaechter.ino` (der Ordnername muss so bleiben).
2. Den StickS3 per **USB-C** an den PC anschließen.
3. *Werkzeuge → Port* → den neuen COM-/USB-Port wählen.
4. Auf **Hochladen** (Pfeil →) klicken.
5. **Falls der Upload nicht startet (Download-Modus):** Die **Taste an der Seite ca. 2 s gedrückt halten**, bis die **grüne LED** im Gerät blinkt, dann loslassen und erneut hochladen. Das ist das Vorgehen laut offizieller StickS3-Anleitung.
6. Bei **„Sketch too big“**: unter *Werkzeuge → Partition Scheme* ein Schema mit größerem App-Bereich wählen (z. B. „Huge APP“ oder „8M with spiffs (3MB APP)“).
7. Zum Mitlesen: *Werkzeuge → Serieller Monitor*, **115200 Baud**. Bleibt die Ausgabe leer, unter *Werkzeuge* „USB CDC On Boot: Enabled“ setzen, falls die Option angeboten wird.

> **Wichtig:** Ich konnte den Code hier nicht auf echter Hardware und nicht mit dem ESP32-Compiler testen. Die Funktionsaufrufe habe ich mit dem aktuellen Quellcode von M5Unified und Arduino-ESP32 abgeglichen, und eine Syntaxprüfung ist durchgelaufen. Falls beim Kompilieren ein Fehler kommt, bitte die Fehlermeldung schicken.

> Die UiFlow2-Firmware wird dabei überschrieben. Zurück zu UiFlow2 geht es jederzeit über **M5Burner**.

---

## 7. Erste Inbetriebnahme: Karte anlernen

1. Die C10-Karte einschalten.
2. Den Stick einschalten. Die Anzeige lautet **„KEINE KARTE“**.
3. Die Karte **direkt an den Stick halten** (Handy dabei weglegen).
4. **Taste A 2 Sekunden halten.** Die Anzeige wird lila („ANLERNEN“), dann kommt ein kurzer Bestätigungston.
5. Unten steht „Angelernt: xx:xx:xx:…“. Die Karte bleibt auch nach dem Ausschalten gespeichert.
6. Nach wenigen Sekunden erscheint grün **„PASS OK“**.
7. **Test:** Taste B 2 s halten. Jetzt muss der Vibrator laufen und der Stick piepen.

## 8. Bedienung

| Taste | Aktion |
|---|---|
| **A kurz** | Display an (geht nach 20 s aus) / laufenden **Alarm stummschalten** (bis der Pass zurück ist) |
| **A doppelt** | Ton an/aus (Vibration bleibt) |
| **A 2 s halten** | Karte anlernen |
| **B kurz** | Empfindlichkeit: **Nah** → **Mittel** → **Nur Verlust** |
| **B 2 s halten** | Test-Alarm |
| Power-Taste | Ein: drücken, Aus: doppelt drücken (laut M5Stack-Doku) |

*Ich weiß nicht sicher, welche der beiden Tasten am Gerät „A“ und welche „B“ ist. Einfach ausprobieren: Taste B kurz drücken zeigt „Empfindlichkeit: …“ an.*

**Anzeige-Farben:** Grün = PASS OK · Orange = PASS ? (einmal nicht empfangen/schwach) · Rot = PASS WEG! (Alarm) · Blau = Karte suchen · Lila = Anlernen

---

## 9. Tipps für die Messe

- **Vor Ort kalibrieren:** Mit Pass und Karte in der Jacke weggehen und schauen, ab welcher Entfernung „Nah“ bzw. „Mittel“ auslöst. Bluetooth-Abstände sind **nur grobe Schätzwerte**. Körper, Jacke, Metall und viele Menschen dämpfen das Signal stark.
- **Für die Vorführung:** Den Modus **„Nah“** nehmen. Der Alarm kommt dann schon nach wenigen Metern. Wer es schneller will, setzt im Code `MISSES_FOR_ALARM` und `FAR_FOR_ALARM` auf **1** (Alarm nach ca. 5–7 s, dafür eher Fehlalarme).
- **Ton:** In lauten Hallen hört man ihn kaum, die Vibration ist das Hauptsignal. Für ruhige Gespräche Taste A doppelt drücken, dann ist der Ton aus.
- Mit **Taste B 2 s** lässt sich der Alarm jederzeit vorführen, ohne wegzugehen.
- Den **seriellen Monitor** am Laptop offen lassen. Er zeigt live die Signalstärke (dBm), gut zum Erklären.

## 10. Akkulaufzeit

| Gerät | Laufzeit | Grundlage |
|---|---|---|
| C10-Karte | 1,5–2 Jahre | Herstellerangabe, Werkseinstellungen |
| StickS3 (250 mAh) | **geschätzt ca. 3–6 Stunden** | **meine Schätzung, nicht gemessen** |

- Für den StickS3 gibt es von M5Stack **keine veröffentlichten Stromwerte**. Den größten Verbrauch verursacht das Bluetooth-Empfangen (2 von 5 s). Display und Vibrator laufen nur kurz.
- **Selbst messen:** Voll laden, starten und nach 1 Stunde den Akkustand auf dem Display ablesen (Taste A). Rechnung: 100 % ÷ (Verbrauch pro Stunde) = Laufzeit.
- **Für einen ganzen Messetag (8–10 h):** In der Mittagspause per USB-C nachladen oder eine **kleine Powerbank** mit Kabel in die Jackentasche stecken. Die Anzeige zeigt „(laedt)“ beim Laden.
- Bei **15 % Akku** kommt einmal ein Warnton mit dem Hinweis „Akku schwach“.
- **Mehr Laufzeit:** Im Code `CHECK_SCAN_SECONDS = 1` setzen (kürzer hören), dann aber das Sendeintervall der Karte auf **≤ 300 ms** stellen. Oder `CHECK_INTERVAL_MS = 10000` (alle 10 s prüfen, der Alarm kommt dann später).

## 11. Einstellungen im Code (oben in `Passwaechter.ino`)

| Konstante | Standard | Bedeutung |
|---|---|---|
| `CHECK_INTERVAL_MS` | 5000 | Prüfintervall in ms |
| `CHECK_SCAN_SECONDS` | 2 | Hördauer pro Prüfung |
| `MISSES_FOR_ALARM` | 2 | Fehlende Prüfungen bis zum Alarm |
| `FAR_FOR_ALARM` | 2 | Zu schwache Prüfungen bis zum Alarm |
| `SENS_LEVELS` | -75 / -85 / -127 dBm | Schwellen für Nah / Mittel / Nur Verlust |
| `VIB_DUTY` | 170 | Vibrationsstärke 0–255 (nicht zu hoch, der Grove-Ausgang liefert max. ca. 0,38 A) |
| `SPEAKER_VOLUME` | 200 | Lautstärke 0–255 |
| `DISPLAY_ON_MS` | 20000 | Wann das Display ausgeht |
| `FIXED_BEACON_MAC` | "c3:00:00:25:ef:84" | MAC der eigenen C10-Karte (vorbelegt, Anlernen per Taste A hat Vorrang) |

## 12. Fehlersuche

| Problem | Lösung |
|---|---|
| „Keine Karte gefunden“ beim Anlernen | Ist die Karte eingeschaltet (LED)? Die Karte direkt auflegen und das Handy weglegen. Erneut versuchen. |
| Ständig orange/rot, obwohl die Karte nah ist | Sendeintervall der Karte auf 300–500 ms stellen, Bewegungs-Trigger aus, Modus „Mittel“ oder „Nur Verlust“ wählen. |
| Vibrator läuft beim Test nicht | Grove-Kabel prüfen. Falls trotzdem nichts passiert: im Code `VIB_PIN` von `9` auf `10` ändern und neu hochladen. |
| Stick startet beim Alarm neu | `VIB_DUTY` verringern (z. B. 120). |
| Upload klappt nicht | Download-Modus nutzen (Abschnitt 6, Punkt 5) und ein anderes USB-Kabel probieren (ein Datenkabel, kein reines Ladekabel). |

---

**Quellen:** M5Stack-Doku zu StickS3 / Unit Vibrator / Arduino-Boardverwaltung (docs.m5stack.com), Quellcode von M5Unified und arduino-esp32 auf GitHub, Minew-Produktseite C10 und FCC-ID 2ABU6-C10.

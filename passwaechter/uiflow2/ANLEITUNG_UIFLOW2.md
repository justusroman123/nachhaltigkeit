# Passwächter mit UiFlow2 aufspielen

Diese Version braucht **kein Arduino**. Sie nutzt die vorinstallierte UiFlow2-Software auf dem StickS3.
Die Datei ist `main.py` in diesem Ordner.

> Getestet habe ich das Programm nur in einer Simulation am Computer, nicht auf echter Hardware.
> Die Befehle stammen aus dem offiziellen UiFlow2-Quellcode für den StickS3.

## Weg A: UiFlow2 im Browser (empfohlen)

1. **Chrome oder Edge** öffnen und **uiflow2.m5stack.com** aufrufen. Eventuell musst du dich mit einem M5Stack-Konto anmelden.
2. Ein **neues Projekt** anlegen und als Gerät **StickS3** wählen.
3. Den Stick per USB anschließen und im Display-Menü **„USB Mode“** wählen.
4. In UiFlow2 unten links auf **Verbinden / Connect** klicken, **USB** wählen und im Browser-Fenster den Port **„StickS3(UiFlow2)“** auswählen.
5. Oben von **Blockly** auf die **Python**-Ansicht umschalten.
6. Den gesamten vorhandenen Code löschen und den Inhalt von **`main.py`** einfügen.
7. **Run (▶)** klicken. Das Programm läuft jetzt zum Testen.
8. Wenn alles klappt, auf **Download** klicken. Damit wird das Programm **dauerhaft** gespeichert und startet bei jedem Einschalten automatisch.

*Die Bezeichnungen in UiFlow2 können leicht abweichen. Falls etwas nicht passt, schick einen Screenshot.*

## Weg B: Thonny (falls UiFlow2 im Browser nicht klappt)

1. **Thonny** installieren (thonny.org, kostenlos).
2. Unten rechts den Interpreter **„MicroPython (ESP32)“** und den Port **COM4** wählen. Der Stick sollte dabei im **USB Mode** sein.
3. `main.py` in Thonny öffnen.
4. **Datei → Speichern unter… → MicroPython-Gerät** wählen, in den Ordner **`/flash`** wechseln und als **`main.py`** speichern. Eine vorhandene Datei überschreiben.
5. Den Stick neu starten: Power-Taste drücken oder das Kabel ab- und wieder anstecken.

## Nach dem Aufspielen

- Das Display zeigt **„SUCHE KARTE“**, dann grün **„PASS OK“**, sobald die Karte (MAC `C3:00:00:25:EF:84`) empfangen wird.
- **Test:** **Taste B 2 s halten** löst einen Test-Alarm aus. Der Vibrator muss laufen und es muss piepen.
- **Weggehen:** Nach ca. **10–15 s** kommt der Alarm.

| Taste | Funktion |
|---|---|
| A kurz | Display an / Alarm stumm |
| A doppelt | Ton an/aus |
| A 2 s halten | Andere Karte anlernen (direkt an den Stick halten) |
| B kurz | Empfindlichkeit: Nah / Mittel / Nur Verlust |
| B 2 s halten | Test-Alarm |

**Zurück ins UiFlow2-Menü** (z. B. für ein Update): **Taste A gedrückt halten und dabei einschalten.**

## Fehlersuche

| Problem | Lösung |
|---|---|
| Fehlermeldung beim Run | Die Meldung (rote Zeilen) als Screenshot schicken |
| Vibrator läuft beim Test nicht | In `main.py` oben `VIB_PIN = 9` auf `10` ändern |
| Alarm, obwohl die Karte nah ist | B kurz drücken und Modus „Mittel“ oder „Nur Verlust“ wählen |
| Stick startet neu beim Alarm | `VIB_DUTY_PERCENT` z. B. auf 45 senken |

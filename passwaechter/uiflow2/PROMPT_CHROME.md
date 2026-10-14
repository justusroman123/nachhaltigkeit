# Auftrag: Passwächter-Programm auf M5Stack StickS3 über UiFlow2 aufspielen

Du bist mein Assistent im Browser (Google Chrome). Bitte hilf mir Schritt für Schritt, das unten stehende MicroPython-Programm über **https://uiflow2.m5stack.com** auf meinen **M5Stack StickS3** zu laden. Antworte immer **auf Deutsch, kurz, sachlich**, wichtige Punkte **fett**. Wenn du etwas nicht weißt, **rate nicht**, sondern sag es mir. Physische Schritte (Tasten am Stick drücken, Kabel stecken) und das Bestätigen von Chrome-Dialogen wie „Verbinden“ bei seriellen Ports mache ich selbst. Sag mir genau, wann und was.

## Projekt (Kontext)
- **Ziel:** Messe-Demo „Passwächter“. Eine Bluetooth-Beacon-Karte liegt im Reisepass, der StickS3 steckt in der Jacke. Wenn sich der Pass entfernt, vibriert ein Vibrationsmodul und der Stick piept.
- **Hardware:**
  - **M5Stack StickS3** (SKU K150, ESP32-S3-PICO-1-N8R8, 8 MB Flash/PSRAM, Display 135×240, Lautsprecher ES8311 + AW8737, Akku 250 mAh, Power-Management M5PM1). Tasten: BtnA (G11), BtnB (G12), Power-Taste, seitliche Taste (Reset/Download-Modus).
  - **M5Stack Unit Vibrator (U059)**, Aufdruck „DC MOTOR N20, PORT.B I/O“. Steckt im **Grove-Port des StickS3**. Signal = gelbe Leitung = **G9** (weiße = G10). Der Grove-5V-Ausgang ist ab Werk aus und muss per `M5.Power.setExtOutput(True)` eingeschaltet werden.
  - **Minew C10 Card Beacon** (FCC-ID 2ABU6-C10). **MAC: C3:00:00:25:EF:84**. Sie sendet laut App „BeaconSET Plus“ bereits alle **~252 ms** (iBeacon UUID E2C56DB5-DFFB-48D2-B060-D0F5A71096E0, Major 0, Minor 0) mit RSSI ca. −51 dBm aus der Nähe. **Die Karte ist an und funktioniert.**
- **PC:** Windows, Chrome. Der Stick erscheint im normalen Betrieb im Geräte-Manager als **„Serielles USB-Gerät (COM4)“**. COM1 („Kommunikationsanschluss“) und COM3 („Intel AMT SOL“) gehören zum PC und sind **nicht** der Stick.

## Was bisher passiert ist
1. **Arduino-Weg gescheitert:** Der Sketch kompilierte fehlerfrei (858 KB). Der Upload mit esptool scheiterte aber mit **„Write timeout“** auf COM4. Grund laut UiFlow2-Quellcode: Die vorinstallierte UiFlow2-Firmware meldet sich per TinyUSB als „StickS3(UiFlow2)“ (VID 0x303A, PID 0x832B), darüber kann esptool den Chip nicht automatisch in den Bootloader schalten. Im echten Download-Modus (seitliche Taste ca. 2 s halten, bis grünes Blinken) **erkennt dieser PC den Stick gar nicht** (kein neuer Port im Geräte-Manager).
2. **Deshalb jetzt UiFlow2:** Im Display-Menü des Sticks gibt es **„USB Mode“**. Das ist der vorgesehene Weg, um den Stick mit uiflow2.m5stack.com zu verbinden.
3. **Letzter Stand:** In UiFlow2 (V2.5.3) war Controller **StickS3** und Connection **USB** gewählt. Beim Klick auf Verbinden zeigte Chrome aber **nur COM1 und COM3**, der Stick fehlte. Vermutlich hing er noch im Download-Modus. **Lösung, die wir gerade probieren:** Arduino IDE schließen. Stick komplett aus (Power-Taste ca. 6 s halten oder doppelt drücken). Kabel ab und wieder an. Power kurz drücken, bis das UiFlow-Menü erscheint (**seitliche Taste NICHT drücken**). „USB Mode“ wählen. Dann in UiFlow2 erneut verbinden. Der richtige Eintrag heißt vermutlich „StickS3(UiFlow2)“ oder „Serielles USB-Gerät (COM4)“.

## Was du tun sollst
1. Mich durch das **Verbinden** in UiFlow2 führen (unten links Controller/Connection bzw. Verbinden-Symbol; Chrome-Dialog „möchte eine Verbindung mit einem seriellen Port herstellen“, den passenden Port wähle ich aus).
2. In UiFlow2 von **Blocks** auf die **Python**-Ansicht (`</>`) umschalten, den vorhandenen Beispielcode **komplett löschen** und das **Programm unten 1:1 einfügen**.
3. **„Run Once“** zum Testen. Im Terminal sollte erscheinen: `Passwaechter gestartet, Karte: c3:00:00:25:ef:84`, danach alle ~5 s Zeilen wie `Scan: gesehen=True rssi=-55 ...`.
4. Wenn es läuft: **Download** (dauerhaft als main.py speichern). Danach startet das Programm bei jedem Einschalten direkt. Das Programm setzt dabei die UiFlow-Startoption auf „direkt starten“. **Zurück ins UiFlow-Menü:** Taste A beim Einschalten gedrückt halten.
5. Bei Fehlermeldungen: Lies die Meldung im UiFlow-Terminal, erkläre sie mir kurz und passe den Code an, wenn nötig. Nur MicroPython/UiFlow2-APIs verwenden.

**Plan B, falls UiFlow2 im Browser nicht verbindet:** das Programm **Thonny** (thonny.org) installieren. Interpreter „MicroPython (ESP32)“, Port COM4 (Stick im USB Mode). `main.py` öffnen und über „Speichern unter → MicroPython-Gerät“ als **/flash/main.py** speichern. Danach den Stick neu starten.

## Funktionsweise des Programms (zur Erklärung)
- Alle **5 s** wird **2 s** passiv per BLE nach der Karten-MAC gesucht (`bluetooth.BLE().gap_scan`).
- Alarm, wenn die Karte **2× hintereinander** fehlt (~10–15 s) oder das geglättete Signal 2× unter der Schwelle liegt. Schwellen: **Nah −75 dBm**, **Mittel −85 dBm**, **Nur Verlust**.
- Alarm = 3× Vibration (PWM 10 kHz auf G9, 65 % Duty) + Piepton 2600 Hz. Wiederholung 1 min lang alle 5 s, danach alle 30 s. Entwarnung, wenn der Pass zurück ist.
- Kein Alarm, bevor die Karte nach dem Start einmal gesehen wurde.
- Tasten: **A kurz** = Display an / Alarm stumm · **A doppelt** = Ton an/aus · **A 2 s** = andere Karte anlernen (direkt an den Stick halten) · **B kurz** = Empfindlichkeit · **B 2 s** = Test-Alarm.
- Display quer (240×135): Grün „PASS OK“, Orange „PASS ?“, Rot „PASS WEG!“, Blau „SUCHE KARTE“, Lila „ANLERNEN“. Display geht nach 20 s aus.
- WLAN wird abgeschaltet, CPU auf 80 MHz (Akku sparen). Einstellungen liegen in `/flash/passwaechter.json`.
- Verwendete UiFlow2-APIs (aus dem UiFlow2-Quellcode geprüft): `M5.begin/update`, `M5.BtnA/BtnB.wasSingleClicked/wasDoubleClicked/wasHold/setHoldThresh`, `M5.Speaker.tone(freq, ms)/setVolume/stop`, `M5.Power.setExtOutput/getBatteryLevel/isCharging`, `M5.Lcd.fillScreen/setTextColor/drawString(text,x,y,font)/setRotation/setBrightness`, `M5.Lcd.FONTS.Montserrat14/18/24`.
- **Nicht auf echter Hardware getestet**, nur in einer Simulation am Computer.

## Fehlersuche
| Problem | Lösung |
|---|---|
| Stick nicht in der Port-Liste | Stick ganz aus/an, „USB Mode“ wählen, Kabel neu stecken. Geräte-Manager auf „Serielles USB-Gerät (COMx)“ prüfen. Arduino IDE geschlossen? |
| Vibrator läuft beim Test (B 2 s) nicht | `VIB_PIN = 9` → `10` |
| Stick startet beim Alarm neu | `VIB_DUTY_PERCENT` auf 45 senken |
| Alarm, obwohl Karte nah | B kurz → Modus „Mittel“ oder „Nur Verlust“ |
| Fehler bei `lcd.FONTS.Montserrat18` o. ä. | Font-Parameter weglassen bzw. anderen vorhandenen Font nehmen |

## Das Programm (main.py) – komplett einfügen
```python
# Passwaechter – Reisepass-Abstandswarner (UiFlow2 / MicroPython)
# =================================================================
# Hardware:
#   - M5Stack StickS3 (K150)        -> steckt in der Jacke
#   - M5Stack Unit Vibrator (U059)  -> Grove-Port des StickS3 (Signal G9)
#   - Minew C10 Card Beacon         -> liegt im Reisepass
#
# Alle 5 s wird 2 s lang per Bluetooth nach der Karte gesucht. Fehlt sie
# oder ist das Signal zu schwach, vibriert der Vibrator und der Stick piept.
#
# Bedienung:
#   A kurz       : Display an / Alarm stumm
#   A doppelt    : Ton an/aus
#   A 2 s halten : andere Karte anlernen (Karte direkt an den Stick halten)
#   B kurz       : Empfindlichkeit (Nah / Mittel / Nur Verlust)
#   B 2 s halten : Test-Alarm
#   Zurueck ins UiFlow-Menue: Taste A gedrueckt halten und dabei einschalten.

import M5
import time
import json
import bluetooth
import machine
import network
import esp32
import ubinascii

# ---------------------------------------------------------------------------
# Einstellungen
# ---------------------------------------------------------------------------
BEACON_MAC = "c3:00:00:25:ef:84"   # MAC der C10-Karte (hinten auf der Karte / BeaconSET Plus)

CHECK_INTERVAL_MS = 5000           # Pruefintervall
SCAN_MS = 2000                     # Hoerdauer pro Pruefung
LEARN_SCAN_MS = 3000
LEARN_MIN_RSSI = -55

MISSES_FOR_ALARM = 2               # 2 x nicht empfangen -> Alarm (~10 s)
FAR_FOR_ALARM = 2                  # 2 x zu schwach -> Alarm
RSSI_HYSTERESIS = 5

SENS_LEVELS = [("Nah", -75), ("Mittel", -85), ("Nur Verlust", -127)]

ALARM_REPEAT_FAST = 12             # ~1 min lang jede Pruefung
ALARM_REPEAT_SLOW = 6              # danach jede 6. Pruefung (~30 s)

VIB_PIN = 9                        # gelbe Leitung am Grove-Port
VIB_FREQ = 10000
VIB_DUTY_PERCENT = 65              # Staerke (nicht zu hoch, Grove-5V max. ~0,38 A)

SPEAKER_VOLUME = 200               # 0..255
DISPLAY_ON_MS = 20000
LOW_BATTERY_PCT = 15
DIRECT_START = True                # beim Einschalten direkt starten (ohne UiFlow-Menue)

CFG_FILE = "/flash/passwaechter.json"

# ---------------------------------------------------------------------------
# Farben (RGB888)
# ---------------------------------------------------------------------------
GREEN = 0x006400
ORANGE = 0xFF8C00
RED = 0xD00000
NAVY = 0x000080
PURPLE = 0x800080
WHITE = 0xFFFFFF

# Zustaende
NO_CARD, OK, WARN, ALARM = 0, 1, 2, 3


def mac_to_bytes(mac):
    return bytes([int(x, 16) for x in mac.split(":")])


def rev(b):
    return bytes([b[i] for i in range(len(b) - 1, -1, -1)])


def bytes_to_mac(b):
    return ubinascii.hexlify(bytes(b), ":").decode()


# ---------------------------------------------------------------------------
# Einstellungen speichern / laden
# ---------------------------------------------------------------------------
cfg = {"mac": BEACON_MAC, "sens": 0, "sound": True}


def load_cfg():
    try:
        with open(CFG_FILE) as f:
            cfg.update(json.load(f))
    except Exception:
        pass


def save_cfg():
    try:
        with open(CFG_FILE, "w") as f:
            json.dump(cfg, f)
    except Exception as e:
        print("Speichern fehlgeschlagen:", e)


# ---------------------------------------------------------------------------
# Vibration + Ton (nicht blockierend)
# ---------------------------------------------------------------------------
PATTERN_ALARM = [(40, False, 0), (350, True, 2600), (200, False, 0),
                 (350, True, 2600), (200, False, 0), (350, True, 2600)]
PATTERN_FOUND = [(40, False, 0), (120, True, 1500), (60, False, 0), (120, False, 2200)]
PATTERN_CONFIRM = [(40, False, 0), (100, True, 2000)]
PATTERN_ERROR = [(40, False, 0), (400, False, 600)]

vib = machine.PWM(machine.Pin(VIB_PIN), freq=VIB_FREQ, duty_u16=0)
pat = None
pat_idx = 0
pat_t = 0


def vib_set(on):
    vib.duty_u16(VIB_DUTY_PERCENT * 65535 // 100 if on else 0)


def pattern_apply():
    global pat_t
    ms, v, hz = pat[pat_idx]
    vib_set(v)
    if hz and cfg["sound"]:
        M5.Speaker.tone(hz, ms)
    pat_t = time.ticks_ms()


def pattern_start(p):
    global pat, pat_idx
    M5.Power.setExtOutput(True)          # Grove-5V fuer den Vibrator an
    pat = p
    pat_idx = 0
    pattern_apply()


def pattern_stop():
    global pat
    vib_set(False)
    M5.Speaker.stop()
    M5.Power.setExtOutput(False)         # 5V wieder aus -> spart Akku
    pat = None


def pattern_update():
    global pat_idx
    if pat is None:
        return
    if time.ticks_diff(time.ticks_ms(), pat_t) < pat[pat_idx][0]:
        return
    pat_idx += 1
    if pat_idx >= len(pat):
        pattern_stop()
    else:
        pattern_apply()


# ---------------------------------------------------------------------------
# Display
# ---------------------------------------------------------------------------
lcd = M5.Lcd
display_on = True
display_since = 0
info_text = ""
info_until = 0
learning = False


def display_wake():
    global display_on, display_since
    if not display_on:
        lcd.setBrightness(80)
        display_on = True
    display_since = time.ticks_ms()


def display_sleep():
    global display_on
    if display_on:
        lcd.setBrightness(0)
        display_on = False


def show_info(text, ms=4000):
    global info_text, info_until
    info_text = text
    info_until = time.ticks_add(time.ticks_ms(), ms)
    display_wake()


def draw():
    if not display_on:
        return
    if learning:
        bg, title = PURPLE, "ANLERNEN"
    elif state == OK:
        bg, title = GREEN, "PASS OK"
    elif state == WARN:
        bg, title = ORANGE, "PASS ?"
    elif state == ALARM:
        bg, title = RED, "PASS WEG!"
    else:
        bg, title = NAVY, "SUCHE KARTE"

    lcd.fillScreen(bg)
    lcd.setTextColor(WHITE, bg)
    lcd.drawString(title, 6, 6, lcd.FONTS.Montserrat24)

    f = lcd.FONTS.Montserrat18
    if learning:
        lcd.drawString("Karte direkt", 6, 44, f)
        lcd.drawString("an Stick halten", 6, 66, f)
    else:
        sig = "--" if (miss_count > 0 or rssi_smooth <= -127) else "%d dBm" % rssi_smooth
        lcd.drawString("Signal: " + sig, 6, 44, f)
        lcd.drawString("Modus: " + SENS_LEVELS[cfg["sens"]][0], 6, 66, f)

    s = lcd.FONTS.Montserrat14
    bat = M5.Power.getBatteryLevel()
    foot = "Akku %d%%" % bat
    if M5.Power.isCharging():
        foot += " (laedt)"
    foot += "  Ton " + ("an" if cfg["sound"] else "aus")
    if alarm_muted:
        foot += "  STUMM"
    lcd.drawString(foot, 6, 96, s)
    if info_text and time.ticks_diff(info_until, time.ticks_ms()) > 0:
        lcd.drawString(info_text, 6, 115, s)


# ---------------------------------------------------------------------------
# Bluetooth-Scan
# ---------------------------------------------------------------------------
_IRQ_SCAN_RESULT = 5
_IRQ_SCAN_DONE = 6

target = mac_to_bytes(BEACON_MAC)
target_rev = rev(target)
scan_running = False
scan_done = False
scan_started = 0
cycle_seen = False
cycle_best = -127
learn_best = -127
learn_mac = None


def ble_irq(event, data):
    global scan_done, cycle_seen, cycle_best, learn_best, learn_mac
    if event == _IRQ_SCAN_RESULT:
        addr_type, addr, adv_type, rssi, adv_data = data
        a = bytes(addr)
        if learning:
            if rssi >= LEARN_MIN_RSSI and rssi > learn_best:
                learn_best = rssi
                learn_mac = a
        elif a == target or a == target_rev:
            cycle_seen = True
            if rssi > cycle_best:
                cycle_best = rssi
    elif event == _IRQ_SCAN_DONE:
        scan_done = True


def start_scan(ms):
    global scan_running, scan_done, scan_started, cycle_seen, cycle_best, learn_best, learn_mac
    cycle_seen = False
    cycle_best = -127
    learn_best = -127
    learn_mac = None
    scan_done = False
    scan_running = True
    scan_started = time.ticks_ms()
    # passiv scannen: Intervall 100 ms, Fenster 90 ms
    ble.gap_scan(ms, 100000, 90000, False)


# ---------------------------------------------------------------------------
# Auswertung
# ---------------------------------------------------------------------------
state = NO_CARD
armed = False
miss_count = 0
far_count = 0
rssi_smooth = -127
alarm_muted = False
alarm_cycles = 0


def set_state(s):
    global state, alarm_cycles, alarm_muted
    if s == state:
        return
    old = state
    state = s
    print("Zustand", old, "->", s)
    if s == ALARM:
        alarm_cycles = 0
        alarm_muted = False
        display_wake()
    if old == ALARM and s == OK:
        alarm_muted = False
        pattern_start(PATTERN_FOUND)
        show_info("Pass wieder da")


def evaluate_monitor():
    global miss_count, far_count, rssi_smooth, armed, alarm_cycles
    if cycle_seen:
        if miss_count > 0 or rssi_smooth <= -127:
            rssi_smooth = cycle_best
        else:
            rssi_smooth = int(0.6 * rssi_smooth + 0.4 * cycle_best)
        miss_count = 0
        armed = True
        thr = SENS_LEVELS[cfg["sens"]][1]
        if state == ALARM:
            thr += RSSI_HYSTERESIS
        far_count = far_count + 1 if rssi_smooth < thr else 0
    else:
        miss_count += 1

    print("Scan: gesehen=%s rssi=%d glatt=%d miss=%d fern=%d"
          % (cycle_seen, cycle_best, rssi_smooth, miss_count, far_count))

    if not armed:
        return  # Karte seit Start noch nie gesehen -> kein Alarm

    if miss_count >= MISSES_FOR_ALARM or far_count >= FAR_FOR_ALARM:
        set_state(ALARM)
    elif miss_count > 0 or far_count > 0:
        if state != ALARM:
            set_state(WARN)
    else:
        set_state(OK)

    if state == ALARM and not alarm_muted:
        if alarm_cycles < ALARM_REPEAT_FAST or alarm_cycles % ALARM_REPEAT_SLOW == 0:
            pattern_start(PATTERN_ALARM)
        alarm_cycles += 1


def evaluate_learn():
    global learning, target, target_rev, miss_count, far_count, rssi_smooth, armed, state
    learning = False
    if learn_mac:
        target = learn_mac
        target_rev = rev(target)
        cfg["mac"] = bytes_to_mac(target)
        save_cfg()
        miss_count = far_count = 0
        rssi_smooth = -127
        armed = False
        state = NO_CARD
        print("Angelernt:", cfg["mac"], learn_best)
        pattern_start(PATTERN_CONFIRM)
        show_info("Angelernt " + cfg["mac"], 8000)
    else:
        pattern_start(PATTERN_ERROR)
        show_info("Keine Karte gefunden", 6000)


# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------
M5.begin()
load_cfg()
try:
    target = mac_to_bytes(cfg["mac"])
    target_rev = rev(target)
except Exception:
    target = mac_to_bytes(BEACON_MAC)
    target_rev = rev(target)

# WLAN aus (spart Strom, stoert Bluetooth nicht), CPU auf 80 MHz
try:
    network.WLAN(network.STA_IF).active(False)
    network.WLAN(network.AP_IF).active(False)
except Exception:
    pass
try:
    machine.freq(80000000)
except Exception:
    pass

def saved_as_main():
    # Nur wenn dieses Programm per "Download" als main.py gespeichert wurde
    try:
        with open("/flash/main.py") as f:
            return "Passwaechter" in f.read(200)
    except Exception:
        return False


if DIRECT_START and saved_as_main():
    # Beim naechsten Einschalten direkt dieses Programm starten.
    # Zurueck ins UiFlow-Menue: Taste A beim Einschalten gedrueckt halten.
    try:
        nvs = esp32.NVS("uiflow")
        nvs.set_u8("boot_option", 0)
        nvs.commit()
    except Exception:
        pass

M5.Power.setExtOutput(False)
M5.Speaker.setVolume(SPEAKER_VOLUME)
M5.BtnA.setHoldThresh(2000)
M5.BtnB.setHoldThresh(2000)
lcd.setRotation(1)          # quer: 240 x 135
lcd.setBrightness(80)

ble = bluetooth.BLE()
ble.active(True)
ble.irq(ble_irq)

print("Passwaechter gestartet, Karte:", cfg["mac"])
display_wake()
draw()
last_check = time.ticks_add(time.ticks_ms(), -CHECK_INTERVAL_MS)
last_draw = 0
last_bat = 0
learn_requested = False
low_bat_warned = False

# ---------------------------------------------------------------------------
# Hauptschleife
# ---------------------------------------------------------------------------
while True:
    M5.update()
    now = time.ticks_ms()

    # --- Tasten ---
    if M5.BtnA.wasHold():
        learn_requested = True
        show_info("Anlernen...")
    elif M5.BtnA.wasDoubleClicked():
        cfg["sound"] = not cfg["sound"]
        save_cfg()
        show_info("Ton an" if cfg["sound"] else "Ton aus")
    elif M5.BtnA.wasSingleClicked():
        if state == ALARM and not alarm_muted:
            alarm_muted = True
            if pat:
                pattern_stop()
            show_info("Alarm stumm")
        else:
            display_wake()

    if M5.BtnB.wasHold():
        show_info("Test-Alarm")
        pattern_start(PATTERN_ALARM)
    elif M5.BtnB.wasSingleClicked():
        cfg["sens"] = (cfg["sens"] + 1) % len(SENS_LEVELS)
        save_cfg()
        far_count = 0
        show_info("Modus: " + SENS_LEVELS[cfg["sens"]][0])

    pattern_update()

    # --- Scan fertig -> auswerten ---
    if scan_running and scan_done:
        scan_running = False
        if learning:
            evaluate_learn()
        else:
            evaluate_monitor()
        draw()

    # Sicherheitsnetz, falls kein SCAN_DONE kommt
    if scan_running and time.ticks_diff(now, scan_started) > LEARN_SCAN_MS + 5000:
        print("Scan-Timeout")
        try:
            ble.gap_scan(None)
        except Exception:
            pass
        scan_running = False
        learning = False

    # --- Anlernen hat Vorrang ---
    if not scan_running and learn_requested:
        learn_requested = False
        if pat:
            pattern_stop()
        learning = True
        start_scan(LEARN_SCAN_MS)
        draw()
    elif not scan_running and time.ticks_diff(now, last_check) >= CHECK_INTERVAL_MS:
        last_check = now
        start_scan(SCAN_MS)

    # --- Akku-Warnung ---
    if time.ticks_diff(now, last_bat) > 60000:
        last_bat = now
        bat = M5.Power.getBatteryLevel()
        if 0 <= bat <= LOW_BATTERY_PCT and not low_bat_warned and pat is None:
            low_bat_warned = True
            pattern_start(PATTERN_ERROR)
            show_info("Akku schwach!", 10000)
        if bat > LOW_BATTERY_PCT + 5:
            low_bat_warned = False

    # --- Display ---
    if display_on:
        if state != ALARM and not learning and time.ticks_diff(now, display_since) > DISPLAY_ON_MS:
            display_sleep()
        elif time.ticks_diff(now, last_draw) > 1000:
            last_draw = now
            draw()

    time.sleep_ms(20)
```

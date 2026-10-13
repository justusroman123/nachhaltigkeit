/*
 * Passwaechter – Reisepass-Abstandswarner
 * =======================================
 * Hardware:
 *   - M5Stack StickS3 (K150, ESP32-S3)        -> steckt in der Jacke
 *   - M5Stack Unit Vibrator (U059)            -> Grove-Port des StickS3
 *   - Minew C10 Card Beacon (BLE)             -> liegt im Reisepass
 *
 * Funktion:
 *   Alle CHECK_INTERVAL_MS (Standard 5 s) wird CHECK_SCAN_SECONDS lang nach der
 *   angelernten Beacon-Karte gesucht. Ist sie nicht mehr zu empfangen oder das
 *   Signal zu schwach (= zu weit weg), vibriert der Vibrator und der Lautsprecher
 *   piept. Kommt die Karte zurück, gibt es eine kurze "gefunden"-Rückmeldung.
 *
 * Bedienung (Taste A = BtnA, Taste B = BtnB laut M5Unified):
 *   A kurz      : Display einschalten / laufenden Alarm stummschalten
 *   A doppelt   : Ton an/aus
 *   A 2 s halten: Karte anlernen (Karte dabei direkt an den Stick halten)
 *   B kurz      : Empfindlichkeit wechseln (Nah / Mittel / Nur Verlust)
 *   B 2 s halten: Test-Alarm (Vibrator + Ton prüfen)
 *
 * Benötigt: Arduino-IDE, Boardpaket "M5Stack" (Board: M5StickS3),
 *           Bibliothek "M5Unified" (installiert M5GFX mit).
 */

#include <M5Unified.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

#if !defined(ESP_ARDUINO_VERSION_MAJOR) || ESP_ARDUINO_VERSION_MAJOR < 3
#error "Bitte das aktuelle M5Stack-Boardpaket (Arduino-ESP32 Core 3.x) verwenden."
#endif

// ============================================================================
// Einstellungen – hier kann angepasst werden
// ============================================================================

// MAC-Adresse der Karte (steht hinten auf der Karte und in der App BeaconSET Plus).
// Wird verwendet, solange keine andere Karte per Taste A angelernt wurde.
// Leer lassen ("") = Karte muss angelernt werden.
static const char* FIXED_BEACON_MAC = "c3:00:00:25:ef:84";

static const uint32_t CHECK_INTERVAL_MS  = 5000;  // Prüfintervall
static const uint32_t CHECK_SCAN_SECONDS = 2;     // Scandauer pro Prüfung (1 = sparsamer, 2 = zuverlässiger)
static const uint32_t LEARN_SCAN_SECONDS = 3;     // Scandauer beim Anlernen
static const int      LEARN_MIN_RSSI     = -55;   // Karte muss beim Anlernen sehr nah sein

// Alarm erst nach so vielen Prüfungen hintereinander (verhindert Fehlalarme)
static const uint8_t  MISSES_FOR_ALARM   = 2;     // Karte nicht empfangen (2 x 5 s = ca. 10 s)
static const uint8_t  FAR_FOR_ALARM      = 2;     // Signal zu schwach
static const int      RSSI_HYSTERESIS    = 5;     // dB, damit der Alarm nicht flackert

// Empfindlichkeitsstufen (RSSI-Schwelle in dBm). Werte sind Richtwerte und
// müssen vor Ort ausprobiert werden (Körper/Jacke dämpfen stark).
struct SensLevel { const char* name; int rssiThreshold; };
static const SensLevel SENS_LEVELS[] = {
  { "Nah",          -75 },   // Alarm schon bei wenigen Metern (gut für Messe-Demo)
  { "Mittel",       -85 },   // Alarm bei mittlerer Entfernung
  { "Nur Verlust", -127 },   // Alarm nur, wenn gar kein Signal mehr kommt
};
static const uint8_t SENS_COUNT = sizeof(SENS_LEVELS) / sizeof(SENS_LEVELS[0]);

// Alarm-Wiederholung
static const uint8_t  ALARM_REPEAT_FAST  = 12;    // die ersten 12 Prüfungen (~1 min) jedes Mal
static const uint8_t  ALARM_REPEAT_SLOW  = 6;     // danach nur noch jede 6. Prüfung (~30 s)

// Vibrator (Unit Vibrator am Grove-Port, Signal auf G9 = gelbe Leitung)
static const int      VIB_PIN            = 9;
static const uint32_t VIB_PWM_FREQ       = 10000; // 10 kHz laut M5Stack-Doku
static const uint8_t  VIB_PWM_BITS       = 8;
static const uint8_t  VIB_DUTY           = 170;   // 0..255 – Stärke (zu hoch kann den 5-V-Ausgang überlasten)

static const uint8_t  SPEAKER_VOLUME     = 200;   // 0..255
static const uint32_t DISPLAY_ON_MS      = 20000; // Display geht danach aus (spart Akku)
static const uint32_t CPU_MHZ            = 80;    // 80 MHz reicht für BLE und spart Strom
static const int      LOW_BATTERY_PCT    = 15;

// ============================================================================

enum class Mode : uint8_t { Monitor, Learn };
enum class State : uint8_t { NoCard, Ok, Warn, Alarm };

static Preferences prefs;
static BLEScan*    bleScan = nullptr;

static String   targetMac;          // angelernte Karte (Kleinbuchstaben)
static uint8_t  sensIndex = 0;
static bool     soundOn = true;

// --- Daten aus dem BLE-Callback (läuft in einem anderen Task) ---------------
static portMUX_TYPE  scanMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool scanRunning = false;
static volatile bool scanDone = false;
static volatile Mode scanMode = Mode::Monitor;
static volatile bool cycleSeen = false;
static volatile int  cycleBestRssi = -127;
static char          learnBestMac[18] = {0};
static volatile int  learnBestRssi = -127;
static uint32_t      scanStartedMs = 0;

// --- Auswertung --------------------------------------------------------------
static State    state = State::NoCard;
static uint8_t  missCount = 0;
static uint8_t  farCount = 0;
static float    rssiSmooth = -127;
static int      lastRssi = -127;
static bool     alarmMuted = false;
static uint16_t alarmCycles = 0;
static uint32_t lastCheckMs = 0;
static bool     lowBatteryWarned = false;
static bool     armed = false;      // erst scharf, wenn die Karte einmal gesehen wurde
static bool     learnRequested = false;

// --- Display -----------------------------------------------------------------
static bool     displayOn = true;
static uint32_t displayOnSinceMs = 0;
static String   infoLine;           // kurze Meldung (z. B. nach dem Anlernen)
static uint32_t infoUntilMs = 0;

// ============================================================================
// Vibration + Ton als nicht-blockierende Abfolge
// ============================================================================
struct Step { uint16_t ms; bool vib; uint16_t toneHz; };

static const Step PATTERN_ALARM[] = {
  { 40,  false, 0    },  // 5-V-Ausgang hochfahren lassen
  { 350, true,  2600 },
  { 200, false, 0    },
  { 350, true,  2600 },
  { 200, false, 0    },
  { 350, true,  2600 },
};
static const Step PATTERN_FOUND[] = {
  { 40,  false, 0    },
  { 120, true,  1500 },
  { 60,  false, 0    },
  { 120, false, 2200 },
};
static const Step PATTERN_CONFIRM[] = {
  { 40,  false, 0    },
  { 100, true,  2000 },
};
static const Step PATTERN_ERROR[] = {
  { 40,  false, 0    },
  { 400, false, 600  },
};

static const Step* patSteps = nullptr;
static uint8_t     patLen = 0;
static uint8_t     patIndex = 0;
static uint32_t    patStepStartMs = 0;

static void vibSet(bool on) {
  ledcWrite(VIB_PIN, on ? VIB_DUTY : 0);
}

static void patternStop() {
  vibSet(false);
  M5.Speaker.stop();
  patSteps = nullptr;
  // 5-V-Ausgang und Verstärker wieder aus -> spart Akku
  M5.Power.setExtOutput(false);
  M5.Speaker.end();
}

static void patternApplyStep() {
  const Step& s = patSteps[patIndex];
  vibSet(s.vib);
  if (s.toneHz && soundOn) {
    M5.Speaker.tone(s.toneHz, s.ms);
  }
  patStepStartMs = millis();
}

static void patternStart(const Step* steps, uint8_t len) {
  M5.Power.setExtOutput(true);   // Grove-5V für den Vibrator einschalten
  if (soundOn) {
    M5.Speaker.begin();
    M5.Speaker.setVolume(SPEAKER_VOLUME);
  }
  patSteps = steps;
  patLen = len;
  patIndex = 0;
  patternApplyStep();
}

static void patternUpdate() {
  if (!patSteps) return;
  if (millis() - patStepStartMs < patSteps[patIndex].ms) return;
  patIndex++;
  if (patIndex >= patLen) {
    patternStop();
  } else {
    patternApplyStep();
  }
}

#define PLAY(p) patternStart(p, sizeof(p) / sizeof(p[0]))

// ============================================================================
// Display
// ============================================================================
static void displayWake() {
  if (!displayOn) {
    M5.Display.wakeup();
    M5.Display.setBrightness(128);
    displayOn = true;
  }
  displayOnSinceMs = millis();
}

static void displaySleep() {
  if (displayOn) {
    M5.Display.setBrightness(0);
    M5.Display.sleep();
    displayOn = false;
  }
}

static void showInfo(const String& text, uint32_t ms = 4000) {
  infoLine = text;
  infoUntilMs = millis() + ms;
  displayWake();
}

static void drawScreen() {
  if (!displayOn) return;

  uint16_t bg;
  const char* title;
  switch (state) {
    case State::Ok:    bg = TFT_DARKGREEN; title = "PASS OK";    break;
    case State::Warn:  bg = TFT_ORANGE;    title = "PASS ?";     break;
    case State::Alarm: bg = TFT_RED;       title = "PASS WEG!";  break;
    default:           bg = TFT_NAVY;      title = targetMac.isEmpty() ? "KEINE KARTE" : "SUCHE KARTE"; break;
  }
  if (scanMode == Mode::Learn) { bg = TFT_PURPLE; title = "ANLERNEN"; }

  M5.Display.startWrite();
  M5.Display.fillScreen(bg);
  M5.Display.setTextColor(TFT_WHITE, bg);
  M5.Display.setTextDatum(top_left);

  M5.Display.setTextSize(3);
  M5.Display.drawString(title, 6, 6);

  M5.Display.setTextSize(2);
  int y = 42;
  if (scanMode == Mode::Learn) {
    M5.Display.drawString("Karte direkt", 6, y);      y += 20;
    M5.Display.drawString("an Stick halten", 6, y);   y += 20;
  } else if (targetMac.isEmpty()) {
    M5.Display.drawString("A 2s halten =", 6, y);     y += 20;
    M5.Display.drawString("Karte anlernen", 6, y);    y += 20;
  } else {
    char buf[40];
    if (missCount > 0 || lastRssi <= -127) {
      snprintf(buf, sizeof(buf), "Signal: --");
    } else {
      snprintf(buf, sizeof(buf), "Signal: %d dBm", (int)rssiSmooth);
    }
    M5.Display.drawString(buf, 6, y); y += 20;
    snprintf(buf, sizeof(buf), "Modus: %s", SENS_LEVELS[sensIndex].name);
    M5.Display.drawString(buf, 6, y); y += 20;
  }

  M5.Display.setTextSize(1);
  int bat = M5.Power.getBatteryLevel();
  char foot[64];
  snprintf(foot, sizeof(foot), "Akku %d%%%s  Ton %s%s",
           bat, M5.Power.isCharging() == m5::Power_Class::is_charging ? " (laedt)" : "",
           soundOn ? "an" : "aus", alarmMuted ? "  STUMM" : "");
  M5.Display.drawString(foot, 6, 110);
  if (!infoLine.isEmpty() && millis() < infoUntilMs) {
    M5.Display.drawString(infoLine, 6, 122);
  }
  M5.Display.endWrite();
}

// ============================================================================
// BLE-Scan
// ============================================================================
class ScanCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice dev) override {
    if (!dev.haveRSSI()) return;
    int rssi = dev.getRSSI();
    String mac = String(dev.getAddress().toString().c_str());

    if (scanMode == Mode::Learn) {
      if (rssi >= LEARN_MIN_RSSI && rssi > learnBestRssi) {
        portENTER_CRITICAL(&scanMux);
        learnBestRssi = rssi;
        strncpy(learnBestMac, mac.c_str(), sizeof(learnBestMac) - 1);
        portEXIT_CRITICAL(&scanMux);
      }
      return;
    }

    if (!targetMac.isEmpty() && mac.equalsIgnoreCase(targetMac)) {
      portENTER_CRITICAL(&scanMux);
      cycleSeen = true;
      if (rssi > cycleBestRssi) cycleBestRssi = rssi;  // stärkstes Paket zählt (robuster gegen Abschattung)
      portEXIT_CRITICAL(&scanMux);
    }
  }
};
static ScanCallbacks scanCallbacks;

static void onScanComplete(BLEScanResults) {
  scanDone = true;
}

static void startScan(Mode mode, uint32_t seconds) {
  portENTER_CRITICAL(&scanMux);
  scanMode = mode;
  cycleSeen = false;
  cycleBestRssi = -127;
  learnBestRssi = -127;
  learnBestMac[0] = 0;
  portEXIT_CRITICAL(&scanMux);

  scanDone = false;
  scanRunning = true;
  scanStartedMs = millis();
  if (!bleScan->start(seconds, onScanComplete, false)) {
    scanRunning = false;
    Serial.println("[BLE] Scan konnte nicht gestartet werden");
  }
}

// ============================================================================
// Auswertung
// ============================================================================
static void setState(State s) {
  if (s == state) return;
  State old = state;
  state = s;
  Serial.printf("[STATE] %d -> %d\n", (int)old, (int)s);

  if (s == State::Alarm) {
    alarmCycles = 0;
    alarmMuted = false;
    displayWake();
  }
  if (old == State::Alarm && s == State::Ok) {
    alarmMuted = false;
    PLAY(PATTERN_FOUND);
    showInfo("Pass wieder in der Naehe");
  }
}

static void evaluateMonitorScan() {
  bool seen;
  int best;
  portENTER_CRITICAL(&scanMux);
  seen = cycleSeen;
  best = cycleBestRssi;
  portEXIT_CRITICAL(&scanMux);

  if (seen) {
    if (missCount > 0 || rssiSmooth <= -127) rssiSmooth = best;   // nach Verlust neu starten
    else rssiSmooth = 0.6f * rssiSmooth + 0.4f * best;
    lastRssi = best;
    missCount = 0;
    if (!armed) {
      armed = true;
      Serial.println("[STATE] Karte gefunden - Ueberwachung aktiv");
    }

    int threshold = SENS_LEVELS[sensIndex].rssiThreshold;
    if (state == State::Alarm) threshold += RSSI_HYSTERESIS;      // zum Beenden etwas stärker
    if (rssiSmooth < threshold) { if (farCount < 255) farCount++; }
    else farCount = 0;
  } else {
    if (missCount < 255) missCount++;
    lastRssi = -127;
  }

  Serial.printf("[SCAN] gesehen=%d rssi=%d glatt=%.1f miss=%u fern=%u\n",
                seen, best, rssiSmooth, missCount, farCount);

  if (!armed) {
    return;   // Karte seit Start/Anlernen noch nie gesehen -> kein Alarm
  }

  if (missCount >= MISSES_FOR_ALARM || farCount >= FAR_FOR_ALARM) {
    setState(State::Alarm);
  } else if (missCount > 0 || farCount > 0) {
    if (state != State::Alarm) setState(State::Warn);   // im Alarm bleiben, bis klar zurück
  } else {
    setState(State::Ok);
  }

  if (state == State::Alarm && !alarmMuted) {
    bool fire = (alarmCycles < ALARM_REPEAT_FAST) || (alarmCycles % ALARM_REPEAT_SLOW == 0);
    if (fire) PLAY(PATTERN_ALARM);
    alarmCycles++;
  }
}

static void evaluateLearnScan() {
  int best;
  char mac[18];
  portENTER_CRITICAL(&scanMux);
  best = learnBestRssi;
  memcpy(mac, learnBestMac, sizeof(mac));
  portEXIT_CRITICAL(&scanMux);

  scanMode = Mode::Monitor;
  if (mac[0]) {
    targetMac = String(mac);
    targetMac.toLowerCase();
    prefs.putString("mac", targetMac);
    missCount = 0; farCount = 0; rssiSmooth = -127;
    state = State::NoCard;
    armed = false;
    Serial.printf("[LEARN] Karte angelernt: %s (%d dBm)\n", mac, best);
    PLAY(PATTERN_CONFIRM);
    showInfo("Angelernt: " + targetMac, 8000);
  } else {
    Serial.println("[LEARN] keine Karte nah genug gefunden");
    PLAY(PATTERN_ERROR);
    showInfo("Keine Karte gefunden - nochmal", 6000);
  }
}

// ============================================================================
// Tasten
// ============================================================================
static void handleButtons() {
  if (M5.BtnA.wasHold()) {
    learnRequested = true;    // startet, sobald der laufende Scan fertig ist
    displayWake();
    showInfo("Anlernen...");
  } else if (M5.BtnA.wasDoubleClicked()) {
    soundOn = !soundOn;
    prefs.putBool("sound", soundOn);
    showInfo(soundOn ? "Ton an" : "Ton aus");
  } else if (M5.BtnA.wasSingleClicked()) {
    if (state == State::Alarm && !alarmMuted) {
      alarmMuted = true;
      if (patSteps) patternStop();
      showInfo("Alarm stumm bis Pass zurueck");
    } else {
      displayWake();
    }
  }

  if (M5.BtnB.wasHold()) {
    showInfo("Test-Alarm");
    PLAY(PATTERN_ALARM);
  } else if (M5.BtnB.wasSingleClicked()) {
    sensIndex = (sensIndex + 1) % SENS_COUNT;
    prefs.putUChar("sens", sensIndex);
    farCount = 0;
    showInfo(String("Empfindlichkeit: ") + SENS_LEVELS[sensIndex].name);
  }
}

// ============================================================================
// setup / loop
// ============================================================================
void setup() {
  auto cfg = M5.config();
  cfg.serial_baudrate = 115200;
  M5.begin(cfg);
  setCpuFrequencyMhz(CPU_MHZ);

  M5.BtnA.setHoldThresh(2000);
  M5.BtnB.setHoldThresh(2000);

  M5.Display.setRotation(1);
  M5.Display.setBrightness(128);

  // Vibrator-PWM (Arduino-ESP32 Core 3.x)
  ledcAttach(VIB_PIN, VIB_PWM_FREQ, VIB_PWM_BITS);
  vibSet(false);
  M5.Power.setExtOutput(false);

  prefs.begin("passwaechter", false);
  targetMac = prefs.getString("mac", "");
  if (targetMac.isEmpty() && strlen(FIXED_BEACON_MAC) > 0) targetMac = FIXED_BEACON_MAC;  // angelernte Karte hat Vorrang
  targetMac.toLowerCase();
  sensIndex = prefs.getUChar("sens", 0);
  if (sensIndex >= SENS_COUNT) sensIndex = 0;
  soundOn = prefs.getBool("sound", true);

  BLEDevice::init("");
  bleScan = BLEDevice::getScan();
  bleScan->setAdvertisedDeviceCallbacks(&scanCallbacks, true);  // Duplikate = jedes Paket zählt
  bleScan->setActiveScan(false);   // passiv: nur zuhören, spart Strom
  bleScan->setInterval(100);
  bleScan->setWindow(99);          // Fenster < Intervall (Pflicht), praktisch dauerhaft hören während des Scans

  Serial.printf("Passwaechter gestartet. Karte: %s\n", targetMac.isEmpty() ? "(keine)" : targetMac.c_str());
  displayWake();
  drawScreen();
  lastCheckMs = millis() - CHECK_INTERVAL_MS;   // sofort erste Prüfung
}

void loop() {
  M5.update();
  handleButtons();
  patternUpdate();

  // Scan beendet -> auswerten
  if (scanRunning && scanDone) {
    scanRunning = false;
    bleScan->clearResults();
    if (scanMode == Mode::Learn) evaluateLearnScan();
    else evaluateMonitorScan();
    drawScreen();
  }

  // Sicherheitsnetz: falls der Scan nicht zurückmeldet
  if (scanRunning && millis() - scanStartedMs > (LEARN_SCAN_SECONDS + 5) * 1000UL) {
    Serial.println("[BLE] Scan-Timeout, starte neu");
    bleScan->stop();
    bleScan->clearResults();
    scanRunning = false;
    scanMode = Mode::Monitor;
  }

  // Anlernen starten (hat Vorrang)
  if (!scanRunning && learnRequested) {
    learnRequested = false;
    if (patSteps) patternStop();
    startScan(Mode::Learn, LEARN_SCAN_SECONDS);
    drawScreen();
    Serial.println("[LEARN] Anlernen gestartet");
  }

  // Nächste Prüfung starten
  if (!scanRunning && !targetMac.isEmpty() && millis() - lastCheckMs >= CHECK_INTERVAL_MS) {
    lastCheckMs = millis();
    startScan(Mode::Monitor, CHECK_SCAN_SECONDS);
  }

  // Akku-Warnung (einmalig)
  static uint32_t lastBatMs = 0;
  if (millis() - lastBatMs > 60000) {
    lastBatMs = millis();
    int bat = M5.Power.getBatteryLevel();
    if (bat >= 0 && bat <= LOW_BATTERY_PCT && !lowBatteryWarned && !patSteps) {
      lowBatteryWarned = true;
      PLAY(PATTERN_ERROR);
      showInfo("Akku schwach - bitte laden", 10000);
    }
    if (bat > LOW_BATTERY_PCT + 5) lowBatteryWarned = false;
  }

  // Display: im Alarm an lassen, sonst nach DISPLAY_ON_MS aus
  static uint32_t lastDrawMs = 0;
  if (displayOn) {
    if (state != State::Alarm && scanMode != Mode::Learn &&
        millis() - displayOnSinceMs > DISPLAY_ON_MS) {
      displaySleep();
    } else if (millis() - lastDrawMs > 1000) {
      lastDrawMs = millis();
      drawScreen();
    }
  }

  delay(10);
}

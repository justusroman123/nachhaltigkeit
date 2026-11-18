// Geraeteprofile fuer die Browser-Tests (nur Chromium-Emulation: Fenstergroesse, Touch, Pixeldichte, Kennung des Geraets).
// Ein Profil ersetzt NICHT das echte Geraet und NICHT die Browser-Engine (Safari/WebKit, Firefox): siehe docs/testbericht-geraete.md.
// Nutzung in den Skripten: b.newContext(profil(process.env.GERAET, { permissions: ['microphone'] }))
const { devices } = require('playwright');

const CROS = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
// ASUS Chromebook Plus CX34 (14 Zoll, 1920 x 1080): sichtbare Seitenflaeche je nach Anzeige-Skalierung des Betriebssystems
const EIGENE = {
  'Chromebook 100%': { viewport: { width: 1920, height: 969 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, userAgent: CROS },
  'Chromebook 125%': { viewport: { width: 1536, height: 730 }, deviceScaleFactor: 1.25, isMobile: false, hasTouch: false, userAgent: CROS },
  'Chromebook 150%': { viewport: { width: 1280, height: 600 }, deviceScaleFactor: 1.5, isMobile: false, hasTouch: false, userAgent: CROS },
  'Chromebook klein': { viewport: { width: 1366, height: 657 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, userAgent: CROS },
};

function profil(name, extra) {
  if (!name) return { ...(extra || {}) };
  const d = EIGENE[name] || devices[name];
  if (!d) throw new Error('Unbekanntes Geraeteprofil: ' + name);
  const { defaultBrowserType, ...rest } = d;               // die Engine bleibt Chromium
  return { ...rest, ...(extra || {}) };
}

// Rechenleistung der Seite drosseln (Chromium-Befehl "CPU-Drosselung"): Faktor 4 = Hauptthread der Seite vierfach langsamer.
// Simuliert ein schwaches Geraet nur grob (kein echter Prozessor, kein Arbeitsspeicher-Druck, der Audio-Thread bleibt ungedrosselt).
async function drosseln(page, faktor) {
  const f = Number(faktor || 0);
  if (!(f > 1)) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: f });
}

module.exports = { profil, EIGENE, drosseln };

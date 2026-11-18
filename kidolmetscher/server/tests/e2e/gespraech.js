// Vorschlag fuer server/tests/e2e/gespraech.js: Browser-Test des Gespraechsmodus MIT Zusicherungen (Exit-Code 1 bei Fehler).
// Start: BASE=http://127.0.0.1:8123 OPERATOR_KEY=... node gespraech.js   (Server mit Attrappen, z. B. MOCK_ASR_SEGMENT_S=0.5)
// Prueft die Browser-Seiten von B2 (Gast kann nicht stoppen), B3 (Mikrofon aus, Ton aus), B4 (Wortmeldung, automatische Uebergabe),
// B5/B6 ("played"-Rueckmeldung). Nutzt Chromiums Fake-Mikrofon; schreibt alle gesendeten Nachrichten per Init-Skript mit.
const { chromium } = require('playwright');
const { profil } = require('./_geraet');                   // GERAET = Gast-Tablet, OP_GERAET = Bedienplatz (leer: Standard-Fenster)
const BASE = process.env.BASE || 'http://127.0.0.1:8123', KEY = process.env.OPERATOR_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { try { if (await fn()) return true; } catch (_) {} if (Date.now() - t0 > ms) return false; await sleep(100); } };

const INIT = () => {                       // laeuft in jeder Seite VOR dem Seitenskript
  const O = window.WebSocket; window.__sent = []; window.__bin = 0; window.__starts = 0; window.__streams = [];
  function W(...a) {
    const s = new O(...a), send = s.send.bind(s);
    s.send = (d) => { if (typeof d === 'string') { try { window.__sent.push(JSON.parse(d)); } catch (_) {} } else window.__bin++; return send(d); };
    return s;
  }
  W.prototype = O.prototype; for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) W[k] = O[k]; window.WebSocket = W;
  const cbs = AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource = function () { const s = cbs.call(this), st = s.start.bind(s); s.start = (...a) => { window.__starts++; return st(...a); }; return s; };
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => { const s = await gum(c); window.__streams.push(s); return s; };
};
const sent = (p, t, extra) => p.evaluate(([t, extra]) => window.__sent.filter((m) => m.type === t && (!extra || Object.entries(extra).every(([k, v]) => m[k] === v))).length, [t, extra || null]);
const text = async (p, sel) => ((await p.textContent(sel)) || '').trim();

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const mk = async (g) => { const c = await b.newContext(profil(g, { permissions: ['microphone'] })); await c.addInitScript(INIT); return c.newPage(); };
  const errs = [], op = await mk(process.env.OP_GERAET), g = await mk(process.env.GERAET);
  for (const [n, p] of [['operator', op], ['gast', g]]) p.on('pageerror', (e) => errs.push(n + ': ' + e.message));
  await op.goto(BASE + '/operator.html'); await op.fill('#key', KEY);
  await op.check('input[name=mode][value=gespraech]'); await op.click('#btnCreate');
  await op.waitForSelector('#linkText:not(:empty)');
  await g.goto((await text(op, '#linkText')).replace(/^https?:\/\/[^/]+/, BASE));
  await g.waitForSelector('#picker button'); await g.click('#picker button >> nth=0');
  await g.waitForSelector('#btnSubsOnly', { state: 'visible' }); await g.click('#btnSubsOnly');
  await g.waitForSelector('#talkDock:not([hidden])');
  await until(async () => /SPRECHEN MÖGLICH/.test(await text(op, '#talkMsg')));

  // B2: der Gast hat keinen Stopp-Knopf, solange der Mitarbeiter spricht (nur Wortmeldung)
  await op.click('#btnTalk');
  ok(await until(async () => /^✋/.test(await text(g, '#btnTalk'))), 'B2 Gast-Knopf waehrend der Mitarbeiter spricht ist die Wortmeldung, kein Stopp');

  // B4: Gast meldet sich (Wortmeldung geht an den Server), Mitarbeiter sieht Hinweis und wird nicht unterbrochen
  await g.click('#btnTalk');
  ok(await until(async () => (await sent(g, 'want', { on: true })) === 1), 'B4 Wortmeldung des Gastes wird gesendet');
  ok(await until(async () => /Gast möchte sprechen/.test(await text(op, '#talkMsg'))), 'B4 Mitarbeiter sieht Hinweis "Ein Gast moechte sprechen"');
  ok(/Fertig/.test(await text(op, '#btnTalk')), 'B4 Mitarbeiter wird nicht unterbrochen (Knopf "Fertig")');

  // B6 (Browser-Seite): Mitarbeiter-Aussage wird dem Gast uebersetzt; das Tablet meldet "played" (fertig)
  await sleep(1500);
  await op.click('#btnTalk');                                    // Mitarbeiter: Fertig
  ok(await until(async () => (await sent(op, 'talk', { on: false })) >= 1), 'B1 "Fertig" des Mitarbeiters wird gesendet');
  ok(await until(async () => (await sent(g, 'played')) >= 1, 15000), 'B6 Gast-Tablet meldet "fertig" (played) fuer die Uebersetzung');

  // B4: Gast bekommt das Wort automatisch, Mikrofon startet von selbst und sendet Audio
  ok(await until(async () => (await sent(g, 'talk', { on: true })) >= 1, 15000), 'B4 Gast bekommt das Wort automatisch (talk on ohne Tippen)');
  ok(await until(async () => (await g.evaluate(() => window.__bin)) > 5), 'B4 Mikrofon des Gastes sendet Audio');
  ok(await until(async () => /Stopp/.test(await text(op, '#btnTalk'))), 'B2 Mitarbeiter sieht "Stopp - ich spreche jetzt", waehrend der Gast spricht');

  // B3: Mitarbeiter stoppt den Gast: takeover wird gesendet, Mikrofon des Gastes geht aus, es fliesst kein Audio mehr
  await sleep(1500);
  await op.click('#btnTalk');
  ok(await until(async () => (await sent(op, 'takeover')) === 1), 'B2/B3 "Stopp" sendet takeover');
  ok(await until(async () => g.evaluate(() => window.__streams.length > 0 && window.__streams.every((s) => s.getAudioTracks().every((t) => !t.enabled)))),
     'B3 Mikrofon des Gastes ist sofort aus (Track deaktiviert)');
  const bin = await g.evaluate(() => window.__bin); await sleep(1500);
  ok((await g.evaluate(() => window.__bin)) === bin, 'B3 nach dem Stopp sendet das Tablet kein Audio mehr');
  ok(await until(async () => /⚠/.test(await text(g, '#turnBand'))), 'B3 Gast sieht den Hinweis, dass seine Aussage beendet wurde');
  ok(await until(async () => (await sent(op, 'played')) >= 1, 15000), 'B5/B6 Bedienplatz meldet "played" fuer die Gast-Antwort');

  await op.click('#btnTalk');                                    // Fertig

  // Zugang: der Beitritt des Gastes war am Bedienplatz sichtbar; "Alle trennen" trennt den Gast wirklich und macht den alten Link ungueltig
  ok((await text(op, '#devCount')) === '1', 'Z1 Bedienplatz zeigt "Verbunden: 1" (der Gast)');
  await op.click('#btnDoorShut'); await op.click('#btnDoorShut');
  ok(await until(async () => /Vom Mitarbeiter getrennt/.test(await text(g, '#status')), 8000), 'Z2 Gast-Seite zeigt "Vom Mitarbeiter getrennt"');
  ok(await until(async () => (await text(op, '#devCount')) === '0', 8000), 'Z3 Bedienplatz zeigt danach "Verbunden: 0"');
  const alterCode = ((await g.url()).match(/#t=([^&]+)/) || [])[1];
  ok(!alterCode, 'Z4 Zugangscode steht nicht mehr in der Adresszeile des Gastes');
  try { if (await op.locator('#btnEnd').isVisible()) { await op.click('#btnEnd'); await sleep(400); } } catch (_) {}       // Raum loeschen (wiederholte Laeufe)
  console.log('JS-Fehler:', errs.length ? errs : 'keine');
  ok(errs.length === 0, 'keine JavaScript-Fehler');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('E2E-ABBRUCH', e); process.exit(2); });

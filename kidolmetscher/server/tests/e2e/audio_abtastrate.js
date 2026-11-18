// Mikrofon-Abtastrate (Bedienplatz und Gast-Tablet im Gespraech): Die Seiten verlangen vom Audio-Kontext 16 kHz. Haelt ein Browser die Rate
// nicht ein oder kann er die Mikrofonquelle mit fester Rate nicht anbinden, muss trotzdem 16-kHz-Audio in 50-ms-Bloecken (800 Werte) beim Server
// ankommen; sonst waere die Sprache fuer die Spracherkennung zu tief und zu langsam gedehnt (48 kHz als 16 kHz gelesen: Ton auf ein Drittel). Das ist eine VORSORGE fuer Browser, die hier nicht
// laufen (Safari, Firefox): Chromium wird nur so ueberschrieben, dass es sich wie ein solcher Browser verhaelt. Ein echter Test dieser Browser ist es NICHT.
// Modi (AudioContext in der Seite ueberschrieben):
//   normal            Rate wird eingehalten (Chromium-Verhalten)
//   ignoriert48       Kontext laeuft trotz Wunsch mit 48 kHz (ganzzahliges Verhaeltnis 3:1)
//   ignoriert44       Kontext laeuft trotz Wunsch mit 44,1 kHz (nicht ganzzahlig, 2,756:1)
//   quelle_scheitert  createMediaStreamSource wirft, sobald eine feste Rate verlangt wurde; der zweite Versuch ohne Rate muss greifen
// Mikrofon: Chromiums Fake-Geraet spielt einen 1000-Hz-Ton aus einer WAV-Datei. Geprueft werden Blockgroesse und Blockrate (Bedienplatz und Gast),
// beim Bedienplatz zusaetzlich die Tonhoehe (Rohsignal); beim Gast bearbeitet der Browser das Signal (Echo-Unterdrueckung, Rauschfilter, Pegelregelung).
//   BASE=http://127.0.0.1:8123 OPERATOR_KEY=... node audio_abtastrate.js        Exit-Code 1 bei Fehlern, 2 bei Abbruch
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8123', KEY = process.env.OPERATOR_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const until = async (fn, ms = 10000) => { const t0 = Date.now(); for (;;) { try { if (await fn()) return true; } catch (_) {} if (Date.now() - t0 > ms) return false; await sleep(100); } };
const text = async (p, sel) => ((await p.textContent(sel)) || '').trim();

function wavSinus(pfad, hz, rate, sek) {                    // mono, 16 Bit; ganze Perioden, damit die Schleife nahtlos ist
  const n = rate * sek, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 12000), 44 + i * 2);
  fs.writeFileSync(pfad, buf);
}
const maxAbs = (a) => { let m = 0; for (const v of a) { const x = v < 0 ? -v : v; if (x > m) m = x; } return m; };     // kein Math.max(...liste): bei grossen Listen ueberlaeuft der Aufrufstapel
function frequenz(samples, rate) {                          // Nulldurchgaenge mit Hysterese (Rauschen unter der Schwelle zaehlt nicht)
  const schwelle = Math.max(200, 0.25 * maxAbs(samples));
  let z = 0, s = 0;
  for (const v of samples) { const n = v > schwelle ? 1 : v < -schwelle ? -1 : 0; if (n !== 0 && s !== 0 && n !== s) z++; if (n !== 0) s = n; }
  return z / 2 / (samples.length / rate);
}

const INIT = (modus) => {                                   // laeuft in der Seite VOR dem Seitenskript
  window.__bloecke = []; window.__ctx = [];
  const O = window.WebSocket;
  function W(...a) {
    const s = new O(...a), send = s.send.bind(s);
    s.send = (d) => { if (typeof d !== 'string') window.__bloecke.push({ t: performance.now(), s: Array.from(new Int16Array(d instanceof ArrayBuffer ? d.slice(0) : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength))) }); return send(d); };
    return s;
  }
  W.prototype = O.prototype; for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) W[k] = O[k]; window.WebSocket = W;
  const AC = window.AudioContext, ZWANG = { ignoriert48: 48000, ignoriert44: 44100 }[modus];
  window.AudioContext = class extends AC {
    constructor(o) {
      const wunsch = o && o.sampleRate;
      super(ZWANG && wunsch ? { ...o, sampleRate: ZWANG } : o);
      window.__ctx.push({ wunsch: wunsch || null, tatsaechlich: this.sampleRate });
      if (modus === 'quelle_scheitert' && wunsch) {
        this.createMediaStreamSource = () => { throw new DOMException('Connecting AudioNodes from AudioContexts with different sample-rate is currently not supported.', 'NotSupportedError'); };
      }
    }
  };
};

const MODI = ['normal', 'ignoriert48', 'ignoriert44', 'quelle_scheitert'];

async function messen(p, TAG, pfad, modus) {
  const d = await p.evaluate(() => ({ b: window.__bloecke, ctx: window.__ctx }));
  const bl = d.b.slice(5);                                  // Einschwingen auslassen
  const alle = [].concat(...bl.map((x) => x.s));
  ok(bl.length >= 30, TAG + ' genug Bloecke zum Messen (' + bl.length + ')');
  if (bl.length < 30) return d;
  ok(bl.every((x) => x.s.length === 800), TAG + ' jeder Block hat 800 Werte (50 ms bei 16 kHz); Laengen: ' + [...new Set(bl.map((x) => x.s.length))].join(','));
  const dauer = (bl[bl.length - 1].t - bl[0].t) / 1000, proS = (bl.length - 1) / dauer;
  ok(proS > 17 && proS < 23, TAG + ' Blockrate etwa 20 pro Sekunde (gemessen ' + proS.toFixed(1) + ')');
  const f = frequenz(alle, 16000), spitze = maxAbs(alle);
  if (pfad === 'bedienplatz') ok(Math.abs(f - 1000) <= 50, TAG + ' Tonhoehe stimmt (' + Math.round(f) + ' Hz, erwartet 1000 Hz)' + (f < 700 ? ' ZU TIEF' : ''));     // Rohsignal ohne Sprachverbesserung
  else console.log('INFO ' + TAG + ' Tonhoehe nicht geprueft (Echo-Unterdrueckung, Rauschfilter und Pegelregelung des Browsers veraendern das Signal des Gastes)');
  ok(spitze > 300, TAG + ' Pegel vorhanden (Spitze ' + spitze + ')');
  if (modus === 'ignoriert48') ok(d.ctx.length >= 1 && d.ctx[0].wunsch === 16000 && d.ctx[0].tatsaechlich === 48000, TAG + ' Simulation wirkt: gewuenscht 16000, tatsaechlich ' + (d.ctx[0] && d.ctx[0].tatsaechlich));
  if (modus === 'ignoriert44') ok(d.ctx.length >= 1 && d.ctx[0].wunsch === 16000 && d.ctx[0].tatsaechlich === 44100, TAG + ' Simulation wirkt: gewuenscht 16000, tatsaechlich ' + (d.ctx[0] && d.ctx[0].tatsaechlich));
  if (modus === 'quelle_scheitert') ok(d.ctx.length >= 2 && d.ctx[0].wunsch === 16000 && d.ctx[1].wunsch === null, TAG + ' zweiter Versuch ohne feste Rate (' + JSON.stringify(d.ctx) + ')');
  return d;
}

(async () => {
  const wav = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'abtastrate-')), 'ton1000.wav');
  wavSinus(wav, 1000, 48000, 3);
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + wav, '--autoplay-policy=no-user-gesture-required'] });

  // --- Bedienplatz (Vortrag): "Senden starten" oeffnet das Mikrofon mit der Rate, die der Server nennt
  for (const modus of MODI) {
    const TAG = '[Bedienplatz ' + modus + ']', fehler = [];
    const c = await b.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 800 } });
    const p = await c.newPage(); p.on('pageerror', (e) => fehler.push(String(e)));
    await p.addInitScript(INIT, modus);
    await p.goto(BASE + '/operator.html');
    await p.fill('#key', KEY); await p.click('#btnCreate');
    await p.waitForSelector('#stepInvite:not([hidden])');
    await p.click('#btnStart');
    await until(async () => (await p.evaluate(() => window.__bloecke.length)) >= 40, 12000);
    await sleep(2500);                                      // etwa 50 weitere Bloecke sammeln
    await messen(p, TAG, 'bedienplatz', modus);
    const msg = await text(p, '#micMsg');
    ok(!/Mikrofon-Fehler/.test(msg), TAG + ' keine Fehlermeldung am Bedienplatz ("' + msg.slice(0, 60) + '")');
    ok(fehler.length === 0, TAG + ' keine JavaScript-Fehler' + (fehler.length ? ': ' + fehler[0] : ''));
    try { if (await p.locator('#btnEnd').isVisible()) { await p.click('#btnEnd'); await sleep(400); } } catch (_) {}
    await c.close();
  }

  // --- Gast-Tablet im Gespraech: "Sprechen" (Server frei) oeffnet das Mikrofon des Gastes
  for (const modus of MODI) {
    const TAG = '[Gast ' + modus + ']', fehler = [];
    const co = await b.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 800 } });
    const op = await co.newPage(); op.on('pageerror', (e) => fehler.push('Bedienplatz: ' + e));
    await op.goto(BASE + '/operator.html'); await op.fill('#key', KEY);
    await op.check('input[name=mode][value=gespraech]'); await op.click('#btnCreate');
    await op.waitForSelector('#linkText:not(:empty)');
    const link = (await text(op, '#linkText')).replace(/^https?:\/\/[^/]+/, BASE);
    const cg = await b.newContext({ permissions: ['microphone'], viewport: { width: 412, height: 839 }, hasTouch: true, isMobile: true });
    await cg.addInitScript(INIT, modus);
    const g = await cg.newPage(); g.on('pageerror', (e) => fehler.push('Gast: ' + e));
    await g.goto(link); await g.waitForSelector('#picker button'); await g.click('#picker button >> nth=0');
    await g.waitForSelector('#btnSubsOnly', { state: 'visible' }); await g.click('#btnSubsOnly');
    await g.waitForSelector('#talkDock:not([hidden])');
    await until(async () => /SPRECHEN MÖGLICH/.test(await text(op, '#talkMsg')));
    await g.click('#btnTalk');                              // Server ist frei: der Gast darf sofort sprechen, das Mikrofon oeffnet sich
    await until(async () => (await g.evaluate(() => window.__bloecke.length)) >= 40, 12000);
    await sleep(2500);
    await messen(g, TAG, 'gast', modus);
    ok(fehler.length === 0, TAG + ' keine JavaScript-Fehler' + (fehler.length ? ': ' + fehler[0] : ''));
    try { await g.click('#btnTalk'); await sleep(300); } catch (_) {}      // Fertig
    try { if (await op.locator('#btnEnd').isVisible()) { await op.click('#btnEnd'); await sleep(400); } } catch (_) {}
    await co.close(); await cg.close();
  }

  await b.close();
  fs.rmSync(path.dirname(wav), { recursive: true, force: true });
  console.log(fails ? 'FEHLER: ' + fails : 'alles bestanden');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('E2E-ABBRUCH', e); process.exit(2); });

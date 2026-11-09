// Optionaler Browser-Rauchtest (nicht Teil von pytest). Braucht Node + playwright und einen laufenden Server:
//   OPERATOR_KEY=... MOCK_ASR_SEGMENT_S=1 uvicorn app.main:create_app --factory --port 8123 --no-access-log
//   OPERATOR_KEY=... BASE=http://127.0.0.1:8123 node tests/e2e/browser_smoke.js
// Nutzt Chromiums Fake-Mikrofon (Testton). Es prueft NICHT das echte DJI Mic Mini.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const KEY = process.env.OPERATOR_KEY;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  const watch = (p, n) => {
    p.on('pageerror', (e) => errors.push(n + ': ' + e));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(n + ': ' + m.text()); });
  };
  const opCtx = await b.newContext({ permissions: ['microphone'] });
  const op = await opCtx.newPage(); watch(op, 'operator');
  await op.goto(BASE + '/');
  ok(op.url().endsWith('/operator.html'), 'Wurzel leitet auf Bedienplatz');
  await op.fill('#key', 'falsch'); await op.click('#btnCreate');
  await op.waitForFunction(() => document.getElementById('roomMsg').textContent.includes('falsch'));
  ok(true, 'falscher Schluessel wird abgewiesen');
  await op.fill('#key', KEY); await op.click('#btnCreate');
  await op.waitForSelector('#secLinks:not([hidden])');
  ok((await op.$$('#langs input')).length === 4, 'vier Zielsprachen angeboten');
  await op.click('#btnLinks'); await op.waitForSelector('#links code');
  const urls = await op.$$eval('#links code', (n) => n.map((x) => x.textContent));
  ok(urls.length === 4 && urls.every((u) => u.includes('/listener.html#t=')), 'vier Zuhoerer-Links erzeugt');

  const listeners = [];
  for (const u of urls.slice(0, 2).concat(urls[1])) {      // uk, ar, ar (zwei Geraete in Arabisch)
    const c = await b.newContext({ permissions: [] });
    const p = await c.newPage(); watch(p, 'zuhoerer'); await p.goto(u);
    await p.waitForFunction(() => document.getElementById('status').textContent.includes('live'));
    listeners.push(p);
  }
  ok(true, 'drei Zuhoerer-Geraete verbunden');
  await op.waitForFunction(() => /uk: 1/.test(document.getElementById('statL').textContent)
    && /ar: 2/.test(document.getElementById('statL').textContent), null, { timeout: 8000 });
  ok(true, 'Bedienplatz zaehlt Zuhoerer je Sprache (uk: 1, ar: 2)');

  await op.click('#btnStart');
  await listeners[0].waitForSelector('.sub', { timeout: 15000 });
  const t0 = await listeners[0].$eval('.sub:last-child', (n) => [n.textContent, n.dir]);
  await listeners[1].waitForSelector('.sub', { timeout: 15000 });
  const t1 = await listeners[1].$eval('.sub:last-child', (n) => [n.textContent, n.dir]);
  ok(t0[0].startsWith('[uk]') && t0[1] === 'ltr', 'Ukrainisch: Untertitel ' + JSON.stringify(t0[0]));
  ok(t1[0].startsWith('[ar]') && t1[1] === 'rtl', 'Arabisch: Untertitel rechts-nach-links ' + JSON.stringify(t1[0]));
  await listeners[0].click('#btnSound');
  ok((await listeners[0].textContent('#btnSound')) === '🔊', 'Ton laesst sich einschalten');
  await op.waitForSelector('#log div', { timeout: 5000 });
  const lat = await op.textContent('#lat'); const st = await op.textContent('#stages');
  ok(/^\d+ ms/.test(lat), 'Bedienplatz zeigt Verzoegerung: ' + lat + ' | ' + st);
  ok((await op.textContent('#micMsg')).includes('16000 Hz'), 'Mikrofon sendet mit 16000 Hz');

  await op.click('#btnEnd');
  for (const p of listeners) {
    await p.waitForFunction(() => document.getElementById('status').textContent === 'Ende', null, { timeout: 8000 });
  }
  ok(true, 'Sitzungsende erreicht alle Zuhoerer');
  const bad = errors.filter((e) => !/Failed to load resource.*(401|404)/.test(e));
  ok(bad.length === 0, 'keine JS-/CSP-Fehler in der Konsole ' + JSON.stringify(bad));
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e); process.exit(2); });

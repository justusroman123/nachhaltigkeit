// Optionaler Browser-Rauchtest (nicht Teil von pytest). Braucht Node + playwright und einen laufenden Server:
//   OPERATOR_KEY=... MOCK_ASR_SEGMENT_S=1 uvicorn app.main:create_app --factory --port 8123 --no-access-log
//   OPERATOR_KEY=... BASE=http://127.0.0.1:8123 PYTHON=python3 node tests/e2e/browser_smoke.js
// Optional SHOTS=/pfad/ordner speichert Bildschirmfotos. QR-Pruefung braucht python mit opencv-python-headless.
// Nutzt Chromiums Fake-Mikrofon (Testton). Es prueft NICHT das echte DJI Mic Mini.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const KEY = process.env.OPERATOR_KEY;
const SHOTS = process.env.SHOTS;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const shot = async (page, name, opts = {}) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name), ...opts }); };

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  const watch = (p, n) => {
    p.on('pageerror', (e) => errors.push(n + ': ' + e));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(n + ': ' + m.text()); });
  };
  const opCtx = await b.newContext({ permissions: ['microphone'], viewport: { width: 1100, height: 900 } });
  const op = await opCtx.newPage(); watch(op, 'operator');
  await op.goto(BASE + '/');
  ok(op.url().endsWith('/operator.html'), 'Wurzel leitet auf Bedienplatz');
  await op.waitForSelector('#langs input');
  const chips = await op.$$eval('#langs input', (n) => n.map((x) => x.value + (x.checked ? '+' : '-')));
  ok(chips.join(',') === 'uk+,ar+,en+,tr+,fa-', 'Sprachen waehlbar, Persisch optional und aus: ' + chips);
  await shot(op, 'operator-1-start.png');

  await op.fill('#key', 'falsch'); await op.click('#btnCreate');
  await op.waitForFunction(() => document.getElementById('roomMsg').textContent.includes('falsch'));
  ok(true, 'falscher Schluessel wird abgewiesen');
  await op.fill('#key', KEY); await op.click('#btnCreate');
  await op.waitForSelector('#stepInvite:not([hidden])');
  await op.waitForFunction(() => (document.getElementById('qr').src || '').startsWith('data:image/svg+xml'));
  const link = await op.textContent('#linkText');
  ok(/\/listener\.html#t=[A-Za-z0-9_-]{30,}$/.test(link), 'ein Sammel-Link ohne Sprache: ' + link.replace(/t=.*/, 't=…'));
  await op.waitForTimeout(300);
  if (SHOTS) {
    const png = path.join(SHOTS, 'qr.png');
    await (await op.$('#qr')).screenshot({ path: png });
    try {
      const out = execFileSync(process.env.PYTHON || 'python3', [path.join(__dirname, 'decode_qr.py'), png]).toString().trim();
      ok(out === link, 'QR-Code im Browser gerendert und decodiert = Link');
    } catch (e) { ok(false, 'QR-Decoder nicht ausfuehrbar: ' + String(e).slice(0, 80)); }
  }

  const listeners = [];
  for (const wanted of ['uk', 'ar', 'ar']) {
    const c = await b.newContext({ permissions: [], viewport: { width: 390, height: 780 } });
    const p = await c.newPage(); watch(p, 'zuhoerer'); await p.goto(link);
    await p.waitForSelector('#picker:not([hidden]) button');
    if (wanted === 'uk' && listeners.length === 0) {
      const names = await p.$$eval('#picker button', (n) => n.map((x) => x.textContent));
      ok(names.length === 4 && !names.includes('فارسی'), 'Zuhoerer sieht 4 grosse Sprachknoepfe: ' + names.join(' | '));
      await shot(p, 'listener-1-sprachwahl.png');
    }
    await p.click('#picker button[lang="' + wanted + '"]');
    await p.waitForSelector('#picker', { state: 'hidden' });
    await p.waitForFunction(() => document.getElementById('status').textContent.includes('live'));
    await p.waitForSelector('#startScreen:not([hidden])');
    if (listeners.length === 0) {
      ok((await p.textContent('#btnStartSound')).includes('Торкніться'), '"Tippen zum Starten" erscheint in der gewaehlten Sprache (Ukrainisch)');
      ok((await p.textContent('#startAi')).includes('штучним інтелектом'), 'KI-Hinweis in der gewaehlten Sprache');
      await shot(p, 'listener-1b-start.png');
      await p.click('#btnStartSound');                         // Ton-Freigabe per Tipp
      ok((await p.textContent('#btnSound')) === '🔊', 'Ton ist erst nach dem Tippen an');
    } else {
      await p.click('#btnSubsOnly');
      ok((await p.textContent('#btnSound')) === '🔇', 'ohne Tippen bleibt der Ton aus');
    }
    await p.waitForSelector('#startScreen', { state: 'hidden' });
    listeners.push(p);
  }
  ok(true, 'drei Zuhoerer haben ihre Sprache gewaehlt (uk, ar, ar)');
  await op.waitForFunction(() => /3 Zuh/.test(document.getElementById('statTotal').textContent)
    && /Українська: 1/.test(document.getElementById('statL').textContent)
    && /العربية: 2/.test(document.getElementById('statL').textContent), null, { timeout: 8000 });
  ok(true, 'Bedienplatz zeigt: 3 Zuhoerer, Українська 1, العربية 2');
  const dev = await op.$eval('#dev', (s) => s.options[s.selectedIndex] && s.options[s.selectedIndex].textContent);
  ok(!!dev, 'Mikrofonliste gefuellt: ' + dev);

  await op.click('#btnStart');
  await listeners[0].waitForSelector('.sub', { timeout: 15000 });
  await listeners[1].waitForSelector('.sub', { timeout: 15000 });
  const t0 = await listeners[0].$eval('.sub:last-child', (n) => [n.textContent, n.dir]);
  const t1 = await listeners[1].$eval('.sub:last-child', (n) => [n.textContent, n.dir]);
  ok(t0[0].startsWith('[uk]') && t0[1] === 'ltr', 'Ukrainisch: Untertitel ' + JSON.stringify(t0[0]));
  ok(t1[0].startsWith('[ar]') && t1[1] === 'rtl', 'Arabisch: rechts-nach-links ' + JSON.stringify(t1[0]));
  await shot(listeners[1], 'listener-2-untertitel.png');

  // Sprache waehrend der Sitzung wechseln
  await listeners[0].click('#btnLang');
  await listeners[0].click('#picker button[lang="en"]');
  await listeners[0].waitForFunction(() => document.getElementById('lang').textContent === 'English');
  await listeners[0].waitForFunction(() => { const s = document.querySelectorAll('.sub'); return s.length && s[s.length - 1].textContent.startsWith('[en]'); }, null, { timeout: 15000 });
  ok(true, 'Zuhoerer wechselt waehrend der Sitzung auf Englisch und bekommt englische Untertitel');
  await listeners[0].click('#btnSound');
  ok((await listeners[0].textContent('#btnSound')) === '🔇', 'Ton laesst sich ausschalten');
  await listeners[0].fill('#vol', '0.5');
  ok((await listeners[0].inputValue('#vol')) === '0.5', 'Lautstaerke-Regler vorhanden');
  await op.waitForSelector('#log div', { timeout: 5000 });
  const lat = await op.textContent('#lat');
  ok(/^\d+ ms/.test(lat), 'Bedienplatz zeigt Verzoegerung: ' + lat + ' | ' + await op.textContent('#stages'));
  ok((await op.textContent('#micMsg')).includes('Sendet'), 'Bedienplatz meldet: Sendet');
  await op.waitForFunction(() => /ms/.test(document.getElementById('rtt').textContent), null, { timeout: 8000 });
  ok(true, 'Ping/Netzlaufzeit am Bedienplatz: ' + await op.textContent('#rtt') + ' | ' + await op.textContent('#t1'));
  ok(/Anwendung läuft seit/.test(await op.textContent('#cost')), 'Laufzeit-/Kostenzeile: ' + (await op.textContent('#cost')).slice(0, 60) + ' ...');
  // Einzel-Link je Sprache mit QR
  await op.click('#single summary');
  await op.click('#singleList .link:nth-child(3) button');          // Englisch
  await op.waitForFunction(() => { const i = document.querySelector('#singleList .qr-small'); return i && (i.src || '').startsWith('data:image/svg+xml'); });
  const single = await op.$eval('#singleList code', (n) => n.textContent);
  ok(/&l=en$/.test(single), 'Einzel-Link je Sprache mit QR-Code: ' + single.replace(/t=[^&]*/, 't=…'));
  await shot(op, 'operator-2-live.png', { fullPage: true });

  // Neuladen eines Zuhoerers behaelt die Sprache (steht in der Adresse, nichts wird gespeichert)
  await listeners[1].reload();
  await listeners[1].waitForFunction(() => document.getElementById('status').textContent.includes('live'));
  await listeners[1].click('#btnSubsOnly');
  ok((await listeners[1].textContent('#lang')) === 'العربية', 'Nach Neuladen bleibt Arabisch gewaehlt');

  await op.click('#btnEnd');
  for (const p of listeners) {
    await p.waitForFunction(() => document.getElementById('status').textContent === 'Ende', null, { timeout: 8000 });
  }
  ok(true, 'Sitzungsende erreicht alle Zuhoerer');
  const bad = errors.filter((e) => !/Failed to load resource.*(401|404)/.test(e));
  ok(bad.length === 0, 'keine JS-/CSP-Fehler in der Konsole ' + JSON.stringify(bad));
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e); process.exit(2); });

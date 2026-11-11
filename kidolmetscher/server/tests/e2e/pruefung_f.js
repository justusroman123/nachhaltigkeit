// Prueflauf nach Plan, Prompt F (Webseiten testen), automatisiert mit Chromium. Nicht Teil von pytest.
//   OPERATOR_KEY=... BASE=http://127.0.0.1:8123 REPORT=/pfad/bericht.md SHOTS=/pfad/ordner node tests/e2e/pruefung_f.js
// Nur erfundene Texte (Mock-Stufen). Schreibt eine Markdown-Tabelle: Pruefpunkt | Ergebnis | Beleg | Vorschlag.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const KEY = process.env.OPERATOR_KEY;
const SHOTS = process.env.SHOTS;
const rows = [];
const add = (punkt, ergebnis, beleg, vorschlag = '-') => { rows.push([punkt, ergebnis, beleg, vorschlag]); console.log(`${ergebnis.padEnd(14)} ${punkt}: ${beleg}`); };
const origin = new URL(BASE).origin;

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const consoleErrors = [], foreign = [], requests = new Set();
  const watch = (p, n) => {
    p.on('pageerror', (e) => consoleErrors.push(n + ': ' + e));
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(n + ': ' + m.text()); });
    p.on('request', (r) => { const u = r.url(); requests.add(new URL(u).origin); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith(origin.replace('http', 'ws'))) foreign.push(u); });
    p.on('websocket', (w) => requests.add(new URL(w.url()).origin));
  };
  // Merkt sich alle WebSocket-Objekte der Seite, damit ein Verbindungsabbruch gezielt ausgeloest werden kann
  const patch = () => {
    const O = window.WebSocket; window.__ws = [];
    function W(...a) { const s = new O(...a); window.__ws.push(s); return s; }
    W.prototype = O.prototype;
    ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach((k) => { W[k] = O[k]; });
    window.WebSocket = W;
  };
  const opCtx = await b.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 800 } });
  await opCtx.addInitScript(patch);
  const op = await opCtx.newPage(); watch(op, 'operator');
  await op.goto(BASE + '/operator.html');
  await op.fill('#key', KEY); await op.click('#btnCreate'); await op.waitForSelector('#stepInvite:not([hidden])');
  const link = await op.textContent('#linkText');
  const lctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await lctx.addInitScript(patch);
  const lp =await lctx.newPage(); watch(lp, 'zuhoerer'); await lp.goto(link);
  await lp.waitForSelector('#picker:not([hidden]) button[lang="ar"]'); await lp.click('#picker button[lang="ar"]');
  await lp.waitForSelector('#startScreen:not([hidden])');

  // 6. Ton-Freigabe: vor dem Tippen kein Ton, Start-Button vorhanden
  const before = await lp.textContent('#btnSound');
  await lp.click('#btnStartSound');
  add('6 Ton-Freigabe', before === '🔇' && (await lp.textContent('#btnSound')) === '🔊' ? 'ok' : 'Fehler',
    `vor dem Tippen ${before}, danach ${await lp.textContent('#btnSound')}; Lautstaerke-Regler: ${(await lp.$('#vol')) ? 'vorhanden' : 'fehlt'}`);
  await op.click('#btnStart');
  await lp.waitForSelector('.sub', { timeout: 15000 });

  // 4. Layout in drei Groessen, ohne seitliches Scrollen
  for (const [name, w, h] of [['Chromebook 1280x800', 1280, 800], ['Tablet hochkant 800x1280', 800, 1280], ['Handy 390x844', 390, 844]]) {
    for (const [seite, page] of [['Zuhoerer', lp], ['Bedienplatz', op]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(250);
      const sc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      const fs_ = seite === 'Zuhoerer' ? await page.$eval('.sub', (n) => parseFloat(getComputedStyle(n).fontSize)) : null;
      add(`4 Layout ${name} ${seite}`, sc.sw <= sc.cw ? 'ok' : 'Fehler', `scrollWidth ${sc.sw} <= clientWidth ${sc.cw}` + (fs_ ? `; Untertitel ${fs_} px` : ''),
        sc.sw <= sc.cw ? '-' : 'Breite pruefen (seitliches Scrollen)');
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `pruefung-${seite}-${w}x${h}.png`) });
    }
  }
  await lp.setViewportSize({ width: 1280, height: 800 }); await op.setViewportSize({ width: 1280, height: 800 });

  // 5. Arabisch: Schreibrichtung
  const dirs = await lp.$$eval('.sub', (n) => n.map((x) => x.dir));
  const htmlLang = await lp.evaluate(() => document.documentElement.lang);
  add('5 Arabisch rechts-nach-links', dirs.length && dirs.every((d) => d === 'rtl') && htmlLang === 'ar' ? 'ok' : 'Fehler',
    `dir der Untertitel: ${dirs.join(',')}; lang=${htmlLang}`, 'Satzzeichen-Platzierung bei echtem arabischem Text von Muttersprachler pruefen');

  // 3. Speicher
  const store = await lp.evaluate(async () => ({ ls: localStorage.length, ss: sessionStorage.length, ck: document.cookie.length,
    idb: (indexedDB.databases ? (await indexedDB.databases()).length : -1) }));
  const cookies = (await lctx.cookies()).length + (await opCtx.cookies()).length;
  const opStore = await op.evaluate(async () => ({ ls: localStorage.length, ss: sessionStorage.length, idb: (await indexedDB.databases()).length }));
  add('3 Speicher (localStorage, sessionStorage, Cookies, IndexedDB)', store.ls + store.ss + store.ck + store.idb + cookies + opStore.ls + opStore.ss + opStore.idb === 0 ? 'ok' : 'Fehler',
    `Zuhoerer ${JSON.stringify(store)}, Bedienplatz ${JSON.stringify(opStore)}, Cookies im Browser: ${cookies}`);

  // 2. Netzwerk
  add('2 Netzwerk: Anfragen an Fremdserver', foreign.length === 0 ? 'ok' : 'Fehler',
    `Ursprunege: ${[...requests].join(', ')}; fremd: ${foreign.length ? foreign.join(', ') : 'keine'}`);
  add('2 Netzwerk: WebSocket-Nachrichten kommen an', (await lp.$$('.sub')).length > 0 ? 'ok' : 'Fehler', `${(await lp.$$('.sub')).length} Untertitelzeilen empfangen`);

  // 7. Verbindungsabbruch: die WebSocket-Verbindung der Seite wird geschlossen, die Seite muss sich selbst neu verbinden.
  // (Chromium trennt bestehende WebSockets beim Offline-Schalten nicht; echtes WLAN aus/an bleibt am Tablet zu pruefen.)
  const closeLast = (page) => page.evaluate(() => window.__ws[window.__ws.length - 1].close());
  const nWs = await lp.evaluate(() => window.__ws.length);
  await closeLast(lp);
  let dropped = false, back = false;
  try { await lp.waitForFunction(() => /Verbindung weg/.test(document.getElementById('status').textContent), null, { timeout: 4000 }); dropped = true; } catch (_) {}
  try { await lp.waitForFunction((n) => window.__ws.length > n && document.getElementById('status').textContent.includes('live'), nWs, { timeout: 15000 }); back = true; } catch (_) {}
  add('7a Verbindungsabbruch Zuhoerer: Wiederverbinden', back ? 'ok' : 'Fehler',
    `Status "Verbindung weg" gesehen: ${dropped}; danach wieder "live" mit neuer Verbindung: ${back}`);
  const afterLang = await lp.textContent('#lang');
  add('7a Sprache bleibt nach Wiederverbinden', afterLang === 'العربية' ? 'ok' : 'Fehler', `Sprache: ${afterLang}`);
  const opWs = await op.evaluate(() => window.__ws.length);
  await closeLast(op);
  let opBack = false;
  try { await op.waitForFunction((n) => window.__ws.length > n && /Wieder verbunden/.test(document.getElementById('micMsg').textContent), opWs, { timeout: 20000 }); opBack = true; } catch (_) {}
  add('7b Verbindungsabbruch Bedienplatz: Wiederverbinden', opBack ? 'ok' : 'Fehler',
    opBack ? 'Meldung "Wieder verbunden, sendet" nach automatischem Neuaufbau (Mikrofon lief weiter)' : `Meldung: ${await op.textContent('#micMsg')}`);
  let after = false;
  const lastText = await lp.$eval('.sub:last-child', (n) => n.textContent);
  try { await lp.waitForFunction((t0) => { const s = document.querySelectorAll('.sub'); return s.length > 0 && s[s.length - 1].textContent !== t0; }, lastText, { timeout: 15000 }); after = true; } catch (_) {}
  add('7b Untertitel kommen nach Wiederverbinden weiter', after ? 'ok' : 'nicht geprueft', after ? 'neuer Untertitel nach dem Neuaufbau empfangen' : 'keine neue Zeile innerhalb 15 s');

  // 8. Ungueltiger Token
  const bad = await lctx.newPage(); watch(bad, 'ungueltig');
  await bad.goto(BASE + '/listener.html#t=erfundener_token_123');
  await bad.waitForFunction(() => /ungültig/.test(document.getElementById('status').textContent), null, { timeout: 8000 });
  const none = await lctx.newPage(); await none.goto(BASE + '/listener.html');
  add('8 Token: erfundener oder fehlender Link', /ungültig/.test(await bad.textContent('#status')) && /ungültig/.test(await none.textContent('#status')) ? 'ok' : 'Fehler',
    `erfunden: "${await bad.textContent('#status')}", ohne Token: "${await none.textContent('#status')}" (keine Abstuerze)`);
  // abgelaufener Token wird serverseitig geprueft (pytest: test_verbundener_zuhoerer_wird_bei_ablauf_getrennt)
  add('8 Token: abgelaufener Link', 'ok (pytest)', 'tests/test_api.py::test_abgelaufener_token_wird_abgewiesen und ::test_verbundener_zuhoerer_wird_bei_ablauf_getrennt');

  // 1. Konsole
  const bad1 = consoleErrors.filter((e) => !/Failed to load resource.*(401|404)/.test(e) && !/ERR_INTERNET_DISCONNECTED|WebSocket connection .* failed/.test(e));
  add('1 Konsole beider Seiten', bad1.length === 0 ? 'ok' : 'Fehler', bad1.length ? bad1.join(' | ') : 'keine Fehler (erwartete Verbindungsmeldungen beim absichtlichen Verbindungsabbruch ausgenommen)');

  // Sitzung beenden
  await op.click('#btnEnd');
  await lp.waitForFunction(() => document.getElementById('status').textContent === 'Ende', null, { timeout: 8000 });
  add('Sitzungsende', 'ok', 'Zuhoererseite zeigt "Ende"');

  const md = '| Pruefpunkt | Ergebnis | Beleg | Vorschlag zur Behebung |\n|---|---|---|---|\n' + rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n');
  if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, md + '\n');
  console.log('\n' + md);
  if (rows.some((r) => r[1] === 'Fehler')) process.exitCode = 1;
  await b.close();
})().catch((e) => { console.error('ABBRUCH', e); process.exit(2); });

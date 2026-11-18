// Browser-Test "funktioniert das auf diesem Geraet?": ein Bedienplatz (OP_GERAET) und Gast-Geraete (GERAET) gegen einen echten
// Testserver mit Attrappen. Nur Chromium-Emulation (Fenstergroesse, Touch, Pixeldichte); KEINE echte Safari-/Firefox-Engine,
// KEIN echtes Geraet, KEIN echter Ton. Start (Server wie bei den anderen Tests, siehe README):
//   BASE=http://127.0.0.1:8123 OPERATOR_KEY=... GERAET="iPhone SE" OP_GERAET="Chromebook 125%" node geraete_layout.js
// Optional: SHOTS=/pfad/ordner (Bildschirmfotos), LANG_START=0..4 (Sprache, mit der der Gast beginnt), GAST_CPU / OP_CPU = Drosselfaktor
// der Rechenleistung (z. B. 4: Hauptthread der Seite vierfach langsamer; grobe Naeherung an ein schwaches Geraet), LINK_DELAY_MS = Antwort des
// Servers auf "neuer Link" kuenstlich verzoegern (langsames Netz). Exit-Code 1 bei Fehler.
// Geprueft: Layout ohne Querscrollen, Beruehrungsflaechen, alle fuenf Sprachen (RTL fuer ar/fa), Untertitel sichtbar,
// Verlauf fuer Spaeteinsteiger (bleibt immer an), Neuladen, Netzabbruch, Drehen, "Alle trennen", Sitzungsende,
// keine externen Anfragen, keine Konsolen-/CSP-Fehler, keine Cookies/Speicher.
const { chromium } = require('playwright');
const path = require('path');
const { profil, drosseln } = require('./_geraet');
const BASE = process.env.BASE || 'http://127.0.0.1:8123', KEY = process.env.OPERATOR_KEY, SHOTS = process.env.SHOTS;
const GAST = process.env.GERAET || '', OP = process.env.OP_GERAET || 'Chromebook 125%';
const TAG = `[${GAST || 'Standard'} | ${OP}]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + TAG + ' ' + m); if (!c) fails++; };
const until = async (fn, ms = 10000) => { const t0 = Date.now(); for (;;) { try { if (await fn()) return true; } catch (_) {} if (Date.now() - t0 > ms) return false; await sleep(100); } };
const LANGS = ['uk', 'ar', 'en', 'tr', 'fa'], RTL = ['ar', 'fa'];
const gp = profil(GAST), touch = !!gp.hasTouch;
const press = (p, sel) => (touch ? p.tap(sel) : p.click(sel));
const shot = async (p, name, o = {}) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, (GAST || 'Standard').replace(/[^A-Za-z0-9]+/g, '_') + '-' + name + '.png'), ...o }); };
const INIT = () => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); };

async function kein_querscroll(p, wo) {
  const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: window.innerWidth }));
  ok(m.sw <= m.iw + 1 && m.bw <= m.iw + 1, `${wo}: kein Querscrollen (Seite ${Math.max(m.sw, m.bw)} px, Fenster ${m.iw} px)`);
}
async function ziele(p, sel, wo, min = 44) {            // Beruehrungsflaechen: sichtbare Knoepfe mindestens 44 x 44 CSS-Pixel (Apple: 44 pt, Android: 48 dp)
  const r = await p.$$eval(sel, (els) => els.filter((e) => e.offsetParent !== null).map((e) => { const b = e.getBoundingClientRect(); return [(e.id || e.textContent.trim()).slice(0, 14), Math.round(b.width), Math.round(b.height)]; }));
  const bad = r.filter(([, w, h]) => w < min || h < min);
  ok(r.length > 0 && bad.length === 0, `${wo}: ${r.length} Knoepfe mindestens ${min} px` + (bad.length ? ' ZU KLEIN: ' + JSON.stringify(bad) : ''));
}
async function erreichbar(p, sel, wo) {                 // Vollbild-Ebene (Sprachwahl, Startseite): Anfang UND Ende muessen durch Scrollen erreichbar sein (kein abgeschnittenes Oberteil)
  const r = await p.evaluate((s) => { const c = document.querySelector(s); c.scrollTop = 0; const f = c.firstElementChild.getBoundingClientRect().top; c.scrollTop = c.scrollHeight; const l = c.lastElementChild.getBoundingClientRect().bottom; c.scrollTop = 0; return { f, l, h: window.innerHeight }; }, sel);
  ok(r.f >= -0.5 && r.l <= r.h + 1, `${wo}: Anfang und Ende erreichbar (oberster Punkt ${Math.round(r.f)}, unterster Punkt ${Math.round(r.l)} von ${r.h})`);
}
async function unten_ausgerichtet(p, wo) {              // Untertitelflaeche steht ganz unten und die neueste Zeile wird nicht vom Rand (Kopf, Fuss, Sprechleiste) verdeckt
  const r = await p.evaluate(() => { const m = document.getElementById('subs'), l = m.querySelector('.sub:last-child'); if (!l) return null; const mb = m.getBoundingClientRect(), lb = l.getBoundingClientRect(); return { rest: Math.round(m.scrollHeight - m.scrollTop - m.clientHeight), hoeheMain: Math.round(m.clientHeight), unten: Math.round(lb.bottom - mb.bottom) }; });
  ok(!!r && r.rest <= 3 && r.unten <= 2, `${wo}: neueste Zeile ganz sichtbar, Untertitelflaeche ${r && r.hoeheMain} px hoch` + (r && r.rest > 3 ? ` (noch ${r.rest} px nach unten zu scrollen)` : ''));
}
async function letzte_zeile_sichtbar(p, wo) {
  const v = await p.evaluate(() => { const l = document.querySelector('#subs .sub:last-child'); if (!l) return null; const b = l.getBoundingClientRect(), cs = getComputedStyle(l); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: window.innerHeight, w: window.innerWidth, fs: parseFloat(cs.fontSize) }; });
  ok(!!v && v.bottom <= v.h + 1 && v.top >= -1 && v.left >= -1 && v.right <= v.w + 1, `${wo}: neueste Untertitelzeile liegt ganz im Fenster` + (v ? ` (unten ${Math.round(v.bottom)} von ${v.h})` : ' (keine Zeile)'));
  ok(!!v && v.fs >= 16, `${wo}: Schriftgroesse der Untertitel ${v && v.fs} px (mindestens 16)`);
}
const subs = (p) => p.$$eval('#subs .sub', (n) => n.map((x) => x.textContent));
const text = async (p, sel) => ((await p.textContent(sel)) || '').trim();

(async () => {
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
  const bOp = await chromium.launch({ args: [...args, '--autoplay-policy=no-user-gesture-required'] });   // Bedienplatz: Fake-Mikrofon
  const bGast = await chromium.launch({ args });                                                         // Gaeste: Standard-Regeln fuer Autoplay (Ton erst nach Tippen)
  const errs = [], extern = [], wss = [], pages = [];
  const watch = (p, n) => {
    pages.push([n, p]);
    p.on('pageerror', (e) => errs.push(n + ': ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*(401|404)/.test(m.text())) errs.push(n + ': ' + m.text()); });
    p.on('websocket', (w) => wss.push(w.url()));
    p.on('request', (r) => { const u = r.url(); if (!(u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:'))) extern.push(u); });
  };
  const neuerGast = async (name, steuerbar) => {
    const c = await bGast.newContext(profil(GAST, { permissions: ['microphone'] })); await c.addInitScript(INIT);
    const p = await c.newPage(); watch(p, name); await drosseln(p, process.env.GAST_CPU); const netz = { offline: false, ws: null, srv: null, versuche: 0 };
    if (steuerbar) await p.routeWebSocket(/\/ws\/listener/, (ws) => {          // durchgereicht; kann auf Befehl getrennt und fuer neue Versuche gesperrt werden (Chromiums setOffline trennt keinen offenen WebSocket)
      netz.ws = ws; netz.versuche++;
      if (netz.offline) { ws.close(); return; }
      netz.srv = ws.connectToServer();
    });
    return { c, p, netz };
  };

  // --- Bedienplatz: Sitzung anlegen (alle fuenf Sprachen, Vortrag)
  const opc = await bOp.newContext(profil(OP, { permissions: ['microphone'] })); await opc.addInitScript(INIT);
  const op = await opc.newPage(); watch(op, 'bedienplatz'); await drosseln(op, process.env.OP_CPU);
  await op.goto(BASE + '/operator.html'); await op.waitForSelector('#langs input');
  await kein_querscroll(op, 'Bedienplatz Start');
  await shot(op, 'op-1-start.png', { fullPage: true });
  await op.fill('#key', KEY);
  for (const l of LANGS) { const cb = op.locator(`#langs input[value=${l}]`); if (!(await cb.isChecked())) await cb.check(); }
  await op.click('#btnCreate'); await op.waitForSelector('#stepInvite:not([hidden])');
  await op.waitForFunction(() => (document.getElementById('qr').src || '').startsWith('data:image/svg+xml'));
  const link = (await text(op, '#linkText')).replace(/^https?:\/\/[^/]+/, BASE);
  ok(/listener\.html#t=/.test(link), 'Bedienplatz: Sitzung angelegt, Link und QR-Code stehen da');
  await kein_querscroll(op, 'Bedienplatz mit Link und QR-Code');
  await shot(op, 'op-2-einladen.png', { fullPage: true });

  // --- Gast A: Sprachwahl (Start mit wechselnder Sprache je Geraet)
  const l0 = LANGS[(Number(process.env.LANG_START) || 0) % LANGS.length];
  const A = await neuerGast('gast-A', true); const a = A.p;
  await a.goto(link); await a.waitForSelector('#picker:not([hidden]) button');
  await kein_querscroll(a, 'Gast Sprachwahl');
  const knoepfe = await a.$$eval('#picker button', (n) => n.map((x) => x.getAttribute('lang')));
  ok(knoepfe.join(',') === LANGS.join(','), 'Gast Sprachwahl: alle fuenf Sprachen angeboten (' + knoepfe.join(', ') + ')');
  await ziele(a, '#picker button', 'Gast Sprachwahl'); await erreichbar(a, '#picker', 'Gast Sprachwahl');
  const imFenster = await a.$$eval('#picker button', (n) => n.filter((x) => { const b = x.getBoundingClientRect(); return b.left >= 0 && b.right <= window.innerWidth; }).length);
  ok(imFenster === LANGS.length, 'Gast Sprachwahl: alle Sprachknoepfe liegen waagerecht im Fenster');
  await shot(a, 'g-1-sprachwahl.png');
  await press(a, `#picker button[lang="${l0}"]`);
  await a.waitForSelector('#picker', { state: 'hidden' });
  await a.waitForFunction(() => document.getElementById('status').textContent.includes('live'));
  await a.waitForSelector('#startScreen:not([hidden])');
  const S = await a.evaluate(() => JSON.parse(JSON.stringify(STRINGS)));          // Oberflaechentexte der Seite
  ok((await text(a, '#startAi')) === S[l0].ai, `Gast Startseite: KI-Hinweis in der gewaehlten Sprache (${l0})`);
  ok((await text(a, '#btnStartSound')).includes(S[l0].start), 'Gast Startseite: "Tippen zum Starten" in der gewaehlten Sprache');
  ok((await a.evaluate(() => document.documentElement.lang)) === l0 && (await a.evaluate(() => document.getElementById('startScreen').dir)) === (RTL.includes(l0) ? 'rtl' : 'ltr'),
     `Gast Startseite: Sprache und Schreibrichtung (${RTL.includes(l0) ? 'rtl' : 'ltr'}) gesetzt`);
  await kein_querscroll(a, 'Gast Startseite'); await ziele(a, '#startScreen button', 'Gast Startseite'); await erreichbar(a, '#startScreen', 'Gast Startseite');
  await shot(a, 'g-2-start.png');
  await press(a, '#btnStartSound');
  ok((await text(a, '#btnSound')) === '🔊', 'Gast: Ton ist nach dem Tippen an');
  await a.waitForSelector('#startScreen', { state: 'hidden' });
  await kein_querscroll(a, 'Gast Live-Ansicht (noch leer)'); await ziele(a, 'header button', 'Gast Kopfzeile');

  // --- Bedienplatz sendet (Fake-Mikrofon -> Attrappen-Erkennung); Gast sieht Untertitel
  await op.click('#btnStart');
  ok(await until(async () => (await subs(a)).length >= 2, 25000), 'Gast: Untertitel laufen (mindestens zwei Zeilen)');
  await letzte_zeile_sichtbar(a, 'Gast live'); await unten_ausgerichtet(a, 'Gast live'); await kein_querscroll(a, 'Gast live');
  const zeile = (await subs(a)).pop() || '';
  ok(zeile.startsWith('[' + l0 + ']'), `Gast: Untertitel in der gewaehlten Sprache (${l0}): ${JSON.stringify(zeile.slice(0, 40))}`);
  ok((await a.$eval('#subs .sub:last-child', (n) => n.dir)) === (RTL.includes(l0) ? 'rtl' : 'ltr'), 'Gast: Untertitel-Schreibrichtung stimmt');
  await shot(a, 'g-3-live.png');
  ok(await until(async () => /1 Zuh/.test(await text(op, '#statTotal')), 8000), 'Bedienplatz zeigt den Zuhoerer');
  await kein_querscroll(op, 'Bedienplatz live'); await shot(op, 'op-3-live.png', { fullPage: true });
  await ziele(op, '#btnStop, #btnEnd, #btnDoorShut', 'Bedienplatz Hauptknoepfe', 32);

  // --- alle Sprachen durchschalten (Wechsel waehrend der Sitzung)
  for (const l of LANGS.filter((x) => x !== l0)) {
    await press(a, '#btnLang'); await a.waitForSelector('#picker:not([hidden]) button');
    await press(a, `#picker button[lang="${l}"]`);
    ok(await until(async () => (await a.evaluate(() => document.documentElement.lang)) === l && !(await a.evaluate(() => document.getElementById('picker').hidden === false)), 8000), `Sprachwechsel auf ${l}`);
    ok((await text(a, '#aiText')) === S[l].ai, `  ${l}: KI-Hinweis unten in der Sprache`);
    ok(await until(async () => { const s = await subs(a); return s.length && s[s.length - 1].startsWith('[' + l + ']'); }, 20000), `  ${l}: Untertitel in der neuen Sprache`);
    ok((await a.$eval('#subs .sub:last-child', (n) => n.dir)) === (RTL.includes(l) ? 'rtl' : 'ltr'), `  ${l}: Schreibrichtung ${RTL.includes(l) ? 'rtl' : 'ltr'}`);
    await kein_querscroll(a, `  ${l}`);
    if (RTL.includes(l)) await shot(a, 'g-4-' + l + '.png');
  }

  // --- Netzabbruch und Wiederverbindung (Verbindung wird getrennt, neue Versuche scheitern, dann wieder erlaubt)
  const v0 = A.netz.versuche;
  A.netz.offline = true; try { A.netz.ws.close(); } catch (_) {}
  ok(await until(async () => /Verbindung weg/.test(await text(a, '#status')), 15000), 'Netzabbruch: Seite zeigt "Verbindung weg, neuer Versuch"');
  await sleep(4000);
  ok(A.netz.versuche > v0 + 1, `Netzabbruch: die Seite versucht es selbststaendig weiter (${A.netz.versuche - v0} Versuche in 4 s)`);
  A.netz.offline = false;
  ok(await until(async () => /live/.test(await text(a, '#status')), 40000), 'Netz zurueck: Seite verbindet sich von selbst wieder ("live")');
  ok(await until(async () => (await subs(a)).length > 0, 20000), 'nach Wiederverbindung: Untertitel stehen weiter da');
  await sleep(3000);
  const lines = await subs(a);
  ok(new Set(lines).size === lines.length, `nach Wiederverbindung: keine doppelten Zeilen (${lines.length} Zeilen)`);
  await kein_querscroll(a, 'Gast nach Wiederverbindung');

  // --- Sendepause; Spaeteinsteiger sieht den Verlauf (Untertitel-Verlauf bleibt immer an)
  await op.click('#btnStop'); await sleep(2500);
  // --- Drehen (Hoch- und Querformat) bzw. Fensterwechsel
  const vp = a.viewportSize();
  if (vp) {
    await a.setViewportSize({ width: vp.height, height: vp.width });
    await sleep(800); await kein_querscroll(a, `Gast gedreht (${vp.height} x ${vp.width})`); await shot(a, 'g-5-gedreht.png');
    await letzte_zeile_sichtbar(a, 'Gast gedreht'); await unten_ausgerichtet(a, 'Gast gedreht');
    await a.setViewportSize(vp); await sleep(800);
    await unten_ausgerichtet(a, 'Gast wieder im Hochformat'); await kein_querscroll(a, 'Gast wieder im Hochformat');
  }

  const B = await neuerGast('gast-B'); const bb = B.p;
  await bb.goto(link); await bb.waitForSelector('#picker:not([hidden]) button'); await press(bb, '#picker button[lang="en"]');
  await bb.waitForFunction(() => document.getElementById('status').textContent.includes('live'));
  ok(await until(async () => (await subs(bb)).length >= 1, 6000), 'Spaeteinsteiger sieht sofort den Verlauf (bereits gesendete Untertitel)');
  const h = await subs(bb);
  ok(h.every((t) => t.startsWith('[en]')), `Spaeteinsteiger: Verlauf in der gewaehlten Sprache (${h.length} Zeilen)`);
  await kein_querscroll(bb, 'Spaeteinsteiger'); await shot(bb, 'g-6-spaeteinsteiger.png');
  await press(bb, '#btnSubsOnly');

  // --- Neuladen behaelt Sprache und Verlauf
  await a.reload(); await a.waitForFunction(() => document.getElementById('status').textContent.includes('live'));
  ok((await a.evaluate(() => document.documentElement.lang)) === LANGS.filter((x) => x !== l0).pop(), 'Neuladen: gewaehlte Sprache bleibt (steht in der Adresse)');
  ok(await until(async () => (await subs(a)).length >= 1, 6000), 'Neuladen: Verlauf kommt wieder');
  await press(a, '#btnSubsOnly');

  // --- "Alle trennen, neuen Link erzeugen": beide Gaeste raus, alter Link ungueltig, neuer Link ohne alten Verlauf
  // Der Bedienplatz trennt zuerst (Server) und erzeugt DANACH den neuen Link (zweiter Aufruf): auf den neuen Link wird gewartet, nicht sofort gelesen.
  // Die Zeit vom zweiten Tippen bis zum neuen Link wird mit der Uhr der Seite gemessen (Attrappen-Server, kein echtes Netz).
  const linkVorher = await op.textContent('#linkText');
  const VERZ = Number(process.env.LINK_DELAY_MS || 0);                // Test eines langsamen Servers/Netzes: Antwort auf "neuer Link" kuenstlich verzoegern
  if (VERZ > 0) await op.route(/\/listener-links$/, async (r) => { await sleep(VERZ); try { await r.continue(); } catch (_) {} });
  await op.click('#btnDoorShut');
  const t0Seite = await op.evaluate(() => performance.now());       // Uhr der Seite unmittelbar vor dem zweiten Tippen
  const neuerLinkWartet = op.waitForFunction((alt) => { const t = document.getElementById('linkText').textContent.trim(); return t && t !== alt.trim() && /listener\.html#t=/.test(t) ? performance.now() : false; },
    linkVorher, { polling: 25, timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null);
  await op.click('#btnDoorShut');
  ok(await until(async () => /Vom Mitarbeiter getrennt/.test(await text(a, '#status')), 10000), 'Alle trennen: Gast A getrennt');
  ok(await until(async () => /Vom Mitarbeiter getrennt/.test(await text(bb, '#status')), 10000), 'Alle trennen: Gast B getrennt');
  await kein_querscroll(a, 'Gast nach Trennung'); await shot(a, 'g-7-getrennt.png');
  const frueh = (await text(op, '#linkText')).replace(/^https?:\/\/[^/]+/, BASE);       // so wurde frueher gelesen (sofort, ohne zu warten)
  const tNeuSeite = await neuerLinkWartet;
  const dauerNeuerLink = tNeuSeite === null ? null : Math.round(tNeuSeite - t0Seite);
  const neu = (await text(op, '#linkText')).replace(/^https?:\/\/[^/]+/, BASE);
  console.log('INFO ' + TAG + ' Alle trennen: beim sofortigen Lesen stand ' + (frueh === link ? 'NOCH der alte' : 'schon der neue') + ' Link im Bedienplatz; neuer Link nach ' + (dauerNeuerLink === null ? 'nie' : dauerNeuerLink + ' ms'));
  if (dauerNeuerLink === null) console.log('INFO ' + TAG + ' Alle trennen: Link-Hinweis "' + (await text(op, '#linkInfo')).slice(0, 160) + '", Meldung "' + (await text(op, '#joinNote')).slice(0, 160) + '"');
  ok(dauerNeuerLink !== null && neu !== link && /listener\.html#t=/.test(neu), 'Alle trennen: der Bedienplatz zeigt einen neuen Link' + (dauerNeuerLink !== null ? ' (nach ' + dauerNeuerLink + ' ms)' : ''));
  if (VERZ > 0) await op.unroute(/\/listener-links$/);
  ok(dauerNeuerLink !== null && dauerNeuerLink <= 5000 + VERZ, 'Alle trennen: der neue Link steht innerhalb von 5 s da (Pruefgrenze im Test, Attrappen-Server)');
  const D = await neuerGast('gast-alt'); await D.p.goto(link);
  ok(await until(async () => /ungültig|abgelaufen|getrennt/i.test(await text(D.p, '#status')), 10000), 'alter Link ist ungueltig: "' + (await text(D.p, '#status')) + '"');
  const C = await neuerGast('gast-C'); const cc = C.p;
  await cc.goto(neu); await cc.waitForSelector('#picker:not([hidden]) button'); await press(cc, '#picker button[lang="tr"]');
  await cc.waitForFunction(() => document.getElementById('status').textContent.includes('live'));
  await sleep(1500);
  ok((await subs(cc)).length === 0, 'neuer Link: der Verlauf des vorigen Gastes ist weg (keine Zeile)');
  await press(cc, '#btnSubsOnly');

  // --- Sitzungsende
  await op.click('#btnEnd');
  ok(await until(async () => (await text(cc, '#status')) === 'Ende', 10000), 'Sitzungsende erreicht den Gast');

  // --- Gespraech: Sprechleiste (Band, Knopf, Hinweis) in Hoch- und Querformat; es muss genug Platz fuer Untertitel bleiben
  await op.goto(BASE + '/operator.html'); await op.waitForSelector('#langs input');
  await op.fill('#key', KEY); await op.check('input[name=mode][value=gespraech]');
  for (const l of LANGS) { const cb = op.locator(`#langs input[value=${l}]`); if (!(await cb.isChecked())) await cb.check(); }
  await op.click('#btnCreate'); await op.waitForSelector('#linkText:not(:empty)');
  const glink = (await text(op, '#linkText')).replace(/^https?:\/\/[^/]+/, BASE);
  const E = await neuerGast('gast-gespraech'); const ee = E.p;
  await ee.goto(glink); await ee.waitForSelector('#picker:not([hidden]) button'); await press(ee, '#picker button[lang="uk"]');
  await ee.waitForSelector('#btnSubsOnly', { state: 'visible' }); await press(ee, '#btnSubsOnly');
  await ee.waitForSelector('#talkDock:not([hidden])'); await sleep(800);
  const dock = async (wo) => {
    const r = await ee.evaluate(() => { const g = (id) => document.getElementById(id).getBoundingClientRect(), h = window.innerHeight, d = g('talkDock'), t = g('btnTalk'), n = g('talkNote'), m = document.getElementById('subs');
      return { h, dockUnten: Math.round(d.bottom), tTop: Math.round(t.top), tBottom: Math.round(t.bottom), tH: Math.round(t.height), nBottom: Math.round(n.bottom), nSicht: n.height > 0, subsH: Math.round(m.clientHeight) }; });
    ok(r.tTop >= 0 && r.tBottom <= r.h + 1 && r.dockUnten <= r.h + 1, `${wo}: Sprechen-Knopf und Sprechleiste liegen im Fenster (Knopf ${r.tTop}..${r.tBottom} von ${r.h})`);
    ok(r.tH >= 44, `${wo}: Sprechen-Knopf ${r.tH} px hoch`);
    ok(r.nSicht && r.nBottom <= r.h + 1, `${wo}: Datenschutzhinweis unter dem Sprechen-Knopf bleibt sichtbar`);
    ok(r.subsH >= 90, `${wo}: fuer Untertitel bleiben ${r.subsH} px Hoehe (mindestens 90)`);
  };
  await dock('Gespraech Hochformat'); await kein_querscroll(ee, 'Gespraech Hochformat'); await shot(ee, 'g-8-gespraech.png');
  const vp2 = ee.viewportSize();
  if (vp2) { await ee.setViewportSize({ width: vp2.height, height: vp2.width }); await sleep(800); await dock(`Gespraech gedreht (${vp2.height} x ${vp2.width})`); await kein_querscroll(ee, 'Gespraech gedreht'); await shot(ee, 'g-9-gespraech-gedreht.png'); }
  await op.click('#btnEnd');

  // --- Querpruefungen ueber die ganze Sitzung
  ok(errs.length === 0, 'keine JavaScript- oder Konsolenfehler' + (errs.length ? ': ' + JSON.stringify(errs.slice(0, 3)) : ''));
  ok(extern.length === 0, 'keine Anfrage an eine fremde Adresse' + (extern.length ? ': ' + JSON.stringify(extern.slice(0, 3)) : ''));
  ok(wss.every((u) => u.startsWith('ws://127.0.0.1') || u.startsWith('ws://localhost') || u.startsWith('wss://')), 'WebSocket nur zum eigenen Server (' + wss.length + ' Verbindungen)');
  let csp = [], speicher = [];
  for (const [n, p] of pages) { try { csp.push(...(await p.evaluate(() => window.__csp || [])).map((x) => n + ': ' + x)); speicher.push(await p.evaluate(() => (localStorage.length + sessionStorage.length))); } catch (_) {} }
  ok(csp.length === 0, 'keine CSP-Verletzung' + (csp.length ? ': ' + JSON.stringify(csp.slice(0, 3)) : ''));
  ok(speicher.every((x) => x === 0), 'nichts in localStorage/sessionStorage');
  const cookies = [...(await opc.cookies()), ...(await A.c.cookies()), ...(await B.c.cookies()), ...(await C.c.cookies())];
  ok(cookies.length === 0, 'keine Cookies');

  await bOp.close(); await bGast.close();
  console.log(`ERGEBNIS ${TAG}: ${fails ? fails + ' FEHLER' : 'alles bestanden'}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('E2E-ABBRUCH ' + TAG, e); process.exit(2); });

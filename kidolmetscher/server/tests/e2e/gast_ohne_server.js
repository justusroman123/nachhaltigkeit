// server/tests/e2e/gast_ohne_server.js: Zustandsautomat des Gast-Tablets OHNE echten Server (der WebSocket wird per
// page.routeWebSocket nachgestellt). Schnell, deterministisch, ohne Zeitdruck. Statische Dateien kommen vom laufenden Server (BASE).
//   BASE=http://127.0.0.1:8123 node gast_ohne_server.js     (Exit-Code 1 bei Fehler)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const until = async (fn, ms = 5000) => { const t0 = Date.now(); for (;;) { try { if (await fn()) return true; } catch (_) {} if (Date.now() - t0 > ms) return false; await sleep(50); } };
const DEV = 'gast:test0001';
function wav(seconds, rate = 8000) {                          // gueltige WAV-Datei (16 Bit, mono, Sinus) als Base64
  const n = Math.round(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * 440 * i / rate)), 44 + i * 2);
  return { format: 'wav', sample_rate: rate, data_b64: buf.toString('base64') };
}
const msg = (type, o = {}) => JSON.stringify({ type, v: 1, ...o });
const turn = (state, who, o = {}) => msg('turn', { state, who, reason: '', waiting: [], ...o });

async function szenario(b, name, fn, opts) {                      // frische Seite je Szenario; server = nachgestellter Server
  console.log('--- ' + name);
  const ctx = await b.newContext({ permissions: ['microphone'] });
  await ctx.addInitScript(() => {                             // Mikrofon-Streams merken, um "Mikrofon aus" pruefen zu koennen
    window.__streams = [];
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => { const s = await gum(c); window.__streams.push(s); return s; };
  });
  const page = await ctx.newPage(), got = [], S = { conns: 0, dev: DEV, full: 0 };
  await page.routeWebSocket(/\/ws\/listener/, (ws) => {
    S.ws = ws; S.conns++;
    ws.onMessage((m) => {
      if (typeof m !== 'string') { got.push({ type: 'audio' }); return; }
      const d = JSON.parse(m); got.push(d);
      if (d.type === 'hello') {
        if (S.full > 0) { S.full--; ws.send(msg('error', { code: 'room_full' })); ws.close(); return; }      // Platzgrenze: Server lehnt ab und schliesst
        S.dev = S.conns === 1 ? DEV : 'gast:test000' + S.conns;                                             // neue Verbindung = neue Kennung beim Server
        ws.send(msg('ready', { lang: (opts && opts.nolang) ? null : 'uk', langs: ['uk', 'en'], mode: 'gespraech', turn: { state: 'frei', who: null, waiting: [] }, device: S.dev, sample_rate: 16000, expires_in_s: 3600, operator_online: true }));
      }
    });
  });
  if (opts && opts.full) S.full = opts.full;
  if (opts && opts.clock) await page.clock.install();
  await page.goto(BASE + '/listener.html#t=testtoken' + ((opts && opts.nolang) ? '' : '&l=uk'));
  if (!(opts && opts.nostart)) {
    await page.waitForSelector('#btnSubsOnly', { state: 'visible', timeout: 15000 }); await page.click('#btnSubsOnly');
    await page.waitForSelector('#talkDock:not([hidden])');
  }
  const n = (t, o) => got.filter((m) => m.type === t && (!o || Object.entries(o).every(([k, v]) => m[k] === v))).length;
  await fn(page, S, n, got);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });

  await szenario(b, 'B1/B6: "nicht erkannt" mitten in der Aussage darf das Wort nicht festhalten', async (page, S, n) => {
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: true }) === 1), 'Gast sendet talk on');
    S.ws.send(turn('spricht', DEV));
    ok(await until(() => n('audio') > 3), 'Mikrofon sendet Audio, solange der Gast das Wort hat');
    S.ws.send(msg('problem', { what: 'nicht_erkannt' }));
    await sleep(500);
    await page.click('#btnTalk');                               // Gast tippt "Fertig"
    ok(await until(() => n('talk', { on: false }) === 1, 2000), 'Gast kann das Wort nach "nicht erkannt" mit "Fertig" zurueckgeben (bekanntes Problem: sonst haengt die Sperre bis zur Stille-Frist)');
  });

  await szenario(b, 'B3: Stopp des Mitarbeiters schneidet das Mikrofon sofort ab', async (page, S, n, got) => {
    await page.click('#btnTalk'); await until(() => n('talk', { on: true }) === 1);
    S.ws.send(turn('spricht', DEV)); await until(() => n('audio') > 3);
    S.ws.send(turn('spricht', 'staff', { reason: 'unterbrochen' }));
    ok(await until(() => page.evaluate(() => window.__streams.length > 0 && window.__streams.every((s) => s.getAudioTracks().every((t) => !t.enabled)))), 'Mikrofon-Track ist deaktiviert');
    const a = n('audio'); await sleep(1000);
    ok(n('audio') === a, 'es wird kein Audio mehr gesendet');
    ok(/⚠/.test(await page.textContent('#turnBand')), 'Gast sieht den Hinweis, dass der Mitarbeiter das Wort hat');
    ok(!/stop/i.test(await page.textContent('#btnTalk')) && /^✋/.test((await page.textContent('#btnTalk')).trim()), 'B2: der Gast hat nur die Wortmeldung, keinen Stopp-Knopf');
  });

  await szenario(b, 'B4: Wortmeldung und automatische Uebergabe', async (page, S, n) => {
    S.ws.send(turn('spricht', 'staff'));
    await until(async () => /^✋/.test((await page.textContent('#btnTalk')).trim()));
    await page.click('#btnTalk');
    ok(await until(() => n('want', { on: true }) === 1), 'Wortmeldung wird gesendet');
    ok(n('audio') === 0 && n('talk') === 0, 'der Sprechende wird nicht unterbrochen, das Mikrofon bleibt noch zu');
    S.ws.send(turn('spricht', DEV, { reason: 'naechster' }));
    ok(await until(() => n('talk', { on: true }) === 1), 'Wort wird uebergeben: Mikrofon startet von selbst (talk on ohne Tippen)');
    ok(await until(() => n('audio') > 3), 'und sendet Audio');
  });

  await szenario(b, 'B6: Uebersetzung wird angezeigt und als "fertig" gemeldet', async (page, S, n) => {
    S.ws.send(turn('spricht', 'staff'));
    S.ws.send(msg('translation', { seq: 7, lang: 'uk', text: 'Привіт', final: true, audio: null, t: {} }));
    ok(await until(() => n('shown', { seq: 7 }) === 1), 'angezeigt (shown) wird gemeldet');
    ok(await until(() => n('played', { seq: 7 }) === 1, 8000), 'fertig (played) wird gemeldet (Lesezeit nach Wortzahl)');
  });


  await szenario(b, 'B-01: Verbindung bricht waehrend des Sprechens ab - danach funktioniert "Sprechen" beim ersten Tippen', async (page, S, n) => {
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: true }) === 1), 'Gast sendet talk on');
    S.ws.send(turn('spricht', DEV));
    ok(await until(() => n('audio') > 3), 'Mikrofon sendet');
    S.ws.close();                                               // WLAN weg / Tablet im Ruhezustand
    ok(await until(() => S.conns === 2, 8000), 'Tablet verbindet sich von selbst neu');
    await until(async () => /Sprechen|Speak|Говорити/.test(await page.textContent('#btnTalk')));
    const a = n('audio'); await sleep(600);
    ok(n('audio') === a, 'nach dem Abbruch wird nichts mehr gesendet (Mikrofon aus, Zustand zurueckgesetzt)');
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: true }) === 2, 3000), 'erstes Tippen nach dem Neuaufbau sendet wieder talk on (Knopf nicht tot)');
  });

  await szenario(b, 'B-03: Wort wird uebergeben, obwohl die Wortmeldung gerade zurueckgenommen wurde - sofort zurueckgeben', async (page, S, n) => {
    S.ws.send(turn('spricht', 'staff'));
    await until(async () => /^✋/.test((await page.textContent('#btnTalk')).trim()));
    await page.click('#btnTalk'); await until(() => n('want', { on: true }) === 1);
    S.ws.send(turn('spricht', 'staff', { waiting: [S.dev] }));
    await until(async () => /^✖/.test((await page.textContent('#btnTalk')).trim()));
    await page.click('#btnTalk');
    ok(await until(() => n('want', { on: false }) === 1), 'Wortmeldung wird zurueckgenommen');
    S.ws.send(turn('spricht', S.dev, { reason: 'naechster' }));   // Server war schneller und hat das Wort schon uebergeben
    ok(await until(() => n('talk', { on: false }) === 1, 2000), 'das Wort wird sofort zurueckgegeben (kein 30-s-Stau)');
    ok(n('audio') === 0, 'es wird nichts gesendet');
  });

  await szenario(b, 'B-05a: Hinweis "nicht erkannt" mitten in der Aussage: sichtbar, das Mikrofon bleibt, "Fertig" geht', async (page, S, n) => {
    await page.click('#btnTalk'); await until(() => n('talk', { on: true }) === 1);
    S.ws.send(turn('spricht', DEV)); await until(() => n('audio') > 3);
    S.ws.send(msg('problem', { what: 'nicht_erkannt' }));
    await sleep(2500);
    ok(/⚠/.test(await page.textContent('#turnBand')) && /(repeat|wiederholen|Please repeat|повторіть)/i.test(await page.textContent('#turnBand')), 'Hinweis steht nach 2,5 s noch da');
    const a = n('audio'); await sleep(700);
    ok(n('audio') > a, 'das Mikrofon wurde durch den Hinweis nicht abgeschaltet (Rede laeuft weiter)');
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: false }) === 1, 2000), '"Fertig" gibt das Wort zurueck');
  });

  await szenario(b, 'B-05b: Hinweis kommt zusammen mit den Zustandswechseln nach "Fertig": er bleibt sichtbar', async (page, S, n) => {
    await page.click('#btnTalk'); await until(() => n('talk', { on: true }) === 1);
    S.ws.send(turn('spricht', DEV)); await until(() => n('audio') > 3);
    await page.click('#btnTalk'); await until(() => n('talk', { on: false }) === 1);
    S.ws.send(msg('problem', { what: 'nicht_erkannt' }));
    S.ws.send(turn('uebersetzt', DEV)); S.ws.send(turn('wiedergabe', DEV)); S.ws.send(turn('frei', null));
    await sleep(2500);
    ok(/⚠/.test(await page.textContent('#turnBand')) && /(repeat|wiederholen|Please repeat|повторіть)/i.test(await page.textContent('#turnBand')), 'Hinweis steht nach 2,5 s noch da (wird nicht sofort ueberschrieben)');
  });

  await szenario(b, 'B-07: Platzgrenze beim Neuverbinden - Tablet zeigt "Alle Plaetze belegt" und versucht es erneut', async (page, S, n) => {
    ok(await until(() => S.conns >= 2, 12000), 'nach der Ablehnung (room_full) kommt automatisch ein neuer Versuch');
    ok(!(await page.textContent('#status')).includes('Link ungültig'), 'es erscheint nicht "Link ungueltig"');
    ok(await until(async () => !(await page.isHidden('#talkDock')), 12000), 'danach geht es normal weiter');
  }, { full: 1 });

  await szenario(b, 'B-08: Doppeltipp auf "Sprechen" oeffnet das Mikrofon nur einmal', async (page, S, n) => {
    await page.evaluate(() => { const b = document.getElementById('btnTalk'); b.click(); b.click(); });
    await sleep(1200);
    ok(n('talk', { on: true }) === 1, 'genau ein talk on');
    ok((await page.evaluate(() => window.__streams.length)) === 1, 'genau ein Mikrofon-Zugriff');
  });

  await szenario(b, 'B-09: Stummschalten stoppt schon eingeplanten Ton', async (page, S, n) => {
    await page.evaluate(() => { window.__stops = 0; const P = AudioBufferSourceNode.prototype, sp = P.stop; P.stop = function (...a) { window.__stops++; return sp.apply(this, a); }; });
    await page.click('#btnSound');                              // Ton einschalten
    S.ws.send(turn('spricht', 'staff'));
    S.ws.send(msg('translation', { seq: 1, lang: 'uk', text: 'Один', final: true, audio: wav(4), t: {} }));
    S.ws.send(msg('translation', { seq: 2, lang: 'uk', text: 'Два', final: true, audio: wav(4), t: {} }));
    await sleep(800);
    await page.click('#btnSound');                              // wieder aus
    ok(await until(async () => (await page.evaluate(() => window.__stops)) >= 1, 2000), 'eingeplanter Ton wird gestoppt');
    ok(await until(() => n('played', { seq: 1 }) === 1 && n('played', { seq: 2 }) === 1, 8000), 'die Rueckmeldung "fertig" kommt trotzdem (Sperre haengt nicht)');
  });

  await szenario(b, 'B-11: Sitzungsende gibt das Mikrofon frei und blendet die Sprechleiste aus', async (page, S, n) => {
    await page.click('#btnTalk'); await until(() => n('talk', { on: true }) === 1);
    S.ws.send(turn('spricht', DEV)); await until(() => n('audio') > 3);
    S.ws.send(msg('session_end'));
    ok(await until(() => page.evaluate(() => window.__streams.length > 0 && window.__streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')))), 'Mikrofon-Spuren sind beendet (Aufnahme-Anzeige geht aus)');
    ok(await page.isHidden('#talkDock'), 'Sprechleiste ist weg');
    ok(!/beendet \(keine/.test(await page.textContent('#turnBand')), 'keine falsche Meldung "keine Sprache gehoert"');
  });

  await szenario(b, 'Mitarbeiter nicht verbunden: Gast sieht den Hinweis und der Hinweis verschwindet wieder', async (page, S, n) => {
    S.ws.send(msg('operator', { online: false }));
    ok(await until(async () => /⚠/.test(await page.textContent('#turnBand')) && /(not connected|nicht verbunden|не підключений)/i.test(await page.textContent('#turnBand'))), 'Hinweis erscheint');
    S.ws.send(msg('operator', { online: true }));
    ok(await until(async () => !/(not connected|nicht verbunden|не підключений)/i.test(await page.textContent('#turnBand'))), 'Hinweis verschwindet');
  });


  await szenario(b, 'Information VOR der ersten Aufnahme: Startbildschirm nennt KI, Stimme und Datenschutz (ohne Extra-Klick)', async (page, S, n) => {
    await page.waitForSelector('#startScreen:not([hidden])', { timeout: 10000 });
    const ai = await page.textContent('#startAi'), pv = await page.textContent('#startPrivacy');
    ok(/KI|AI|штучн/i.test(ai), 'KI-Hinweis steht auf dem Startbildschirm');
    ok(/Stimme|voice|голос/i.test(pv) && /(nicht gespeichert|not stored|не зберігається)/i.test(pv), 'Hinweis zur Stimme: nur zum Uebersetzen, nicht gespeichert');
    ok((await page.getAttribute('#startPrivacyLink', 'href')) === 'datenschutz.html' && (await page.textContent('#startPrivacyLink')).length > 2, 'Link zum Datenschutzhinweis ist da');
    ok((await page.getAttribute('#startScreen', 'role')) === 'dialog', 'Startbildschirm ist als Dialog ausgezeichnet');
    ok(n('audio') === 0 && n('talk') === 0, 'bis dahin wurde nichts aufgenommen oder gesendet');
  }, { nostart: true });

  await szenario(b, 'Information VOR der ersten Aufnahme: auch die Sprachwahl hat Hinweis und Link', async (page, S, n) => {
    await page.waitForSelector('#picker:not([hidden])', { timeout: 10000 });
    const t = await page.textContent('#pickerInfo');
    ok(/KI/.test(t) && /AI/.test(t) && /Datenschutz/.test(t), 'Hinweis zweisprachig mit Link "Datenschutz / Privacy"');
    ok((await page.locator('#pickerInfo a[href="datenschutz.html"]').count()) === 1, 'Link zum Datenschutzhinweis');
  }, { nostart: true, nolang: true });

  await szenario(b, 'Mikrofon wird nach Leerlauf wirklich freigegeben (Aufnahme-Anzeige des Geraets geht aus)', async (page, S, n) => {
    await page.click('#btnTalk'); await until(() => n('talk', { on: true }) === 1);
    S.ws.send(turn('spricht', DEV)); await until(() => n('audio') > 3);
    ok(await page.evaluate(() => window.__streams.some((s) => s.getTracks().some((t) => t.readyState === 'live'))), 'beim Sprechen ist das Mikrofon offen');
    await page.click('#btnTalk'); await until(() => n('talk', { on: false }) === 1);
    S.ws.send(turn('frei', null));
    await page.clock.fastForward(10000);
    ok(await page.evaluate(() => window.__streams.some((s) => s.getTracks().some((t) => t.readyState === 'live'))), 'nach 10 s ist es noch stumm gehalten (bereit fuer die naechste Aussage)');
    await page.clock.fastForward(20000);
    ok(await until(() => page.evaluate(() => window.__streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended'))), 3000), 'nach 30 s Leerlauf ist das Mikrofon ganz freigegeben');
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: true }) === 2, 3000), 'beim naechsten Tippen oeffnet es sich wieder');
  }, { clock: true });

  await szenario(b, 'Ende der Sitzung: Zugangscode verschwindet aus der Adresszeile', async (page, S, n) => {
    ok(/#t=testtoken/.test(page.url()), 'vorher steht der Code in der Adresse');
    S.ws.send(msg('session_end'));
    ok(await until(() => !/testtoken/.test(page.url()), 3000), 'danach nicht mehr');
  });

  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles ok');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('E2E-ABBRUCH', e); process.exit(2); });

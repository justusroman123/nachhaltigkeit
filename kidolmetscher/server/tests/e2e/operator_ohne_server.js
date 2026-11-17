// server/tests/e2e/operator_ohne_server.js: Bedienplatz im Gespraechsmodus OHNE echten Gespraechs-Server: nur REST (Raum anlegen)
// kommt vom laufenden Server, der WebSocket wird per page.routeWebSocket nachgestellt. Prueft die Browser-Seiten von B2, B3, B5, B6.
//   BASE=http://127.0.0.1:8123 OPERATOR_KEY=... node operator_ohne_server.js     (Exit-Code 1 bei Fehler)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123', KEY = process.env.OPERATOR_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const until = async (fn, ms = 5000) => { const t0 = Date.now(); for (;;) { try { if (await fn()) return true; } catch (_) {} if (Date.now() - t0 > ms) return false; await sleep(50); } };
const msg = (type, o = {}) => JSON.stringify({ type, v: 1, ...o });
const turn = (state, who, o = {}) => msg('turn', { state, who, reason: '', waiting: [], ...o });

function wav(seconds, rate = 8000) {                          // gueltige WAV-Datei (16 Bit, mono, Sinus) als Base64
  const n = Math.round(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(8000 * Math.sin(2 * Math.PI * 440 * i / rate)), 44 + i * 2);
  return { format: 'wav', sample_rate: rate, data_b64: buf.toString('base64') };
}
const guestMsg = (seq, o = {}) => msg('guest_message', { seq, from_lang: 'uk', text: 'Guten Tag, ich habe eine Frage zu meinem Antrag.', text_src: 'x', audio: null, t: {}, ...o });

async function seite(b) {                                    // frische Seite mit nachgestelltem WebSocket; Sitzung ist noch nicht gestartet
  const ctx = await b.newContext({ permissions: ['microphone'] });
  await ctx.addInitScript(() => {
    window.__starts = 0; window.__stops = 0; window.__wl = { req: 0, rel: 0, type: '' };
    try {                                                           // Bildschirm-Sperre (Wake Lock) nachgestellt: zaehlt Anforderungen und Freigaben
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async (type) => {
        window.__wl.req++; window.__wl.type = type; const ls = [];
        return { addEventListener: (_t, f) => ls.push(f), release() { window.__wl.rel++; ls.forEach((f) => f()); return Promise.resolve(); } };
      } } });
    } catch (_) {}
    const P = AudioBufferSourceNode.prototype, st = P.start, sp = P.stop;
    P.start = function (...a) { window.__starts++; return st.apply(this, a); };
    P.stop = function (...a) { window.__stops++; return sp.apply(this, a); };
  });
  const page = await ctx.newPage(), got = [], S = { conns: 0 };
  await page.routeWebSocket(/\/ws\/operator/, (ws) => {
    S.ws = ws; S.conns++;
    ws.onMessage((m) => {
      if (typeof m !== 'string') return;
      const d = JSON.parse(m); got.push(d);
      if (d.type === 'hello') ws.send(msg('ready', { langs: ['uk'], sample_rate: 16000, mode: 'gespraech', turn: { state: 'frei', who: null, waiting: [] }, flow: { busy: false, pending: 0, awaiting: 0 } }));
      if (d.type === 'ping') ws.send(msg('pong', { t: d.t }));
    });
  });
  const n = (t, o) => got.filter((m) => m.type === t && (!o || Object.entries(o).every(([k, v]) => m[k] === v))).length;
  return { ctx, page, got, S, n };
}
async function sitzungStarten(page, got) {
  const vorher = got.filter((m) => m.type === 'hello').length;
  await page.fill('#key', KEY);
  await page.check('input[name=mode][value=gespraech]'); await page.click('#btnCreate');
  await page.waitForSelector('#linkText:not(:empty)');
  await until(() => got.filter((m) => m.type === 'hello').length > vorher);
  await sleep(500);
}
async function szenario(b, name, fn) {
  console.log('--- ' + name);
  const { ctx, page, got, S, n } = await seite(b);
  await page.goto(BASE + '/operator.html');
  await sitzungStarten(page, got);
  await fn(page, S, n, got);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });

  await szenario(b, 'B2: Stopp des Mitarbeiters', async (page, S, n) => {
    S.ws.send(turn('spricht', 'gast:abc'));
    ok(await until(async () => /Stopp/.test(await page.textContent('#btnTalk'))), 'Knopf zeigt "Stopp - ich spreche jetzt", solange ein Gast spricht');
    await page.click('#btnTalk');
    ok(await until(() => n('takeover') === 1), 'Tippen sendet takeover');
  });

  await szenario(b, 'B3/B5: Gast-Antwort wird auf Deutsch vorgelesen, nicht waehrend der Mitarbeiter spricht; "played" wird gemeldet', async (page, S, n) => {
    S.ws.send(turn('frei', null));
    S.ws.send(guestMsg(1, { audio: wav(0.4) }));
    ok(await until(async () => (await page.evaluate(() => window.__starts)) === 1), 'bei freiem Wort wird die Antwort vorgelesen');
    ok(await until(() => n('played', { seq: 1 }) === 1, 6000), 'B5/B6 Bedienplatz meldet "played" nach dem Vorlesen');
    S.ws.send(turn('spricht', 'staff'));
    await sleep(300);
    S.ws.send(guestMsg(2, { audio: wav(0.4) }));
    ok(await until(() => n('played', { seq: 2 }) === 1, 8000), 'Antwort waehrend der Mitarbeiter spricht: nur Text, "played" wird trotzdem gemeldet');
    ok((await page.evaluate(() => window.__starts)) === 1, 'B3 waehrend der Mitarbeiter spricht, wird nichts vorgelesen');
  });

  await szenario(b, 'B3: laufende Vorlesung wird abgebrochen, wenn der Mitarbeiter das Wort uebernimmt', async (page, S, n) => {
    S.ws.send(turn('spricht', 'gast:abc'));
    S.ws.send(guestMsg(1, { audio: wav(4) }));
    ok(await until(async () => (await page.evaluate(() => window.__starts)) === 1), 'Vorlesung laeuft (4 s Ton)');
    S.ws.send(turn('spricht', 'staff', { reason: 'unterbrochen' }));
    ok(await until(async () => (await page.evaluate(() => window.__stops)) >= 1, 2000), 'Vorlesung wird sofort gestoppt (stop() aufgerufen)');
  });


  await szenario(b, 'B-03: Wort wird uebergeben, obwohl hier niemand sprechen will (Wortmeldung gerade zurueckgenommen): sofort zurueckgeben', async (page, S, n) => {
    S.ws.send(turn('spricht', 'staff', { reason: 'naechster' }));
    ok(await until(() => n('talk', { on: false }) === 1, 2000), 'Bedienplatz gibt das Wort sofort zurueck (kein Stau von 30 s)');
  });

  await szenario(b, 'B-06: Ende nach langer Stille wird dem Mitarbeiter erklaert', async (page, S, n) => {
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: true }) === 1), 'Sprechen wird gesendet');
    S.ws.send(turn('spricht', 'staff'));
    await sleep(300);
    S.ws.send(turn('uebersetzt', 'staff', { reason: 'inaktiv' }));
    ok(await until(async () => /langer Stille/.test(await page.textContent('#talkMsg'))), 'Hinweis "nach langer Stille beendet" erscheint');
  });

  await szenario(b, 'B-04: Verbindungsverlust steht im Hauptband; danach stimmt die Anzeige wieder; nichts bleibt auf "SPRECHEN" stehen', async (page, S, n) => {
    await page.click('#btnTalk'); await until(() => n('talk', { on: true }) === 1);
    S.ws.send(turn('spricht', 'staff'));
    ok(await until(async () => /SIE SPRECHEN/.test(await page.textContent('#talkMsg'))), 'Anzeige: SIE SPRECHEN');
    S.ws.close();
    ok(await until(async () => /Verbindung zum Server unterbrochen/.test(await page.textContent('#talkMsg')), 3000), 'der Ausfall steht im Hauptband (nicht nur in der kleinen Zeile)');
    ok(await until(() => S.conns === 2, 10000), 'neuer Verbindungsversuch');
    ok(await until(async () => /SPRECHEN MÖGLICH/.test(await page.textContent('#talkMsg')), 4000), 'nach dem Neuaufbau: Sprechen moeglich (alter Zustand zurueckgesetzt)');
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: true }) === 2, 2000), 'erstes Tippen nach dem Neuaufbau sendet wieder talk on');
  });

  console.log('--- B-04: Sitzung existiert nicht mehr (Server neu gestartet) - keine Endlosschleife');
  {
    const { ctx, page, got, S, n } = await seite(b);
    await page.goto(BASE + '/operator.html'); await sitzungStarten(page, got);
    S.ws.close({ code: 4404, reason: 'nicht gefunden' });
    ok(await until(async () => !(await page.isHidden('#stepStart')), 4000), 'Anzeige geht zurueck auf "Sitzung starten"');
    ok(/gibt es nicht mehr/.test(await page.textContent('#roomMsg')), 'Klartext: Sitzung gibt es nicht mehr');
    const c = S.conns; await sleep(3500);
    ok(S.conns === c, 'es wird nicht endlos neu verbunden');
    await ctx.close();
  }

  console.log('--- B-12: Doppelklick auf "Sitzung starten" legt nur einen Raum an');
  {
    const { ctx, page, got, S, n } = await seite(b);
    let posts = 0;
    page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/rooms$/.test(r.url())) posts++; });
    await page.goto(BASE + '/operator.html');
    await page.fill('#key', KEY); await page.check('input[name=mode][value=gespraech]');
    await page.evaluate(() => { const b = document.getElementById('btnCreate'); b.click(); b.click(); });
    await page.waitForSelector('#linkText:not(:empty)'); await sleep(800);
    ok(posts === 1, 'genau ein Raum wurde angelegt (' + posts + ')');
    ok(S.conns === 1, 'genau eine Verbindung zum Server (' + S.conns + ')');
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: true }) === 1, 2000), 'Sprechen funktioniert');
    await ctx.close();
  }

  console.log('--- B-10: zweite Sitzung im selben Tab zeigt die ersten Saetze; Vorlesung endet mit der Sitzung');
  {
    const { ctx, page, got, S, n } = await seite(b);
    await page.goto(BASE + '/operator.html'); await sitzungStarten(page, got);
    S.ws.send(turn('frei', null));
    S.ws.send(msg('translation', { seq: 0, lang: 'uk', text: 'ALT', text_src: 'alt-quelle', t: { t_audio_in: 1, t_asr: 2, t_mt: 3, t_tts: 4, t_out: 5 } }));
    S.ws.send(guestMsg(1, { audio: wav(4) }));
    ok(await until(async () => (await page.evaluate(() => window.__starts)) === 1), 'Vorlesung laeuft');
    ok(await until(async () => (await page.locator('.chk').count()) >= 1), 'Kontrolle zeigt die Eintraege der ersten Sitzung');
    await page.click('#btnEnd');
    ok(await until(async () => !(await page.isHidden('#stepStart'))), 'Sitzung beendet');
    ok((await page.evaluate(() => window.__stops)) >= 1, 'die Vorlesung wurde mit der Sitzung gestoppt');
    ok((await page.locator('.chk').count()) === 0 && (await page.locator('#checkEmpty').count()) === 1, 'Kontrolle ist leer, Platzhalter ist wieder da');
    await sitzungStarten(page, got);
    S.ws.send(msg('translation', { seq: 0, lang: 'uk', text: 'NEU', text_src: 'neu-quelle', t: { t_audio_in: 1, t_asr: 2, t_mt: 3, t_tts: 4, t_out: 5 } }));
    ok(await until(async () => (await page.locator('.chk').count()) === 1 && /neu-quelle/.test(await page.textContent('#checkList'))), 'in der zweiten Sitzung erscheint der erste Satz sichtbar');
    ok(!/alt-quelle/.test(await page.textContent('#checkList')), 'keine Reste der ersten Sitzung');
    await ctx.close();
  }


  console.log('--- http-Adresse fuer die Zuhoerer wird deutlich gewarnt');
  {
    const { ctx, page, got, S, n } = await seite(b);
    await page.goto(BASE + '/operator.html'); await sitzungStarten(page, got);
    await page.fill('#base', 'http://192.168.0.5:8000'); await page.click('#btnNewLink');
    ok(await until(async () => /Unverschlüsselte Adresse/.test(await page.textContent('#linkInfo')), 3000), 'Warnung vor unverschluesselter Adresse');
    await page.fill('#base', 'https://dolmetscher.example.org'); await page.click('#btnNewLink');
    ok(await until(async () => !/Unverschlüsselte/.test(await page.textContent('#linkInfo')), 3000), 'bei https keine Warnung');
    ok(/vor.*dem ersten Sprechen/s.test(await page.textContent('#infoText')) || (await page.locator('#infoText').count()) === 1, 'Textvorschlag zur Information der Teilnehmenden ist vorhanden');
    await ctx.close();
  }


  console.log('--- B-13: Der Bedienplatz haelt den Bildschirm waehrend der Sitzung wach und gibt ihn am Ende frei (kein Einschlafen beim langen Sprechen)');
  {
    const { ctx, page, got, S, n } = await seite(b);
    await page.goto(BASE + '/operator.html');
    ok((await page.evaluate(() => window.__wl.req)) === 0, 'vor der Sitzung wird nichts angefordert');
    await sitzungStarten(page, got);
    ok(await until(async () => (await page.evaluate(() => window.__wl.req)) === 1), 'Sitzung angelegt: Bildschirm-Sperre angefordert');
    ok((await page.evaluate(() => window.__wl.type)) === 'screen', 'Art der Sperre: screen');
    await page.click('#btnEnd');
    ok(await until(async () => (await page.evaluate(() => window.__wl.rel)) === 1), 'Sitzung beendet: Sperre wieder freigegeben');
    await ctx.close();
  }

  console.log('--- B-14: Mitarbeiter spricht 3 Stunden (Uhr der Seite vorgestellt): die Seite beendet die Aussage nie von selbst, nur "Fertig" tut es');
  {
    const { ctx, page, got, S, n } = await seite(b);
    await page.clock.install();
    await page.goto(BASE + '/operator.html'); await sitzungStarten(page, got);
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: true }) === 1), 'Sprechen wird gesendet');
    S.ws.send(turn('spricht', 'staff'));
    ok(await until(async () => /SIE SPRECHEN/.test(await page.textContent('#talkMsg'))), 'Anzeige: SIE SPRECHEN');
    await page.clock.fastForward('03:00:00'); await sleep(600);
    ok(/SIE SPRECHEN/.test(await page.textContent('#talkMsg')), 'nach 3 Stunden zeigt die Seite noch SIE SPRECHEN');
    ok(n('talk', { on: false }) === 0, 'die Seite hat die Aussage nicht von selbst beendet');
    ok(/Fertig/.test(await page.textContent('#btnTalk')), 'der Knopf heisst weiter "Fertig"');
    await page.click('#btnTalk');
    ok(await until(() => n('talk', { on: false }) === 1, 2000), 'erst "Fertig" beendet die Aussage');
    await ctx.close();
  }

  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles ok');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('E2E-ABBRUCH', e); process.exit(2); });

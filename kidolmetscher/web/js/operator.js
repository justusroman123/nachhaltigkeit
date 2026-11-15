// Bedienplatz: Sitzung starten, Zuhoerer einladen (Link + QR), Mikrofon als PCM16/16 kHz senden.
// Schluessel und Texte bleiben nur im Arbeitsspeicher dieses Tabs.
(() => {
  'use strict';
  const NAMES = { uk: 'Українська · Ukrainisch', ar: 'العربية · Arabisch', en: 'English · Englisch',
                  tr: 'Türkçe · Türkisch', fa: 'فارسی · Persisch (optional)' };
  const SHORT = { uk: 'Українська', ar: 'العربية', en: 'English', tr: 'Türkçe', fa: 'فارسی' };
  const TTL_MINUTES = [30, 60, 120, 240, 480];
  const $ = (id) => document.getElementById(id);
  const e = { key: $('key'), create: $('btnCreate'), end: $('btnEnd'), roomMsg: $('roomMsg'),
    stepStart: $('stepStart'), stepInvite: $('stepInvite'), stepMic: $('stepMic'), stepLive: $('stepLive'),
    langs: $('langs'), qr: $('qr'), linkText: $('linkText'), copy: $('btnCopy'), ttl: $('ttl'),
    newLink: $('btnNewLink'), base: $('base'), linkInfo: $('linkInfo'), dev: $('dev'), start: $('btnStart'), stop: $('btnStop'),
    level: $('level'), micMsg: $('micMsg'), statTotal: $('statTotal'), statL: $('statL'), lat: $('lat'),
    stages: $('stages'), log: $('log'), singleList: $('singleList'), rtt: $('rtt'), t1: $('t1'),
    backlog: $('backlog'), cost: $('cost'), demo: $('btnDemo'),
    talk: document.querySelector('.talk'), talkBar: $('talkBar'), talkMsg: $('talkMsg'),
    vortragBox: $('vortragBox'), convBox: $('convBox'), btnTalk: $('btnTalk'), btnRelease: $('btnRelease'),
    stepGuest: $('stepGuest'), guestLog: $('guestLog'), stepCheck: $('stepCheck'), checkList: $('checkList'), problemBar: $('problemBar') };

  let key = '', room = null, cfg = null, ws = null, stream = null, ctx = null, node = null, statTimer = 0;
  let wantSending = false, wsRetry = 0, pingTimer = 0, rtts = [], demoMode = false, demoTimer = 0;

  /* ---------- Sprech-Anzeige: eindeutig, wann gesprochen werden darf ----------
     Drei Zustaende, kein Hin und Her:
       idle     gruen  "SPRECHEN MOEGLICH"
       talking  gruen/orange  "SIE SPRECHEN" mit Balken (Laenge des Abschnitts gegen die Grenze der Spracherkennung)
       stop     rot    "STOPP, wird uebersetzt": bleibt mindestens 1,5 s und hoechstens 8 s stehen, bis die Uebersetzung da ist.
     Rein am Bedienplatz aus dem Pegel berechnet (Grenzen vom Server, /api/config). Keine Inhalte. */
  const talk = { state: 'idle', ms: 0, quietMs: 0, loudRun: 0, stopSince: 0, got: false, hintMs: 0 };
  const flow = { busy: false, pending: 0, awaiting: 0, seenBusy: false };   // Server: laeuft noch etwas / fehlt noch ein "fertig" eines Geraets?
  const TALK_MIN_LOUD_MS = 250, TALK_MIN_SPEECH_MS = 500, STOP_MIN_MS = 1500, STOP_NOSEG_MS = 8000, STOP_MAX_MS = 180000;
  const TALK_WARN = 0.65, TALK_LATE = 0.85;
  function talkShow(kind, text, frac) {
    e.talk.className = 'talk ' + kind;
    e.talkBar.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
    e.talkMsg.textContent = text; e.talkMsg.className = 'talkmsg ' + kind;
  }
  function talkIdle(text) {
    talk.state = 'idle'; talk.ms = talk.quietMs = talk.loudRun = talk.hintMs = 0; talk.got = false;
    talkShow('ok', text || '● SPRECHEN MÖGLICH', 0);
  }
  function talkBlock(rmsInt16, blockMs) {
    const maxMs = ((cfg && cfg.utterance_max_s) || 12) * 1000, quietLimit = (cfg && cfg.silence_ms) || 700;
    const loud = rmsInt16 >= ((cfg && cfg.vad_rms) || 400), now = performance.now();
    if (talk.state === 'stop') {
      const el = now - talk.stopSince;
      // STOPP bleibt, bis der Server meldet: nichts wird mehr verarbeitet und alle Geraete haben "fertig" gemeldet
      const done = (flow.seenBusy && !flow.busy && el >= STOP_MIN_MS) || (!flow.seenBusy && el >= STOP_NOSEG_MS) || el >= STOP_MAX_MS;
      if (done) return talkIdle();
      talk.hintMs = loud ? talk.hintMs + blockMs : 0;      // Zustand bleibt, nur der Hinweistext aendert sich
      const what = flow.pending > 0 ? 'wird übersetzt' : (flow.awaiting > 0 ? 'wird bei den Zuhörern ausgegeben' : 'wird übersetzt');
      talkShow('stop', talk.hintMs >= 400 ? '■ STOPP – bitte noch warten, ' + what : '■ STOPP – ' + what, 1);
      return;
    }
    if (talk.state === 'idle') {
      talk.loudRun = loud ? talk.loudRun + blockMs : 0;       // kurze Geraeusche (Klick, Atmen) starten nichts
      if (talk.loudRun < TALK_MIN_LOUD_MS) return;
      talk.state = 'talking'; talk.ms = talk.loudRun; talk.quietMs = 0;
    } else {
      talk.ms += blockMs;
      talk.quietMs = loud ? 0 : talk.quietMs + blockMs;
      if (talk.quietMs >= quietLimit) {                        // lange Pause: der Server schliesst den Abschnitt ab
        if (talk.ms - talk.quietMs < TALK_MIN_SPEECH_MS) return talkIdle();   // zu kurz, der Server verwirft ihn
        talk.state = 'stop'; talk.stopSince = now; talk.got = false; talk.hintMs = 0; flow.seenBusy = flow.busy;
        return talkShow('stop', '■ STOPP – wird übersetzt', 1);
      }
    }
    const f = talk.ms / maxMs;
    if (f >= 1) { talk.ms = 0; return talkShow('warn', 'JETZT PAUSE MACHEN – Abschnitt wurde geteilt', 1); }
    if (f >= TALK_LATE) talkShow('warn', 'JETZT PAUSE MACHEN', f);
    else if (f >= TALK_WARN) talkShow('warn', 'Bald Pause machen …', f);
    else talkShow('ok', '🎙 SIE SPRECHEN', f);
  }

  /* ---------- Gespraechsmodus (Bedienplatz): Sprechen-Knopf, Zustand kommt vom Server ---------- */
  const conv = { talking: false, ms: 0, quietMs: 0, spoke: false, sentMs: 0, sentQuiet: 0, turn: { state: 'frei', who: null } };
  const NO_SPEECH_MS = 5000;                                 // Annahme: ohne Sprache endet der Versuch nach 5 s
  const turnEndMs = () => Math.max(2000, ((cfg && cfg.silence_ms) || 700) + 800);   // Aussage endet etwas nach der Abschnitts-Pause (Annahme)
  const sendJson = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  function convReset() { conv.talking = false; conv.turn = { state: 'frei', who: null }; convRender(); }
  function convMine() { return conv.turn.state === 'spricht' && conv.turn.who === 'staff'; }
  function convRender(hint) {
    const t = conv.turn, mine = convMine();
    e.btnTalk.disabled = !(t.state === 'frei' || mine);
    e.btnTalk.textContent = mine ? '✔ Fertig' : '🎙 Sprechen';
    if (hint) return talkShow('stop', '■ STOPP – ' + hint, 1);
    if (t.state === 'frei') talkShow('ok', '● SPRECHEN MÖGLICH', 0);
    else if (mine) talkShow('ok', '🎙 SIE SPRECHEN', conv.sentMs / (((cfg && cfg.utterance_max_s) || 12) * 1000));
    else if (t.state === 'spricht') talkShow('stop', '■ STOPP – ein Gast spricht', 1);
    else if (t.state === 'uebersetzt') talkShow('stop', '■ STOPP – wird übersetzt', 1);
    else talkShow('stop', '■ STOPP – wird vorgelesen', 1);
  }
  function convTurn(d) {
    conv.turn = d;
    if (!convMine()) conv.talking = false;
    convRender();
  }
  function convStart() {
    conv.talking = true; conv.ms = conv.quietMs = conv.sentMs = conv.sentQuiet = 0; conv.spoke = false;
    sendJson({ type: 'talk', on: true });
  }
  function convEnd() { if (!conv.talking) return; conv.talking = false; sendJson({ type: 'talk', on: false }); }
  function convBlock(rmsInt16, blockMs) {
    if (!conv.talking) {                                          // gesperrt: wer trotzdem spricht, wird gewarnt (die Worte gehen nicht verloren, sondern werden gar nicht erst gesendet)
      if (conv.turn.state !== 'frei' && !convMine() && rmsInt16 >= ((cfg && cfg.vad_rms) || 400)) {
        conv.hintMs = (conv.hintMs || 0) + blockMs;
        if (conv.hintMs >= 400) convRender('bitte warten – Ihre Worte werden jetzt NICHT übersetzt');
      } else conv.hintMs = 0;
      return;
    }
    const loud = rmsInt16 >= ((cfg && cfg.vad_rms) || 400), quietLimit = (cfg && cfg.silence_ms) || 700;
    const maxMs = ((cfg && cfg.utterance_max_s) || 12) * 1000;
    conv.ms += blockMs;
    if (loud) { conv.spoke = true; conv.quietMs = 0; } else conv.quietMs += blockMs;
    conv.sentQuiet = loud ? 0 : conv.sentQuiet + blockMs;           // Satzlaenge: Pause setzt den Balken zurueck
    if (conv.sentQuiet >= quietLimit) conv.sentMs = 0; else if (conv.spoke) conv.sentMs += blockMs;
    if (convMine()) {
      const f = conv.sentMs / maxMs;
      if (f >= TALK_LATE) talkShow('warn', 'JETZT PAUSE MACHEN', f);
      else if (f >= TALK_WARN) talkShow('warn', 'Bald Pause machen …', f);
      else talkShow('ok', '🎙 SIE SPRECHEN', f);
    }
    if ((conv.spoke && conv.quietMs >= turnEndMs()) || (!conv.spoke && conv.ms >= NO_SPEECH_MS)) convEnd();
  }
  e.btnTalk.addEventListener('click', () => {
    if (convMine()) return convEnd();
    if (conv.turn.state === 'frei') {
      if (!ws) { wantSending = true; wsRetry = 0; connectOperator(); return; }
      convStart();
    }
  });
  e.btnRelease.addEventListener('click', () => sendJson({ type: 'release' }));
  const LANG_DE = { uk: 'Ukrainisch', ar: 'Arabisch', en: 'Englisch', tr: 'Türkisch', fa: 'Persisch' };
  function showGuest(d) {
    const empty = $('guestEmpty'); if (empty) empty.remove();
    const row = document.createElement('div'); row.className = 'guestline'; row.dataset.at = String(Date.now());
    const who = document.createElement('div'); who.className = 'who'; who.textContent = 'Gast (' + (LANG_DE[d.from_lang] || d.from_lang) + ')';
    const txt = document.createElement('div'); txt.className = 'txt'; txt.textContent = d.text;
    row.append(who, txt); e.guestLog.prepend(row);
    while (e.guestLog.querySelectorAll('.guestline').length > 40) e.guestLog.querySelector('.guestline:last-of-type').remove();
  }

  /* ---------- Kontrolle: erkannter Text, Uebersetzung je Sprache, Zustellung (angezeigt/gesprochen) ---------- */
  const CHECK_MAX = 10, checks = new Map();
  function checkEntry(seq, src) {
    let c = checks.get(seq);
    if (!c) {
      const empty = $('checkEmpty'); if (empty) empty.remove();
      const box = document.createElement('div'); box.className = 'chk'; box.dataset.at = String(Date.now());
      const head = document.createElement('div'); head.className = 'src';
      box.appendChild(head); e.checkList.prepend(box);
      c = { box, head, rows: {} }; checks.set(seq, c);
      while (checks.size > CHECK_MAX) { const k = checks.keys().next().value; checks.get(k).box.remove(); checks.delete(k); }
    }
    if (src) c.head.textContent = '#' + seq + '  Erkannt: ' + src;
    return c;
  }
  function checkRow(c, lang) {
    if (!c.rows[lang]) {
      const row = document.createElement('div'); row.className = 'row';
      const tr = document.createElement('span'); tr.className = 'tr'; const st = document.createElement('span'); st.className = 'st'; st.textContent = '⏳ wartet …';
      row.append(tr, st); c.box.appendChild(row); c.rows[lang] = { tr, st };
    }
    return c.rows[lang];
  }
  function checkTranslation(d) { const c = checkEntry(d.seq, d.text_src); checkRow(c, d.lang).tr.textContent = '[' + (SHORT[d.lang] || d.lang) + '] ' + d.text; }
  function checkGuest(d) { const c = checkEntry(d.seq, d.text_src); c.head.textContent = '#' + d.seq + '  Gast (' + (SHORT[d.from_lang] || d.from_lang) + '): ' + d.text_src; checkRow(c, 'de').tr.textContent = '[Deutsch] ' + d.text; const st = c.rows.de.st; st.textContent = '✔ beim Mitarbeiter'; st.className = 'st ok'; c.box.classList.add('ok'); }
  function checkDelivery(d) {
    const c = checkEntry(d.seq, null), r = checkRow(c, d.lang);
    if (d.expected === 0) { r.st.textContent = 'kein Zuhörer'; return; }
    const full = d.shown >= d.expected && d.played >= d.expected;
    r.st.textContent = (full ? '✔ ' : '⏳ ') + 'angezeigt ' + d.shown + '/' + d.expected + ' · gesprochen ' + d.played + '/' + d.expected;
    r.st.className = 'st' + (full ? ' ok' : '');
    c.box.classList.toggle('ok', Object.values(c.rows).every((x) => x.st.className.includes('ok')));
  }
  const PROBLEMS = { spracherkennung: 'Spracherkennung fehlgeschlagen, ein Satz ging verloren.', nicht_erkannt: 'Nicht verstanden (zu leise oder unklar).',
    uebersetzung: 'Übersetzung fehlgeschlagen.', audio_verworfen: 'Verbindung zu langsam, ein Stück Sprache ging verloren.',
    geraet_antwortet_nicht: 'Ein Gerät hat die Ausgabe nicht bestätigt (Verbindung prüfen).', gast_nicht_erkannt: 'Gast nicht verstanden (zu leise oder unklar).' };
  let problemTimer = 0;
  function showProblem(d) {
    e.problemBar.textContent = '⚠ ' + (PROBLEMS[d.what] || 'Fehler') + (d.lang ? ' (' + (SHORT[d.lang] || d.lang) + ')' : '') + ' Bitte den letzten Satz wiederholen und in der Kontrolle prüfen.';
    e.problemBar.hidden = false; clearTimeout(problemTimer); problemTimer = setTimeout(() => { e.problemBar.hidden = true; }, 30000);
  }
  function talkTranslated() { if (talk.state === 'stop') talk.got = true; }

  const api = (method, path, body) => fetch(path, {
    method, headers: { 'X-Operator-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', referrerPolicy: 'no-referrer' });
  const say = (el, text, cls) => { el.textContent = text; el.className = cls || ''; };

  /* ---------- Start: Sprachen anzeigen ---------- */
  if (location.protocol === 'file:') {      // Seite wurde als Datei geoeffnet: ohne Server geht nichts
    e.create.disabled = true;
    say(e.roomMsg, 'Diese Seite muss über den Server geöffnet werden, nicht als Datei. ' +
      'Server starten (Windows: start.bat doppelklicken, sonst ./start.sh) und dann http://localhost:8000/ im Browser öffnen. ' +
      'Nur das Mikrofon prüfen geht auch ohne Server: mic-test.html.', 'bad');
    return;
  }
  (async () => {
    try {
      cfg = await (await fetch('/api/config', { cache: 'no-store' })).json();
    } catch (_) { return say(e.roomMsg, 'Server nicht erreichbar. Läuft er und stimmt die Adresse?', 'bad'); }
    e.base.value = cfg.public_url || location.origin;
    if (cfg.key_required === false) { $('keyRow').hidden = true; key = ''; }   // Demo ohne Schluessel
    cfg.langs.forEach((l) => {
      const lab = document.createElement('label'); lab.className = 'chip';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = l; cb.checked = cfg.default_langs.includes(l);
      lab.append(cb, document.createTextNode(NAMES[l] || l));
      e.langs.appendChild(lab);
    });
    TTL_MINUTES.filter((m) => m * 60 >= cfg.min_listener_ttl_s && m * 60 <= cfg.max_listener_ttl_s).forEach((m) => {
      const o = document.createElement('option'); o.value = String(m * 60);
      o.textContent = m < 60 ? m + ' Minuten' : (m / 60) + (m === 60 ? ' Stunde' : ' Stunden');
      if (m * 60 === cfg.listener_ttl_s) o.selected = true;
      e.ttl.appendChild(o);
    });
  })();

  /* ---------- Sitzung ---------- */
  e.create.addEventListener('click', async () => {
    if (!(cfg && cfg.key_required === false)) key = e.key.value;
    const chosen = [...e.langs.querySelectorAll('input:checked')].map((c) => c.value);
    if (!chosen.length) return say(e.roomMsg, 'Bitte mindestens eine Sprache anhaken.', 'warn');
    if (!key && !(cfg && cfg.key_required === false)) return say(e.roomMsg, 'Bitte den Bedienschlüssel eingeben.', 'warn');
    try {
      const mode = (document.querySelector('input[name=mode]:checked') || {}).value || 'vortrag';
      const r = await api('POST', '/api/rooms', { langs: chosen, mode });
      if (r.status === 401) return say(e.roomMsg, 'Bedienschlüssel falsch.', 'bad');
      if (!r.ok) return say(e.roomMsg, 'Fehler ' + r.status + ' beim Starten.', 'bad');
      room = await r.json();
    } catch (_) { return say(e.roomMsg, 'Server nicht erreichbar.', 'bad'); }
    e.key.value = '';
    e.stepStart.hidden = true;
    [e.stepInvite, e.stepMic, e.stepLive, e.stepCheck].forEach((s) => { s.hidden = false; });
    const conversation = room.mode !== 'vortrag';              // Dolmetschen und Gespraech: Sprechen-Knopf mit Sperre
    e.vortragBox.hidden = conversation; e.convBox.hidden = !conversation; e.stepGuest.hidden = room.mode !== 'gespraech';
    await createInvite();
    renderSingleLinks();
    await listDevices();
    if (conversation) { convReset(); wantSending = true; wsRetry = 0; connectOperator(); }   // Gespraech: Verbindung steht von Anfang an (Gast-Antworten kommen jederzeit)
    statTimer = setInterval(pollStats, 2000); pollStats();
  });

  e.end.addEventListener('click', endSession);
  async function endSession() {
    stopSending();
    clearInterval(statTimer);
    if (room) { try { await api('DELETE', '/api/rooms/' + room.room_id); } catch (_) {} }
    room = null; key = '';
    e.log.replaceChildren(); e.statL.replaceChildren(); e.qr.removeAttribute('src'); e.linkText.textContent = '';
    [e.stepInvite, e.stepMic, e.stepLive, e.stepGuest, e.stepCheck].forEach((s) => { s.hidden = true; });
    e.checkList.querySelectorAll('.chk').forEach((n) => n.remove());
    e.guestLog.querySelectorAll('.guestline').forEach((n) => n.remove());
    e.stepStart.hidden = false;
    say(e.roomMsg, 'Sitzung beendet. Alle Puffer und Links sind gelöscht. Erinnerung: GPU-Server jetzt beenden oder pausieren (Kosten laufen sonst weiter) und auf den Tablets den Browserverlauf löschen.', 'ok');
    e.cost.textContent = ''; rtts = [];
  }

  /* ---------- Einladung: Link + QR ---------- */
  async function createInvite() {
    if (!/^https?:\/\//.test(e.base.value.trim())) return say(e.linkInfo, 'Adresse muss mit "http" oder "https" beginnen.', 'bad');
    const r = await api('POST', '/api/rooms/' + room.room_id + '/listener-links', { ttl_s: Number(e.ttl.value) });
    if (!r.ok) return say(e.linkInfo, 'Link konnte nicht erzeugt werden (Fehler ' + r.status + ').', 'bad');
    const d = await r.json();
    const url = e.base.value.trim().replace(/\/+$/, '') + d.path;
    e.linkText.textContent = url;
    say(e.linkInfo, 'Läuft in ' + Math.round(d.expires_in_s / 60) + ' Minuten ab. Angebotene Sprachen: ' +
      room.langs.map((l) => SHORT[l] || l).join(', ') + '.');
    try {
      const q = await api('POST', '/api/qr', { url });
      if (q.ok) e.qr.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(await q.text());
    } catch (_) { /* Link bleibt nutzbar */ }
  }
  e.newLink.addEventListener('click', createInvite);

  // Einzel-Link je Sprache (Plan, Phase 4: QR-Code und Link je Sprache)
  function renderSingleLinks() {
    e.singleList.replaceChildren();
    room.langs.forEach((l) => {
      const row = document.createElement('div'); row.className = 'link';
      const name = document.createElement('strong'); name.textContent = SHORT[l] || l;
      const btn = document.createElement('button'); btn.textContent = 'Link und QR-Code erzeugen';
      const out = document.createElement('div'); out.className = 'single-out';
      btn.addEventListener('click', async () => {
        const r = await api('POST', '/api/rooms/' + room.room_id + '/listener-links', { lang: l, ttl_s: Number(e.ttl.value) });
        if (!r.ok) return say(out, 'Fehler ' + r.status, 'bad');
        const d = await r.json();
        const url = e.base.value.trim().replace(/\/+$/, '') + d.path;
        out.replaceChildren();
        const code = document.createElement('code'); code.textContent = url;
        const copy = document.createElement('button'); copy.textContent = 'Kopieren';
        copy.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(url); copy.textContent = 'Kopiert ✓'; } catch (_) { copy.textContent = 'Von Hand markieren'; }
        });
        const img = document.createElement('img'); img.width = 140; img.height = 140; img.alt = 'QR-Code ' + (SHORT[l] || l); img.className = 'qr-small';
        out.append(code, copy, img);
        try {
          const q = await api('POST', '/api/qr', { url });
          if (q.ok) img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(await q.text());
        } catch (_) {}
      });
      row.append(name, btn, out); e.singleList.appendChild(row);
    });
  }
  e.copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(e.linkText.textContent); e.copy.textContent = 'Kopiert ✓'; }
    catch (_) { e.copy.textContent = 'Bitte Link von Hand markieren'; }
    setTimeout(() => { e.copy.textContent = 'Link kopieren'; }, 2500);
  });

  /* ---------- Mikrofon ---------- */
  async function listDevices() {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });   // noetig fuer Geraetenamen
      tmp.getTracks().forEach((t) => t.stop());
    } catch (err) {
      return say(e.micMsg, err.name === 'NotAllowedError'
        ? 'Mikrofon nicht erlaubt. Oben in der Adressleiste das Schloss-Symbol antippen und „Mikrofon“ erlauben, dann Seite neu laden.'
        : 'Kein Mikrofon gefunden oder Zugriff nicht möglich (' + err.name + '). Empfänger angesteckt? Sicherer Zugriff nötig: HTTPS oder localhost.', 'bad');
    }
    const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    e.dev.replaceChildren();
    all.forEach((d, i) => { const o = document.createElement('option'); o.value = d.deviceId;
      o.textContent = d.label || 'Eingang ' + (i + 1); e.dev.appendChild(o); });
    const dji = all.find((d) => /DJI/i.test(d.label));            // DJI Mic automatisch vorwaehlen
    if (dji) e.dev.value = dji.deviceId;
    say(e.micMsg, dji ? 'DJI-Mikrofon erkannt und gewählt.' : 'Bitte das Mikrofon in der Liste prüfen.', dji ? 'ok' : 'warn');
  }

  // Verbindung zum Server; bei Abbruch waehrend des Sendens automatisch neu verbinden (Mikrofon laeuft weiter)
  function connectOperator() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const sock = new WebSocket(proto + '//' + location.host + '/ws/operator');
    ws = sock;
    sock.binaryType = 'arraybuffer';
    sock.onopen = () => sock.send(JSON.stringify({ type: 'hello', room_id: room.room_id, operator_key: key }));
    sock.onclose = () => {
      clearInterval(pingTimer);
      if (ws !== sock) return;                       // bewusst beendet
      ws = null;
      if (wantSending && room) {
        say(e.micMsg, 'Verbindung zum Server weg, neuer Versuch … (Mikrofon läuft weiter)', 'warn');
        setTimeout(() => { if (wantSending && room && !ws) connectOperator(); }, Math.min(8000, 1000 * 2 ** wsRetry++));
      } else { stopSending(); say(e.micMsg, 'Verbindung zum Server beendet.', 'warn'); }
    };
    sock.onmessage = async (ev) => {
      const d = JSON.parse(ev.data);
      if (d.type === 'ready') {
        wsRetry = 0;
        if (d.turn) conv.turn = d.turn;
        if (demoMode) { if (!demoTimer) startDemo(d.sample_rate); else say(e.micMsg, '● Wieder verbunden, Demo läuft.', 'ok'); }
        else if (!node) await startCapture(d.sample_rate); else say(e.micMsg, '● Wieder verbunden.', 'ok');
        if (room && room.mode !== 'vortrag') convRender();
        clearInterval(pingTimer);
        pingTimer = setInterval(() => { if (sock.readyState === 1) sock.send(JSON.stringify({ type: 'ping', t: performance.now() })); }, 2000);
      } else if (d.type === 'translation') { showMessage(d); talkTranslated(); checkTranslation(d); }
      else if (d.type === 'turn') convTurn(d);
      else if (d.type === 'flow') { flow.busy = d.busy; flow.pending = d.pending; flow.awaiting = d.awaiting; if (d.busy) flow.seenBusy = true; }
      else if (d.type === 'delivery') checkDelivery(d);
      else if (d.type === 'problem') showProblem(d);
      else if (d.type === 'busy') { conv.talking = false; convRender('Gerade spricht jemand oder es wird übersetzt.'); }
      else if (d.type === 'guest_message') { showGuest(d); checkGuest(d); }
      else if (d.type === 'pong') showPing(performance.now() - d.t);
    };
  }
  e.start.addEventListener('click', () => { if (ws) return; demoMode = false; wantSending = true; wsRetry = 0; connectOperator(); });
  e.demo.addEventListener('click', () => { if (ws) return; demoMode = true; wantSending = true; wsRetry = 0; connectOperator(); });

  // Demo ohne Mikrofon: 50-ms-Bloecke Stille, damit die Attrappen Testsaetze liefern
  function startDemo(rate) {
    const block = new Int16Array(Math.round(rate * 0.05)).buffer;
    demoTimer = setInterval(() => { if (ws && ws.readyState === 1) ws.send(block.slice(0)); }, 50);
    e.start.disabled = true; e.demo.disabled = true; e.stop.disabled = false;
    say(e.micMsg, '● Demo läuft: es wird Stille gesendet, die Attrappe liefert Testsätze.', 'ok');
  }

  function showPing(rtt) {
    rtts.push(rtt); if (rtts.length > 10) rtts.shift();
    const sorted = [...rtts].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    e.rtt.textContent = Math.round(rtt) + ' ms (Median der letzten ' + rtts.length + ': ' + Math.round(med) + ' ms)';
    // Schaetzung: halber Ping + 50 ms Blockgroesse + Eingangslatenz des Browsers (Annahme, keine Messung der echten Strecke)
    const base = ctx && ctx.baseLatency ? ctx.baseLatency * 1000 : 0;
    const est = med / 2 + 50 + base;
    e.t1.textContent = '≈ ' + Math.round(est) + ' ms (Schätzung)';
    e.t1.className = est <= 300 ? 'ok' : 'warn';
  }

  async function startCapture(rate) {
    try {
      // Sprachverbesserungen aus: die Spracherkennung bekommt das Rohsignal (Vergleich im Mikrofon-Test)
      stream = await navigator.mediaDevices.getUserMedia({ audio: {
        deviceId: e.dev.value ? { exact: e.dev.value } : undefined,
        channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      ctx = new AudioContext({ sampleRate: rate });
      await ctx.audioWorklet.addModule('js/pcm-worklet.js');
      node = new AudioWorkletNode(ctx, 'pcm-capture');
      node.port.onmessage = (ev) => {
        const buf = ev.data;
        const inConv = room && room.mode !== 'vortrag';
        if (ws && ws.readyState === 1 && (!inConv || conv.talking)) ws.send(buf);     // Gespraech: nur senden, solange man das Wort hat
        const s = new Int16Array(buf); let sum = 0;
        for (let i = 0; i < s.length; i++) sum += s[i] * s[i];
        const db = 20 * Math.log10(Math.sqrt(sum / s.length) / 32768 + 1e-6);
        e.level.style.width = Math.max(0, Math.min(100, (db + 60) / 60 * 100)) + '%';
        const rmsNow = Math.sqrt(sum / s.length), blockMs = s.length / (ctx ? ctx.sampleRate : 16000) * 1000;
        if (inConv) convBlock(rmsNow, blockMs); else talkBlock(rmsNow, blockMs);
      };
      ctx.createMediaStreamSource(stream).connect(node);
      e.start.disabled = true; e.stop.disabled = false;
      if (room && room.mode !== 'vortrag') convRender(); else talkIdle();
      say(e.micMsg, room && room.mode !== 'vortrag' ? '● Mikrofon bereit. Zum Sprechen „Sprechen“ tippen.' : '● Sendet.', 'ok');
    } catch (err) { say(e.micMsg, 'Mikrofon-Fehler: ' + err.name, 'bad'); stopSending(); }
  }

  function stopSending() {
    wantSending = false; clearInterval(pingTimer); clearInterval(demoTimer); demoTimer = 0; demoMode = false; e.demo.disabled = false;
    if (ws) { const w = ws; ws = null; try { w.send(JSON.stringify({ type: 'end' })); } catch (_) {} w.close(); }
    if (node) { node.disconnect(); node = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    e.level.style.width = '0%'; talk.state = 'idle'; talk.ms = 0; conv.talking = false; talkShow('ok', 'Noch nicht gesendet.', 0);
    e.start.disabled = false; e.stop.disabled = true;
  }
  e.stop.addEventListener('click', () => { stopSending(); say(e.micMsg, 'Pause. Zum Weitermachen „Senden starten“.', ''); });

  /* ---------- Anzeige ---------- */
  function showMessage(d) {
    const t = d.t, n = (a, b) => (a == null || b == null ? '–' : (b - a));
    const tts = t.t_tts == null ? t.t_mt : t.t_tts;
    e.lat.textContent = (t.t_out - t.t_audio_in) + ' ms';
    e.stages.textContent = n(t.t_audio_in, t.t_asr) + ' / ' + n(t.t_asr, t.t_mt) + ' / ' +
      n(t.t_mt, t.t_tts) + ' / ' + n(tts, t.t_out) + ' ms';
    const row = document.createElement('div');
    row.textContent = '#' + d.seq + ' [' + d.lang + '] ' + d.text_src + ' → ' + d.text;
    row.dataset.at = String(Date.now());
    e.log.prepend(row);
    while (e.log.children.length > 20) e.log.removeChild(e.log.lastElementChild);
  }

  function showCost(s) {
    const h = Math.floor(s.server_uptime_s / 3600), m = Math.floor((s.server_uptime_s % 3600) / 60);
    let text = 'Anwendung läuft seit ' + h + ' h ' + String(m).padStart(2, '0') + ' min. ';
    let cls = 'muted';
    if (s.server_hourly_eur) {
      const eur = s.server_uptime_s / 3600 * s.server_hourly_eur;
      text += 'Geschätzte Serverkosten seit Programmstart: ' + eur.toFixed(2).replace('.', ',') + ' € netto (ohne Zuschläge, Stundenpreis ' +
        String(s.server_hourly_eur).replace('.', ',') + ' €).';
      if (s.budget_eur) {
        text += ' Budget ' + s.budget_eur + ' €.';
        if (eur >= s.budget_eur) { cls = 'bad'; text += ' BUDGET ERREICHT: Server beenden oder pausieren!'; }
        else if (eur >= 0.8 * s.budget_eur) { cls = 'warn'; text += ' Über 80 % des Budgets.'; }
      }
    } else text += 'Kosten: unbekannt (SERVER_HOURLY_EUR nicht gesetzt).';
    text += ' Gezählt wird die Laufzeit dieser Anwendung, nicht die der gemieteten Maschine.';
    e.cost.textContent = text; e.cost.className = cls;
  }

  async function pollStats() {
    if (!room) return;
    try {
      const r = await api('GET', '/api/rooms/' + room.room_id + '/stats');
      if (!r.ok) return;
      const s = await r.json();
      const chosen = Object.values(s.listeners).reduce((a, b) => a + b, 0);
      e.statTotal.textContent = s.listeners_connected === 0 ? 'Noch keine Zuhörer verbunden.'
        : s.listeners_connected + ' Zuhörer verbunden' +
          (s.listeners_connected > chosen ? ' (' + (s.listeners_connected - chosen) + ' wählen gerade ihre Sprache)' : '') + '.';
      const c = s.counters || {};
      e.backlog.textContent = (c.audio_skipped_backpressure || 0) + ' / ' + (c.segments_dropped_backpressure || 0) +
        ((c.audio_dropped || 0) ? ' (Audio-Blöcke verworfen: ' + c.audio_dropped + ')' : '');
      showCost(s);
      e.statL.replaceChildren();
      Object.entries(s.listeners).forEach(([l, c]) => {
        const chip = document.createElement('span'); chip.className = 'chip static';
        chip.textContent = (SHORT[l] || l) + ': ' + c; e.statL.appendChild(chip);
      });
    } catch (_) {}
  }

  // Verlauf im Bedienplatz: Eintraege aelter als 2 Minuten werden geloescht
  setInterval(() => { const limit = Date.now() - 120000;
    [...e.log.children, ...e.guestLog.querySelectorAll('.guestline')].forEach((r) => { if (Number(r.dataset.at) < limit) r.remove(); });
    [...checks].forEach(([k, c]) => { if (Number(c.box.dataset.at) < limit) { c.box.remove(); checks.delete(k); } }); }, 1000);

  window.addEventListener('pagehide', () => { stopSending(); });
})();

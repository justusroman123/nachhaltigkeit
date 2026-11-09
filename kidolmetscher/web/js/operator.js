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
    stages: $('stages'), log: $('log') };

  let key = '', room = null, cfg = null, ws = null, stream = null, ctx = null, node = null, statTimer = 0;

  const api = (method, path, body) => fetch(path, {
    method, headers: { 'X-Operator-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', referrerPolicy: 'no-referrer' });
  const say = (el, text, cls) => { el.textContent = text; el.className = cls || ''; };

  /* ---------- Start: Sprachen anzeigen ---------- */
  (async () => {
    try {
      cfg = await (await fetch('/api/config', { cache: 'no-store' })).json();
    } catch (_) { return say(e.roomMsg, 'Server nicht erreichbar. Läuft er und stimmt die Adresse?', 'bad'); }
    e.base.value = cfg.public_url || location.origin;
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
    key = e.key.value;
    const chosen = [...e.langs.querySelectorAll('input:checked')].map((c) => c.value);
    if (!chosen.length) return say(e.roomMsg, 'Bitte mindestens eine Sprache anhaken.', 'warn');
    if (!key) return say(e.roomMsg, 'Bitte den Bedienschlüssel eingeben.', 'warn');
    try {
      const r = await api('POST', '/api/rooms', { langs: chosen });
      if (r.status === 401) return say(e.roomMsg, 'Bedienschlüssel falsch.', 'bad');
      if (!r.ok) return say(e.roomMsg, 'Fehler ' + r.status + ' beim Starten.', 'bad');
      room = await r.json();
    } catch (_) { return say(e.roomMsg, 'Server nicht erreichbar.', 'bad'); }
    e.key.value = '';
    e.stepStart.hidden = true;
    [e.stepInvite, e.stepMic, e.stepLive].forEach((s) => { s.hidden = false; });
    await createInvite();
    await listDevices();
    statTimer = setInterval(pollStats, 2000); pollStats();
  });

  e.end.addEventListener('click', endSession);
  async function endSession() {
    stopSending();
    clearInterval(statTimer);
    if (room) { try { await api('DELETE', '/api/rooms/' + room.room_id); } catch (_) {} }
    room = null; key = '';
    e.log.replaceChildren(); e.statL.replaceChildren(); e.qr.removeAttribute('src'); e.linkText.textContent = '';
    [e.stepInvite, e.stepMic, e.stepLive].forEach((s) => { s.hidden = true; });
    e.stepStart.hidden = false;
    say(e.roomMsg, 'Sitzung beendet. Alle Puffer und Links sind gelöscht.', 'ok');
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

  e.start.addEventListener('click', () => {
    if (ws) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws/operator');
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', room_id: room.room_id, operator_key: key }));
    ws.onclose = () => { if (ws) { ws = null; stopSending(); say(e.micMsg, 'Verbindung zum Server beendet.', 'warn'); } };
    ws.onmessage = async (ev) => {
      const d = JSON.parse(ev.data);
      if (d.type === 'ready') { await startCapture(d.sample_rate); }
      else if (d.type === 'translation') showMessage(d);
    };
  });

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
        if (ws && ws.readyState === 1) ws.send(buf);
        const s = new Int16Array(buf); let sum = 0;
        for (let i = 0; i < s.length; i++) sum += s[i] * s[i];
        const db = 20 * Math.log10(Math.sqrt(sum / s.length) / 32768 + 1e-6);
        e.level.style.width = Math.max(0, Math.min(100, (db + 60) / 60 * 100)) + '%';
      };
      ctx.createMediaStreamSource(stream).connect(node);
      e.start.disabled = true; e.stop.disabled = false;
      say(e.micMsg, '● Sendet. Bitte sprechen.', 'ok');
    } catch (err) { say(e.micMsg, 'Mikrofon-Fehler: ' + err.name, 'bad'); stopSending(); }
  }

  function stopSending() {
    if (ws) { const w = ws; ws = null; try { w.send(JSON.stringify({ type: 'end' })); } catch (_) {} w.close(); }
    if (node) { node.disconnect(); node = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (ctx) { ctx.close().catch(() => {}); ctx = null; }
    e.level.style.width = '0%';
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
    e.log.prepend(row);
    while (e.log.children.length > 30) e.log.removeChild(e.log.lastElementChild);
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
      e.statL.replaceChildren();
      Object.entries(s.listeners).forEach(([l, c]) => {
        const chip = document.createElement('span'); chip.className = 'chip static';
        chip.textContent = (SHORT[l] || l) + ': ' + c; e.statL.appendChild(chip);
      });
    } catch (_) {}
  }

  window.addEventListener('pagehide', () => { stopSending(); });
})();

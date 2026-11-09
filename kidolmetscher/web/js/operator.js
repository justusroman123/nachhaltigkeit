// Bedienplatz: Sitzung anlegen, Zuhoerer-Links erzeugen, Mikrofon als PCM16/16 kHz senden.
// Schluessel und Texte bleiben nur im Arbeitsspeicher dieses Tabs.
(() => {
  'use strict';
  const NAMES = { uk: 'Українська (uk)', ar: 'العربية (ar)', en: 'English (en)', tr: 'Türkçe (tr)', fa: 'فارسی (fa)' };
  const $ = (id) => document.getElementById(id);
  const e = { key: $('key'), create: $('btnCreate'), end: $('btnEnd'), roomMsg: $('roomMsg'),
    secLinks: $('secLinks'), secMic: $('secMic'), secOut: $('secOut'), langs: $('langs'), ttl: $('ttl'),
    btnLinks: $('btnLinks'), links: $('links'), dev: $('dev'), start: $('btnStart'), stop: $('btnStop'),
    level: $('level'), micMsg: $('micMsg'), statL: $('statL'), lat: $('lat'), stages: $('stages'), log: $('log') };

  let key = '', room = null, ws = null, stream = null, ctx = null, node = null, statTimer = 0;

  const api = (method, path, body) => fetch(path, {
    method, headers: { 'X-Operator-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', referrerPolicy: 'no-referrer' });
  const say = (el, text, cls) => { el.textContent = text; el.className = cls || ''; };

  /* ---------- Sitzung ---------- */
  e.create.addEventListener('click', async () => {
    key = e.key.value;
    try {
      const r = await api('POST', '/api/rooms');
      if (r.status === 401) return say(e.roomMsg, 'Bedienschlüssel falsch.', 'bad');
      if (!r.ok) return say(e.roomMsg, 'Fehler ' + r.status, 'bad');
      room = await r.json();
    } catch (_) { return say(e.roomMsg, 'Server nicht erreichbar.', 'bad'); }
    e.key.value = '';
    e.create.disabled = true; e.end.disabled = false;
    say(e.roomMsg, 'Sitzung läuft (Raum ' + room.room_id + ').', 'ok');
    e.langs.replaceChildren();
    room.langs.forEach((l) => {
      const lab = document.createElement('label');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = l; cb.checked = true;
      lab.append(cb, ' ' + (NAMES[l] || l)); e.langs.appendChild(lab);
    });
    e.ttl.value = Math.round(room.listener_ttl_s / 60);
    e.ttl.min = Math.ceil(room.min_listener_ttl_s / 60); e.ttl.max = Math.floor(room.max_listener_ttl_s / 60);
    [e.secLinks, e.secMic, e.secOut].forEach((s) => { s.hidden = false; });
    await listDevices();
    statTimer = setInterval(pollStats, 3000);
  });

  e.end.addEventListener('click', endSession);
  async function endSession() {
    stopSending();
    clearInterval(statTimer);
    if (room) { try { await api('DELETE', '/api/rooms/' + room.room_id); } catch (_) {} }
    room = null; key = '';
    e.links.replaceChildren(); e.log.replaceChildren();
    e.create.disabled = false; e.end.disabled = true;
    [e.secLinks, e.secMic, e.secOut].forEach((s) => { s.hidden = true; });
    say(e.roomMsg, 'Sitzung beendet. Alle Puffer und Links sind gelöscht.', 'ok');
  }

  /* ---------- Links ---------- */
  e.btnLinks.addEventListener('click', async () => {
    e.links.replaceChildren();
    const chosen = [...e.langs.querySelectorAll('input:checked')].map((c) => c.value);
    for (const lang of chosen) {
      const r = await api('POST', '/api/rooms/' + room.room_id + '/listener-links',
        { lang, ttl_s: Math.round(Number(e.ttl.value) * 60) });
      if (!r.ok) { say(e.roomMsg, 'Link-Fehler (' + lang + '): ' + r.status, 'bad'); continue; }
      const d = await r.json();
      const url = location.origin + d.path;
      const row = document.createElement('div'); row.className = 'link';
      const name = document.createElement('strong'); name.textContent = NAMES[lang] || lang;
      const code = document.createElement('code'); code.textContent = url;
      const copy = document.createElement('button'); copy.textContent = 'Kopieren';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(url); copy.textContent = 'Kopiert ✓'; }
        catch (_) { copy.textContent = 'Bitte von Hand markieren'; }
      });
      row.append(name, code, copy); e.links.appendChild(row);
    }
  });

  /* ---------- Mikrofon ---------- */
  async function listDevices() {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });   // fuer Geraetenamen
      tmp.getTracks().forEach((t) => t.stop());
    } catch (err) { return say(e.micMsg, 'Mikrofonzugriff verweigert oder unmöglich: ' + err.name, 'bad'); }
    const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    e.dev.replaceChildren();
    all.forEach((d, i) => { const o = document.createElement('option'); o.value = d.deviceId;
      o.textContent = d.label || 'Eingang ' + (i + 1); e.dev.appendChild(o); });
  }

  e.start.addEventListener('click', async () => {
    if (ws) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws/operator');
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', room_id: room.room_id, operator_key: key }));
    ws.onclose = () => { if (ws) { ws = null; stopSending(); say(e.micMsg, 'Verbindung beendet.', 'warn'); } };
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
      say(e.micMsg, 'Sendet (' + ctx.sampleRate + ' Hz, Mono).', 'ok');
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
  e.stop.addEventListener('click', () => { stopSending(); say(e.micMsg, 'Gestoppt.', ''); });

  /* ---------- Anzeige ---------- */
  function showMessage(d) {
    const t = d.t, n = (a, b) => (a == null || b == null ? '–' : (b - a));
    const tts = t.t_tts == null ? t.t_mt : t.t_tts;
    e.lat.textContent = (t.t_out - t.t_audio_in) + ' ms (serverseitig, ohne Netz/Mikrofon)';
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
      const parts = Object.entries(s.listeners).map(([l, c]) => l + ': ' + c);
      e.statL.textContent = parts.length ? parts.join(', ') : 'keine';
    } catch (_) {}
  }

  window.addEventListener('pagehide', () => { stopSending(); });
})();

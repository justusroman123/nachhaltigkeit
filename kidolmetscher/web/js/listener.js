// Zuhoererseite: Sprache waehlen, Untertitel + Ton. Speichert nichts (kein Storage, keine Cookies).
(() => {
  'use strict';
  const NAMES = { uk: 'Українська', ar: 'العربية', en: 'English', tr: 'Türkçe', fa: 'فارسی' };
  const RTL = ['ar', 'fa'];
  const MAX_LINES = 4;
  const $ = (id) => document.getElementById(id);
  const subs = $('subs'), statusEl = $('status'), langEl = $('lang'), btnSound = $('btnSound'), picker = $('picker');

  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = /^[A-Za-z0-9_-]+$/.test(hash.get('t') || '') ? hash.get('t') : null;
  let lang = NAMES[hash.get('l')] ? hash.get('l') : null;      // gewaehlte Sprache (nur im Arbeitsspeicher/URL)
  let ws = null, retry = 0, ended = false, fontRem = 2, offered = [];
  let audioCtx = null, soundOn = false, nextStart = 0;

  function status(text, cls) { statusEl.textContent = text; statusEl.className = cls || 'muted'; }
  function notice(text) {
    subs.replaceChildren();
    const d = document.createElement('div'); d.id = 'msg'; d.textContent = text; subs.appendChild(d);
  }

  /* ---------- Sprachauswahl ---------- */
  function showPicker(langs) {
    picker.querySelectorAll('button').forEach((b) => b.remove());
    langs.forEach((l) => {
      const b = document.createElement('button');
      b.textContent = NAMES[l] || l; b.lang = l; b.dir = RTL.includes(l) ? 'rtl' : 'ltr';
      b.addEventListener('click', () => choose(l));
      picker.appendChild(b);
    });
    picker.hidden = false;
  }
  function choose(l) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'select', lang: l }));
  }
  $('btnLang').addEventListener('click', () => showPicker(offered));

  /* ---------- Untertitel ---------- */
  function addLine(text, rtl) {
    const first = subs.firstElementChild;
    if (first && first.id === 'msg') subs.replaceChildren();
    const p = document.createElement('p');
    p.className = 'sub'; p.textContent = text; p.dir = rtl ? 'rtl' : 'ltr';
    subs.appendChild(p);
    while (subs.children.length > MAX_LINES) subs.removeChild(subs.firstElementChild);
  }
  function setFont(delta) {
    fontRem = Math.max(1, Math.min(5, fontRem + delta));
    document.documentElement.style.setProperty('--fs', fontRem + 'rem');
  }
  $('btnBigger').addEventListener('click', () => setFont(0.25));
  $('btnSmaller').addEventListener('click', () => setFont(-0.25));

  /* ---------- Ton ---------- */
  function b64ToBuf(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  async function play(audio) {
    if (!soundOn || !audioCtx || !audio) return;
    try {
      const buf = await audioCtx.decodeAudioData(b64ToBuf(audio.data_b64));
      const src = audioCtx.createBufferSource();
      src.buffer = buf; src.connect(audioCtx.destination);
      const at = Math.max(audioCtx.currentTime + 0.05, nextStart);
      src.start(at); nextStart = at + buf.duration;
    } catch (_) { /* defektes Audio ueberspringen */ }
  }
  btnSound.addEventListener('click', async () => {
    if (!soundOn) {
      audioCtx = audioCtx || new AudioContext();    // erst nach Tipp erlaubt (Autoplay-Regeln)
      await audioCtx.resume();
      soundOn = true; btnSound.textContent = '🔊';
    } else {
      soundOn = false; btnSound.textContent = '🔇'; nextStart = 0;
    }
  });

  async function keepAwake() {
    try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch (_) {}
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !ended) keepAwake(); });

  /* ---------- Verbindung ---------- */
  function end(text, cls, symbol) { ended = true; status(text, cls); picker.hidden = true; notice(symbol); }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws/listener');
    status('Verbinde …');
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', token, lang }));
    ws.onmessage = (ev) => {
      let d; try { d = JSON.parse(ev.data); } catch (_) { return; }
      if (d.type === 'ready') {
        retry = 0; offered = d.langs || [];
        status('● live', 'ok');
        keepAwake();
        if (!d.lang) { langEl.textContent = '🌐'; notice('…'); showPicker(offered); return; }
        const changed = d.lang !== lang;
        lang = d.lang;
        picker.hidden = true;
        langEl.textContent = NAMES[lang] || lang;
        document.documentElement.lang = lang;
        history.replaceState(null, '', '#t=' + token + '&l=' + lang);
        if (changed || !subs.children.length) notice('🎧  🔇 → 🔊');
      } else if (d.type === 'translation') {
        addLine(d.text, RTL.includes(d.lang));
        play(d.audio);
      } else if (d.type === 'session_end') {
        end('Ende', 'muted', '✔');
      } else if (d.type === 'token_expired') {
        end('Link abgelaufen', 'bad', '⏱');
      } else if (d.type === 'error') {
        if (d.code === 'lang_invalid') status('Sprache nicht verfügbar', 'warn');
        else end('Link ungültig', 'bad', '⚠');
      }
    };
    ws.onclose = () => {
      if (ended) return;
      status('Verbindung weg, neuer Versuch …', 'warn');
      setTimeout(connect, Math.min(10000, 1000 * 2 ** retry++));
    };
  }

  if (!token) end('Link ungültig', 'bad', '⚠');
  else connect();
})();

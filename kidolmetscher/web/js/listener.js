// Zuhoererseite: Untertitel + Ton. Speichert nichts (kein Storage, keine Cookies).
(() => {
  'use strict';
  const NAMES = { uk: 'Українська', ar: 'العربية', en: 'English', tr: 'Türkçe', fa: 'فارسی' };
  const MAX_LINES = 4;
  const $ = (id) => document.getElementById(id);
  const subs = $('subs'), statusEl = $('status'), langEl = $('lang'), btnSound = $('btnSound');

  const m = /(?:^|[#&])t=([A-Za-z0-9_-]+)/.exec(location.hash);
  const token = m ? m[1] : null;
  let ws = null, retry = 0, ended = false, fontRem = 2;
  let audioCtx = null, soundOn = false, nextStart = 0, wake = null;

  function status(text, cls) { statusEl.textContent = text; statusEl.className = cls || 'muted'; }
  function notice(text) {
    subs.replaceChildren();
    const d = document.createElement('div'); d.id = 'msg'; d.textContent = text; subs.appendChild(d);
  }

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
    try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (_) {}
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !ended) keepAwake(); });

  /* ---------- Verbindung ---------- */
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws/listener');
    status('Verbinde …');
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', token }));
    ws.onmessage = (ev) => {
      let d; try { d = JSON.parse(ev.data); } catch (_) { return; }
      if (d.type === 'ready') {
        retry = 0;
        langEl.textContent = NAMES[d.lang] || d.lang;
        document.documentElement.lang = d.lang;
        status('● live', 'ok');
        if (!subs.children.length) notice('…');
        keepAwake();
      } else if (d.type === 'translation') {
        addLine(d.text, d.lang === 'ar' || d.lang === 'fa');
        play(d.audio);
      } else if (d.type === 'session_end') {
        ended = true; status('Ende', 'muted'); notice('✔'); 
      } else if (d.type === 'token_expired') {
        ended = true; status('Link abgelaufen', 'bad'); notice('⏱');
      } else if (d.type === 'error') {
        ended = true; status('Link ungültig', 'bad'); notice('⚠');
      }
    };
    ws.onclose = () => {
      if (ended) return;
      status('Verbindung weg, neuer Versuch …', 'warn');
      const wait = Math.min(10000, 1000 * 2 ** retry++);
      setTimeout(connect, wait);
    };
  }

  if (!token) { ended = true; status('Link ungültig', 'bad'); notice('⚠'); }
  else connect();
})();

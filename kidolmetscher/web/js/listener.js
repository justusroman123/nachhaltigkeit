// Zuhoererseite: Sprache waehlen, "Tippen zum Starten", Untertitel + Ton. Speichert nichts (kein Storage, keine Cookies).
(() => {
  'use strict';
  const NAMES = { uk: 'Українська', ar: 'العربية', en: 'English', tr: 'Türkçe', fa: 'فارسی' };
  const RTL = ['ar', 'fa'];
  const HISTORY_S = 0;                 // 0 = keine Zeitgrenze: Untertitel bleiben stehen, solange die Seite offen ist (Nutzerwunsch: alles anzeigen)
  const MAX_LINES = 60;                // es bleiben hoechstens die letzten 60 Nachrichten (nur im Browser, die neueste ist immer sichtbar)
  const MAX_AUDIO_BACKLOG_S = 3600;   // Ton wird nie ausgelassen (Vollstaendigkeit geht vor); frueher 6 s: dann fehlte der Ton bei vorhandenen Untertiteln
  const $ = (id) => document.getElementById(id);
  const subs = $('subs'), statusEl = $('status'), langEl = $('lang'), btnSound = $('btnSound'), picker = $('picker'),
        startScreen = $('startScreen'), vol = $('vol');

  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = /^[A-Za-z0-9_-]+$/.test(hash.get('t') || '') ? hash.get('t') : null;
  let lang = NAMES[hash.get('l')] ? hash.get('l') : null;      // gewaehlte Sprache (nur im Arbeitsspeicher/URL)
  let ws = null, retry = 0, ended = false, fontRem = 2, offered = [], startShown = false;
  let audioCtx = null, gain = null, soundOn = false, nextStart = 0;

  const t = () => STRINGS[lang] || STRINGS.de;
  const tt = (k) => ((STRINGS[lang] || {}).talk || {})[k] || (STRINGS.en.talk || {})[k] || STRINGS.de.talk[k];   // Fallback: Englisch
  function status(text, cls) { statusEl.textContent = text; statusEl.className = cls || 'muted'; }
  function notice(text) {
    subs.replaceChildren();
    const d = document.createElement('div'); d.id = 'msg'; d.textContent = text; subs.appendChild(d);
  }

  /* ---------- Hinweis (KI) und Texte in der gewaehlten Sprache ---------- */
  function applyStrings() {
    const s = t(), dir = RTL.includes(lang) ? 'rtl' : 'ltr';
    $('aiText').textContent = s.ai; $('privacyLink').textContent = s.privacy; $('histNote').textContent = '';   // Hinweis "letzte 2 Minuten" entfaellt (Verlauf ohne Zeitgrenze)
    $('notice').dir = dir;
    $('btnStartSound').textContent = '🔊  ' + s.start; $('btnSubsOnly').textContent = s.subsOnly;
    $('startAi').textContent = s.ai; startScreen.dir = dir;
    vol.setAttribute('aria-label', s.volume); vol.title = s.volume;
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
  const lines = [];                      // {el, at, seq}: nur im Arbeitsspeicher
  const seen = new Set();                // schon angezeigte Nachrichten (seq): verhindert Wiederholungen, wenn der Server beim Neuverbinden den Verlauf noch einmal schickt
  let lastUserScroll = 0;
  subs.addEventListener('scroll', () => { if (!nearBottom()) lastUserScroll = Date.now(); }, { passive: true });
  function nearBottom() { return subs.scrollHeight - subs.scrollTop - subs.clientHeight < 80; }
  function addLine(text, rtl, ageS, seq) {
    if (Number.isInteger(seq)) {
      if (seen.has(seq)) return false;                            // Wiederholung (Neuverbinden): nicht noch einmal anzeigen
      seen.add(seq);
    }
    const first = subs.firstElementChild;
    if (first && first.id === 'msg') subs.replaceChildren();
    // Neueste Zeile immer sichtbar: mitscrollen, ausser jemand liest gerade bewusst weiter oben (dann nach 4 s wieder unten)
    const stick = nearBottom() || Date.now() - lastUserScroll > 4000;
    const p = document.createElement('p');
    p.className = 'sub'; p.textContent = text; p.dir = rtl ? 'rtl' : 'ltr';
    subs.appendChild(p);
    lines.push({ el: p, at: Date.now() - (ageS || 0) * 1000, seq });
    while (lines.length > MAX_LINES) { const l = lines.shift(); if (l.el.parentNode) l.el.remove(); }
    if (stick) subs.scrollTop = subs.scrollHeight;
    return true;
  }
  function purgeHistory() {
    if (!HISTORY_S) return;
    const limit = Date.now() - HISTORY_S * 1000;
    while (lines.length && lines[0].at < limit) { const l = lines.shift(); if (l.el.parentNode) l.el.remove(); }
  }
  setInterval(purgeHistory, 1000);
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
  // Ton strikt in Eingangsreihenfolge einplanen: Laden/Dekodieren darf sich nicht ueberholen (langer Satz vor kurzem Satz)
  let playChain = Promise.resolve();
  function play(audio) {                             // aufgeloest, wenn der Ton zu Ende ist (oder ausgelassen wurde)
    if (!soundOn || !audioCtx || !audio) return Promise.resolve();
    const job = playChain.then(() => schedule(audio));
    playChain = job.catch(() => {});
    return job.then((h) => (h ? h.done : undefined)).catch(() => {});
  }
  async function schedule(audio) {                   // liefert {done}, sobald der Ton eingeplant ist (nicht erst nach dem Abspielen)
    if (nextStart - audioCtx.currentTime > MAX_AUDIO_BACKLOG_S) return null;     // zu viel Rueckstau: Ton auslassen
    try {
      const buf = await audioCtx.decodeAudioData(b64ToBuf(audio.data_b64));
      const src = audioCtx.createBufferSource();
      src.buffer = buf; src.connect(gain);
      const at = Math.max(audioCtx.currentTime + 0.05, nextStart);            // Warteschlange: nie ueberlappen
      const ended = new Promise((resolve) => { src.onended = resolve; });
      src.start(at); nextStart = at + buf.duration;
      const wait = (buf.duration + 2) * 1000 + Math.max(0, (at - audioCtx.currentTime) * 1000);
      return { done: Promise.race([ended, new Promise((r) => setTimeout(r, wait))]) };
    } catch (_) { return null; }                     // defektes Audio ueberspringen
  }
  async function enableSound() {
    audioCtx = audioCtx || new AudioContext();    // erst nach Tipp erlaubt (Autoplay-Regeln der Tablets)
    if (!gain) { gain = audioCtx.createGain(); gain.connect(audioCtx.destination); gain.gain.value = Number(vol.value); }
    await audioCtx.resume();
    soundOn = true; btnSound.textContent = '🔊';
  }
  function disableSound() { soundOn = false; btnSound.textContent = '🔇'; nextStart = 0; }
  btnSound.addEventListener('click', () => (soundOn ? disableSound() : enableSound()));
  vol.addEventListener('input', () => { if (gain) gain.gain.value = Number(vol.value); });
  $('btnStartSound').addEventListener('click', async () => { await enableSound(); startScreen.hidden = true; });
  $('btnSubsOnly').addEventListener('click', () => { startScreen.hidden = true; });

  async function keepAwake() {
    try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch (_) {}
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !ended) keepAwake(); });

  /* ---------- Verbindung ---------- */
  function end(text, cls, symbol) { ended = true; status(text, cls); picker.hidden = true; startScreen.hidden = true; notice(symbol); }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws/listener');
    status('Verbinde …');
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', token, lang }));
    ws.onmessage = (ev) => {
      let d; try { d = JSON.parse(ev.data); } catch (_) { return; }
      if (d.type === 'ready') {
        retry = 0; offered = d.langs || [];
        mode = d.mode || 'vortrag'; turn = d.turn || turn; myDevice = d.device || myDevice;
        status('● live', 'ok');
        keepAwake();
        if (!d.lang) { langEl.textContent = '🌐'; notice('…'); showPicker(offered); return; }
        const changed = d.lang !== lang;
        lang = d.lang;
        picker.hidden = true;
        langEl.textContent = NAMES[lang] || lang;
        document.documentElement.lang = lang;
        applyStrings();
        setupTalk();
        history.replaceState(null, '', '#t=' + token + '&l=' + lang);
        if (changed) { lines.length = 0; seen.clear(); }
        if (changed || !subs.children.length) notice('🎧  🔇 → 🔊');
        if (!startShown) { startShown = true; startScreen.hidden = false; }   // einmal: "Tippen zum Starten"
      } else if (d.type === 'translation') {
        const added = addLine(d.text, RTL.includes(d.lang), d.age_s, d.seq);
        if (added && !d.replay && Number.isInteger(d.seq)) {
          sendJson({ type: 'shown', seq: d.seq });                    // Rueckmeldung: Text steht auf dem Bildschirm
          // Rueckmeldung "fertig": Ton zu Ende gespielt. Ohne Ton (stumm oder keine Stimme) gilt eine Lesezeit nach der Wortzahl (Annahme: 200 Woerter/Minute)
          const hadSound = soundOn && !!d.audio;
          const readMs = hadSound ? 0 : Math.min(15000, 800 + d.text.split(/\s+/).length * 300);
          play(d.audio).then(() => setTimeout(() => sendJson({ type: 'played', seq: d.seq }), readMs));
        } else play(d.audio);
      } else if (d.type === 'turn') {
        turn = d; talkRender();
      } else if (d.type === 'busy') {
        talking = false; talkRender(tt('busy'));
      } else if (d.type === 'problem') {
        talking = false; micOff(); talkRender(tt('repeat'));
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


  /* ---------- Gespraechsmodus (Gast): Sprechen-Knopf, Zustand vom Server, Mikrofon nur nach Tippen offen ---------- */
  let mode = 'vortrag', turn = { state: 'frei', who: null }, talking = false, cfg = null;
  let micStream = null, micCtx = null, micNode = null, talkMs = 0, quietMs = 0, spoke = false, sentMs = 0, sentQuiet = 0;
  const NO_SPEECH_MS = 5000;                                 // Annahme: ohne Sprache endet der Versuch nach 5 s
  const turnEndMs = () => Math.max(2000, ((cfg && cfg.silence_ms) || 700) + 800);   // Aussage endet etwas nach der Abschnitts-Pause (Annahme)
  const dock = $('talkDock'), band = $('turnBand'), sentBar = $('sentBar'), btnTalk = $('btnTalk'), talkNote = $('talkNote');
  const sendJson = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  let myDevice = null;                                      // Kennung dieses Geraets (vom Server in "ready")
  const mine = () => turn.state === 'spricht' && turn.who === myDevice;
  function setupTalk() {
    dock.hidden = mode !== 'gespraech';
    if (mode !== 'gespraech') return;
    talkNote.textContent = tt('consent'); dock.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
    if (!cfg) fetch('/api/config', { cache: 'no-store' }).then((r) => r.json()).then((c) => { cfg = c; }).catch(() => {});
    talkRender();
  }
  function bandSet(kind, text) { band.className = kind; band.textContent = text; }
  function talkRender(hint) {
    if (mode !== 'gespraech') return;
    const s = turn.state, me = mine();
    btnTalk.textContent = me ? '✔ ' + tt('done') : '🎙 ' + tt('speak');
    btnTalk.disabled = !(s === 'frei' || me);
    sentBar.hidden = !me;
    if (hint) return bandSet('stop', hint);
    if (s === 'frei') bandSet('', '● ' + tt('canSpeak'));
    else if (me) bandSet('', '🎙 ' + tt('youSpeak'));
    else if (s === 'spricht') bandSet('stop', '■ ' + (turn.who === 'staff' ? tt('waitStaff') : tt('waitGuest')));
    else if (s === 'uebersetzt') bandSet('stop', '■ ' + tt('waitTrans'));
    else bandSet('stop', '■ ' + tt('waitPlay'));
  }
  async function startMic(rate) {
    if (micNode) { micStream.getAudioTracks().forEach((tr) => { tr.enabled = true; }); return true; }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      micCtx = new AudioContext({ sampleRate: rate || 16000 });
      await micCtx.audioWorklet.addModule('js/pcm-worklet.js');
      micNode = new AudioWorkletNode(micCtx, 'pcm-capture');
      micNode.port.onmessage = (ev) => onMicBlock(ev.data);
      micCtx.createMediaStreamSource(micStream).connect(micNode);
      return true;
    } catch (_) { bandSet('stop', tt('micDenied')); return false; }
  }
  function micOff() { if (micStream) micStream.getAudioTracks().forEach((tr) => { tr.enabled = false; }); }   // zwischen den Aussagen stumm
  function onMicBlock(buf) {
    if (!talking) return;
    if (ws && ws.readyState === 1) ws.send(buf);
    const a = new Int16Array(buf); let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
    const rms = Math.sqrt(sum / a.length), blockMs = a.length / (micCtx ? micCtx.sampleRate : 16000) * 1000;
    const loud = rms >= ((cfg && cfg.vad_rms) || 400), quietLimit = (cfg && cfg.silence_ms) || 700;
    const maxMs = ((cfg && cfg.utterance_max_s) || 12) * 1000;
    talkMs += blockMs;
    if (loud) { spoke = true; quietMs = 0; } else quietMs += blockMs;
    sentQuiet = loud ? 0 : sentQuiet + blockMs;
    if (sentQuiet >= quietLimit) sentMs = 0; else if (spoke) sentMs += blockMs;
    const f = Math.min(1, sentMs / maxMs);
    sentBar.firstElementChild.style.width = Math.round(f * 100) + '%';
    sentBar.className = 'sentbar' + (f >= 0.65 ? ' warn' : '');
    if (mine()) bandSet(f >= 0.85 ? 'warn' : '', f >= 0.85 ? '⚠ ' + tt('done') + ' …' : '🎙 ' + tt('youSpeak'));
    if ((spoke && quietMs >= turnEndMs()) || (!spoke && talkMs >= NO_SPEECH_MS)) endTalk();
  }
  function endTalk() { if (!talking) return; talking = false; micOff(); sendJson({ type: 'talk', on: false }); }
  btnTalk.addEventListener('click', async () => {
    if (mine()) return endTalk();
    if (turn.state !== 'frei' || talking) return;
    if (!(await startMic(16000))) return;
    talking = true; talkMs = quietMs = sentMs = sentQuiet = 0; spoke = false;
    sendJson({ type: 'talk', on: true });
  });
  window.addEventListener('pagehide', () => { talking = false; if (micStream) micStream.getTracks().forEach((tr) => tr.stop()); });

  applyStrings();
  if (location.protocol === 'file:') end('Bitte über den Server öffnen (nicht als Datei)', 'bad', '⚠');
  else if (!token) end('Link ungültig', 'bad', '⚠');
  else connect();
})();

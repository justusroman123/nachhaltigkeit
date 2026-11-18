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
  let ws = null, retry = 0, lastError = '', ended = false, fontRem = 2, offered = [], startShown = false;
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
    $('startPrivacy').textContent = s.privacyShort || STRINGS.en.privacyShort;                 // Information VOR der ersten Aufnahme (Art. 13 DSGVO), ohne Extra-Klick
    $('startPrivacyLink').textContent = s.privacy;
    vol.setAttribute('aria-label', s.volume); vol.title = s.volume;
  }

  /* ---------- Sprachauswahl ---------- */
  function showPicker(langs) {
    picker.querySelectorAll('button').forEach((b) => b.remove());
    const info = $('pickerInfo');
    langs.forEach((l) => {
      const b = document.createElement('button');
      b.textContent = NAMES[l] || l; b.lang = l; b.dir = RTL.includes(l) ? 'rtl' : 'ltr';
      b.addEventListener('click', () => choose(l));
      picker.insertBefore(b, info);
    });
    // Noch keine Sprache gewaehlt: Hinweis zweisprachig und mit Link zum Datenschutzhinweis
    info.replaceChildren(document.createTextNode(STRINGS.de.ai + ' ' + STRINGS.de.privacyShort + ' / ' + STRINGS.en.ai + ' ' + STRINGS.en.privacyShort + ' '));
    const a = document.createElement('a'); a.href = 'datenschutz.html'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Datenschutz / Privacy';
    info.appendChild(a);
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
  // Drehen, Sprechleiste erscheint, Browserleisten wechseln: die neueste Zeile bleibt sichtbar, ausser jemand liest gerade bewusst weiter oben
  const stickBottom = () => { if (Date.now() - lastUserScroll > 4000) subs.scrollTop = subs.scrollHeight; };
  if (window.ResizeObserver) new ResizeObserver(stickBottom).observe(subs); else window.addEventListener('resize', stickBottom);
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
  const sources = new Set();                         // eingeplante/laufende Toene: Stummschalten muss sie stoppen
  async function schedule(audio) {                   // liefert {done}, sobald der Ton eingeplant ist (nicht erst nach dem Abspielen)
    if (!soundOn) return null;
    if (nextStart - audioCtx.currentTime > MAX_AUDIO_BACKLOG_S) return null;     // zu viel Rueckstau: Ton auslassen
    try {
      const buf = await audioCtx.decodeAudioData(b64ToBuf(audio.data_b64));
      if (!soundOn) return null;                     // waehrend des Dekodierens stummgeschaltet
      const src = audioCtx.createBufferSource();
      src.buffer = buf; src.connect(gain);
      const at = Math.max(audioCtx.currentTime + 0.05, nextStart);            // Warteschlange: nie ueberlappen
      const ended = new Promise((resolve) => { src.onended = () => { sources.delete(src); resolve(); }; });
      sources.add(src);
      src.start(at); nextStart = at + buf.duration;
      const wait = (buf.duration + 2) * 1000 + Math.max(0, (at - audioCtx.currentTime) * 1000);
      return { done: Promise.race([ended, new Promise((r) => setTimeout(r, wait))]) };
    } catch (_) { return null; }                     // defektes Audio ueberspringen
  }
  async function enableSound() {
    audioCtx = audioCtx || new AudioContext();    // erst nach Tipp erlaubt (Autoplay-Regeln der Tablets)
    if (!gain) { gain = audioCtx.createGain(); gain.connect(audioCtx.destination); gain.gain.value = Number(vol.value); }
    await audioCtx.resume();
    soundOn = true; btnSound.textContent = '🔊'; btnSound.setAttribute('aria-pressed', 'true');
  }
  function disableSound() {
    soundOn = false; btnSound.textContent = '🔇'; btnSound.setAttribute('aria-pressed', 'false');
    sources.forEach((src) => { try { src.stop(); } catch (_) {} });         // schon eingeplanter Ton wird abgebrochen (die Rueckmeldung "fertig" folgt trotzdem)
    sources.clear(); nextStart = 0;
  }
  btnSound.addEventListener('click', () => (soundOn ? disableSound() : enableSound()));
  vol.addEventListener('input', () => { if (gain) gain.gain.value = Number(vol.value); });
  $('btnStartSound').addEventListener('click', async () => { await enableSound(); startScreen.hidden = true; });
  $('btnSubsOnly').addEventListener('click', () => { startScreen.hidden = true; });

  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (_) {}
  }
  function releaseAwake() { try { if (wakeLock) wakeLock.release(); } catch (_) {} wakeLock = null; }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !ended) keepAwake();
    if (document.hidden && !talking && !wanting && !pendingOn) micClose();       // im Hintergrund kein offenes Mikrofon (Aufnahme-Anzeige des Geraets)
  });

  /* ---------- Verbindung ---------- */
  function end(text, cls, symbol) {
    ended = true; status(text, cls); picker.hidden = true; startScreen.hidden = true; notice(symbol);
    resetTalk(); micClose(); dock.hidden = true;     // Mikrofon freigeben (Anzeige am Tablet geht aus), keine Sprechleiste mehr
    releaseAwake();
    try { history.replaceState(null, '', location.pathname); } catch (_) {}      // Zugangscode und Sprache nicht im Browserverlauf stehen lassen
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws/listener');
    status('Verbinde …');
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', token, lang }));
    ws.onmessage = (ev) => {
      let d; try { d = JSON.parse(ev.data); } catch (_) { return; }
      if (d.type === 'ready') {
        retry = 0; lastError = ''; offered = d.langs || [];
        if (d.device && d.device !== myDevice) resetTalk();          // neue Verbindung = neues Geraet beim Server: alter Sprechzustand gilt nicht mehr
        mode = d.mode || 'vortrag'; turn = d.turn || turn; myDevice = d.device || myDevice;
        opOnline = d.operator_online !== false;
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
        turn = d;
        reconcile(d);
        talkRender();
      } else if (d.type === 'operator') {
        opOnline = d.online !== false;                                // Mitarbeiter (Bedienplatz) verbunden oder nicht
        talkRender();
      } else if (d.type === 'busy') {
        talking = false; pendingOn = false; clearTimeout(pendingTimer); micOff(); talkRender(tt('busy'));
      } else if (d.type === 'problem') {
        showProblem(d.what);                                          // nur ein Hinweis: das Mikrofon bleibt, die Aussage laeuft weiter
      } else if (d.type === 'session_end') {
        end('Ende', 'muted', '✔');
      } else if (d.type === 'token_expired') {
        end('Link abgelaufen', 'bad', '⏱');
      } else if (d.type === 'removed') {
        end('Vom Mitarbeiter getrennt', 'bad', '⛔');                 // Tuer zu: der Link ist ungueltig, nicht neu verbinden
      } else if (d.type === 'error') {
        if (d.code === 'lang_invalid') status('Sprache nicht verfügbar', 'warn');
        else if (d.code === 'room_full') { lastError = 'room_full'; status('Alle Plätze belegt, neuer Versuch …', 'warn'); }   // vorübergehend (z. B. alte Verbindung noch nicht abgelaufen): onclose versucht es erneut
        else end('Link ungültig', 'bad', '⚠');
      }
    };
    ws.onclose = () => {
      resetTalk();                                          // nichts darf haengen bleiben: Sprechzustand, Mikrofon, Hinweise
      if (ended) return;
      status(lastError === 'room_full' ? 'Alle Plätze belegt, neuer Versuch …' : 'Verbindung weg, neuer Versuch …', 'warn');
      if (mode === 'gespraech' && lastError !== 'room_full') { sentBar.hidden = true; bandSet('stop', '⚠ ' + tt('offline')); }
      setTimeout(connect, Math.min(10000, 1000 * 2 ** retry++));
    };
  }


  /* ---------- Gespraechsmodus (Gast): Sprechen-Knopf, Zustand vom Server, Mikrofon nur nach Tippen offen ----------
     Der Server entscheidet, wer das Wort hat; dieser Teil richtet sich nach seinen "turn"-Meldungen (reconcile) und bleibt nie
     in einem alten Zustand stehen: bei neuer Verbindung, Ende oder Abbruch wird alles zurueckgesetzt (resetTalk). */
  let mode = 'vortrag', turn = { state: 'frei', who: null, waiting: [] }, talking = false, cfg = null, wanting = false, gotTurn = false;
  let pendingOn = false, pendingTimer = 0;                  // "Sprechen" gesendet, die Antwort des Servers (turn oder busy) steht noch aus
  let micStream = null, micCtx = null, micNode = null, micStarting = null, opOnline = true, tapBusy = false;
  // Redezeit ist NICHT begrenzt: Die Aussage endet nur mit "Fertig", wenn der Mitarbeiter das Wort uebernimmt (Stopp) oder
  // nach langer Stille (Server). Gaeste koennen niemanden stoppen, nur sich melden.
  let cutHint = '', cutTimer = 0, problemHint = '', problemTimer = 0;
  const dock = $('talkDock'), band = $('turnBand'), sentBar = $('sentBar'), btnTalk = $('btnTalk'), talkNote = $('talkNote');
  const sendJson = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  let myDevice = null;                                      // Kennung dieses Geraets (vom Server in "ready")
  const mine = () => turn.state === 'spricht' && turn.who === myDevice;
  function resetTalk() {                                    // alter Sprechzustand gilt nicht mehr (neue Verbindung, Ende, Abbruch)
    talking = false; wanting = false; gotTurn = false; pendingOn = false;
    clearTimeout(pendingTimer); clearTimeout(cutTimer); clearTimeout(problemTimer);
    cutHint = ''; problemHint = '';
    micOff();
    if (sentBar) sentBar.hidden = true;
  }
  function setupTalk() {
    dock.hidden = mode !== 'gespraech';
    if (mode !== 'gespraech') return;
    talkNote.textContent = tt('consent'); dock.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
    if (!cfg) fetch('/api/config', { cache: 'no-store' }).then((r) => r.json()).then((c) => { cfg = c; }).catch(() => {});
    talkRender();
  }
  function bandSet(kind, text) { band.className = kind; band.textContent = text; }
  const waitsForMe = () => (turn.waiting || []).includes(myDevice);
  const othersWait = () => (turn.waiting || []).some((d) => d !== myDevice);
  function showCut(text) {                                  // Aussage wurde beendet: Hinweis mindestens 6 s stehen lassen
    cutHint = text; clearTimeout(cutTimer);
    cutTimer = setTimeout(() => { cutHint = ''; talkRender(); }, 6000);
  }
  const PROBLEM_KEYS = { nicht_erkannt: 'repeat', uebersetzung: 'transFailed', spracherkennung: 'asrFailed', audio_verworfen: 'audioLost' };
  function showProblem(what) {                              // sichtbar bleiben (8 s), auch wenn gleich danach der Zustand wechselt
    problemHint = tt(PROBLEM_KEYS[what] || 'repeat');
    clearTimeout(problemTimer); problemTimer = setTimeout(() => { problemHint = ''; talkRender(); }, 8000);
    try { if (navigator.vibrate) navigator.vibrate(150); } catch (_) {}
    talkRender();
  }
  // Abgleich mit der Meldung des Servers: Zustand des Geraets und des Servers duerfen nie auseinanderlaufen
  function reconcile(d) {
    const me = mine();
    if (me) { pendingOn = false; clearTimeout(pendingTimer); }
    if (talking && !me && !pendingOn) {                     // Wort genommen (Stopp des Mitarbeiters), lange Stille oder Freigabe
      talking = false; micOff(); wanting = false;
      showCut(tt(d.reason === 'unterbrochen' ? 'cutByStaff' : (d.reason === 'freigegeben' ? 'released' : 'ended')));
    } else if (me && !talking && !pendingOn && !wanting) {  // Wort uebergeben, aber hier will niemand sprechen (Wortmeldung gerade zurueckgenommen): sofort zurueckgeben
      sendJson({ type: 'talk', on: false });
    }
  }
  function talkRender(hint) {
    if (mode !== 'gespraech') return;
    const s = turn.state, me = mine();
    if (me) gotTurn = true; else if (gotTurn) { gotTurn = false; wanting = false; }   // Aussage vorbei: Wortmeldung erledigt
    btnTalk.textContent = me ? '✔ ' + tt('done') : (s === 'frei' ? '🎙 ' + tt('speak') : (waitsForMe() ? '✖ ' + tt('unwant') : '✋ ' + tt('want')));
    btnTalk.disabled = false;
    sentBar.hidden = !(me && talking);                        // Pegelbalken nur, solange das Mikrofon wirklich sendet
    if (me && !talking) autoStart();                          // Wortmeldung: Wort wurde uebergeben, Mikrofon geht automatisch an
    if (hint) return bandSet('stop', hint);
    if (problemHint) return bandSet('stop', '⚠ ' + problemHint);       // Fehlerhinweis hat Vorrang und bleibt sichtbar
    if (!opOnline) return bandSet('stop', '⚠ ' + tt('noStaff'));        // niemand am Bedienplatz: Aussagen wuerden nicht gehoert
    if (cutHint && !me) return bandSet('warn', '⚠ ' + cutHint);       // Aussage wurde beendet (Mitarbeiter hat das Wort / lange Stille)
    if (s === 'frei') bandSet('', '● ' + tt('canSpeak'));
    else if (me) bandSet(othersWait() ? 'warn' : '', othersWait() ? '⏳ ' + tt('someoneWaits') : '🎙 ' + tt('youSpeak'));
    else if (waitsForMe()) bandSet('stop', '⏳ ' + tt('queued'));
    else if (s === 'spricht') bandSet('stop', '■ ' + (turn.who === 'staff' ? tt('waitStaff') : tt('waitGuest')));
    else if (s === 'uebersetzt') bandSet('stop', '■ ' + tt('waitTrans'));
    else bandSet('stop', '■ ' + tt('waitPlay'));
  }
  async function autoStart() {                                // nur nach eigener Wortmeldung (Mikrofon-Freigabe wurde beim Antippen erteilt)
    if (!wanting || talking || !micNode) return;
    lastMicUse = Date.now();
    micStream.getAudioTracks().forEach((tr) => { tr.enabled = true; });
    talking = true;
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (_) {}       // Signal: Sie sind dran, das Mikrofon ist jetzt offen
    sendJson({ type: 'talk', on: true });
    talkRender();
  }
  function startMic(rate) {                                   // nie zweimal gleichzeitig (Doppeltipp, langsame Freigabe): gemeinsames Versprechen
    lastMicUse = Date.now();
    if (micNode) { micStream.getAudioTracks().forEach((tr) => { tr.enabled = true; }); return Promise.resolve(true); }
    if (micStarting) return micStarting;
    micStarting = (async () => {
      let stream = null, ctx = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        const cap = await openCapture(stream, rate || 16000, onMicBlock);     // js/capture.js: Kontext mit Zielrate, sonst Geraeterate mit Umrechnung im Worklet
        ctx = cap.ctx; const node = cap.node;
        if (ctx.state === 'suspended') await ctx.resume();    // Tablets (iOS): Kontext startet gesperrt
        micStream = stream; micCtx = ctx; micNode = node;
        return true;
      } catch (_) {
        try { if (stream) stream.getTracks().forEach((tr) => tr.stop()); if (ctx) ctx.close(); } catch (__) {}
        bandSet('stop', tt('micDenied'));
        return false;
      } finally { micStarting = null; }
    })();
    return micStarting;
  }
  let lastMicUse = 0;
  const MIC_IDLE_MS = 20000;                                  // Annahme: 20 s ohne Sprechen oder Wortmeldung, dann wird das Mikrofon wirklich freigegeben
  setInterval(() => {                                         // zwischen den Aussagen nur stumm, nach Leerlauf ganz zu (Aufnahme-Anzeige des Geraets geht aus)
    if (micNode && !talking && !wanting && !pendingOn && !mine() && Date.now() - lastMicUse > MIC_IDLE_MS) micClose();
  }, 3000);
  function micOff() { if (micStream) micStream.getAudioTracks().forEach((tr) => { tr.enabled = false; }); lastMicUse = Date.now(); }   // zwischen den Aussagen stumm
  function micClose() {                                       // Mikrofon wirklich freigeben (Ende, Seite verlassen): Aufnahme-Anzeige des Geraets geht aus
    try { if (micStream) micStream.getTracks().forEach((tr) => tr.stop()); } catch (_) {}
    try { if (micCtx) micCtx.close(); } catch (_) {}
    micStream = micCtx = micNode = null;
  }
  function onMicBlock(buf) {
    if (!talking) return;
    lastMicUse = Date.now();
    if (ws && ws.readyState === 1) ws.send(buf);
    const a = new Int16Array(buf); let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
    const rms = Math.sqrt(sum / a.length);
    const f = Math.min(1, rms / 3000);                         // Pegelanzeige: das Mikrofon hoert zu (keine Laengenbegrenzung)
    sentBar.firstElementChild.style.width = Math.round(f * 100) + '%';
  }
  function endTalk() {                                        // "Fertig": dem Server immer sagen, auch wenn lokal etwas nicht stimmt
    if (!talking && !mine()) return;
    talking = false; pendingOn = false; clearTimeout(pendingTimer); micOff();
    sendJson({ type: 'talk', on: false });
    talkRender(tt('ending'));
  }
  function armPending() {                                     // keine Antwort des Servers: nicht ewig "Sprechen" anzeigen
    pendingOn = true; clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pendingOn = false; if (!mine()) { talking = false; micOff(); } talkRender(); }, 5000);
  }
  btnTalk.addEventListener('click', async () => {
    if (tapBusy) return;                                      // Doppeltipp waehrend der Mikrofon-Freigabe: ignorieren
    tapBusy = true;
    try {
      if (mine() || talking) return endTalk();
      if (turn.state === 'frei') {
        if (!(await startMic(16000))) return;
        talking = true; armPending();
        sendJson({ type: 'talk', on: true }); talkRender();
        return;
      }
      if (waitsForMe()) { wanting = false; sendJson({ type: 'want', on: false }); return; }      // Wortmeldung zurueckziehen
      if (!(await startMic(16000))) return;                     // Mikrofon-Freigabe jetzt (Antippen), damit spaeter alles automatisch geht
      micOff();
      wanting = true; sendJson({ type: 'want', on: true }); talkRender();
    } finally { tapBusy = false; }
  });
  window.addEventListener('pagehide', () => { resetTalk(); micClose(); });

  applyStrings();
  if (location.protocol === 'file:') end('Bitte über den Server öffnen (nicht als Datei)', 'bad', '⚠');
  else if (!token) end('Link ungültig', 'bad', '⚠');
  else connect();
})();

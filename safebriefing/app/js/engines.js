/*
 * SafeBriefing – Übersetzungs-, Sprach- und Vorlese-Engines im Browser
 *
 * Reihenfolge bei "Automatisch":
 *   1. Geprüfter Kernsatz (exakter Treffer)       – keine Live-Übersetzung
 *   2. Prüf-Demo (simulierte Engine mit Fehlern)  – nur für Vorführungen
 *   3. Edge-Server im Werk (lokal, ohne Internet)
 *   4. Übersetzer im Browser (on-device, z. B. Chrome)
 *   5. Online-Demo-Engine (Claude, nur in der claude.ai-Vorschau)
 */
(function (root) {
  'use strict';

  var D = root.SB_DATA, G = root.SBGuardrail;
  var LANG = {};
  D.languages.forEach(function (l) { LANG[l.code] = l; });

  var state = {
    edge: { available: false, health: null },
    browser: { available: false, checked: false },
    claude: { sample: null, room: null, checked: false }
  };

  var ENGINE_LABEL = {
    kernsatz: 'Geprüfter Kernsatz',
    scenario: 'Prüf-Demo (simulierte Engine)',
    edge: 'Edge-Server im Werk',
    browser: 'Übersetzer im Browser (on-device)',
    claude: 'Online-Demo-Engine (Claude, Cloud)'
  };

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]);
  }

  async function detectEdge() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      var res = await withTimeout(fetch('api/health', { cache: 'no-store' }), 1500);
      if (!res.ok) return false;
      var h = await res.json();
      if (!h || h.mode !== 'edge') return false;
      state.edge.available = true;
      state.edge.health = h;
      return true;
    } catch (e) { return false; }
  }

  async function detectBrowser() {
    state.browser.checked = true;
    try {
      if (!('Translator' in root)) return false;
      var a = await root.Translator.availability({ sourceLanguage: 'de', targetLanguage: 'pl' });
      state.browser.available = a && a !== 'unavailable';
      return state.browser.available;
    } catch (e) { return false; }
  }

  async function detectClaude() {
    if (!root.claude || typeof root.claude.use !== 'function') { state.claude.checked = true; return null; }
    try {
      var sample = await root.claude.use('sample');
      state.claude.sample = sample || null;
    } catch (e) { state.claude.sample = null; }
    try {
      var room = await root.claude.use('room');
      state.claude.room = room || null;
    } catch (e) { state.claude.room = null; }
    state.claude.checked = true;
    return state.claude;
  }

  function available(id) {
    if (id === 'edge') return state.edge.available && state.edge.health && state.edge.health.engine && state.edge.health.engine.configured;
    if (id === 'browser') return state.browser.available;
    if (id === 'claude') return !!state.claude.sample;
    return id === 'kernsatz' || id === 'scenario';
  }

  function liveEngine(setting) {
    if (setting && setting !== 'auto') return available(setting) ? setting : null;
    var order = ['edge', 'browser', 'claude'];
    for (var i = 0; i < order.length; i++) if (available(order[i])) return order[i];
    return null;
  }

  // Glossarbegriffe, die im Satz vorkommen, je Zielsprache
  function glossaryPairs(text, glossary, langs) {
    var hits = G.glossaryHits(text, glossary);
    return hits.map(function (g) {
      var targets = {};
      langs.forEach(function (l) { if (g.t && g.t[l]) targets[l] = g.t[l].term; });
      return { de: g.de, targets: targets };
    });
  }

  async function viaEdge(text, langs, glossary) {
    var res = await fetch('api/translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, source: 'de', targets: langs, glossary: glossaryPairs(text, glossary, langs) })
    });
    var body = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(body.error === 'no_engine' ? 'Am Edge-Server ist keine Übersetzungs-Engine eingerichtet.' : 'Edge-Server: Übersetzung fehlgeschlagen.');
    var out = {};
    langs.forEach(function (l) {
      var r = body.results && body.results[l];
      out[l] = r && !r.error ? { text: String(r.text || ''), back: String(r.back || '') } : { text: '', back: '', error: true };
    });
    return { results: out, detail: body.engine + (body.backEngine && body.backEngine !== body.engine ? ' / Rück: ' + body.backEngine : '') };
  }

  var translators = {};
  async function browserTranslator(src, tgt) {
    var key = src + '>' + tgt;
    if (!translators[key]) translators[key] = root.Translator.create({ sourceLanguage: src, targetLanguage: tgt });
    return translators[key];
  }

  async function viaBrowser(text, langs) {
    var out = {};
    await Promise.all(langs.map(async function (l) {
      try {
        var fwd = await browserTranslator('de', l);
        var t = await fwd.translate(text);
        var bwd = await browserTranslator(l, 'de');
        var b = await bwd.translate(t);
        out[l] = { text: t, back: b };
      } catch (e) { out[l] = { text: '', back: '', error: true }; }
    }));
    return { results: out, detail: 'Translator-API des Browsers' };
  }

  async function viaClaude(text, langs, glossary) {
    var sample = state.claude.sample;
    var pairs = glossaryPairs(text, glossary, langs);
    var glossLines = [];
    pairs.forEach(function (p) {
      Object.keys(p.targets).forEach(function (l) { glossLines.push('- ' + l + ': "' + p.de + '" → "' + p.targets[l] + '"'); });
    });
    var names = langs.map(function (l) { return l + ' (' + LANG[l].name + ')'; }).join(', ');
    var prompt1 =
      'Du bist Fachübersetzer für Arbeitsschutz-Unterweisungen in einem deutschen Industriebetrieb.\n' +
      'Übersetze den deutschen Satz unten in diese Sprachen: ' + names + '.\n' +
      'Regeln: kurze, klare Sätze für Beschäftigte mit wenig Lesepraxis; alle Zahlen und Einheiten unverändert; ' +
      'jede Verneinung und jedes Verbot erhalten; nichts hinzufügen oder weglassen.\n' +
      (glossLines.length ? 'Verwende exakt diese freigegebenen Fachbegriffe:\n' + glossLines.join('\n') + '\n' : '') +
      'Antworte nur mit einem JSON-Objekt, Schlüssel = Sprachcode, Wert = Übersetzung, z. B. {"pl":"…"}.\n\n' +
      'Satz: """' + text + '"""';
    var fwd = await sample.json(prompt1, { modelTier: 'quick' });
    var forward = {};
    langs.forEach(function (l) { forward[l] = typeof (fwd && fwd[l]) === 'string' ? fwd[l].slice(0, 1200) : ''; });

    // Rückübersetzung in einem getrennten Aufruf, der den Ausgangssatz nicht kennt
    var prompt2 =
      'Übersetze jeden Text im JSON unten wörtlich und ungeglättet ins Deutsche, damit Bedeutungsunterschiede sichtbar bleiben. ' +
      'Korrigiere nichts. Antworte nur mit einem JSON-Objekt mit denselben Schlüsseln.\n\n' + JSON.stringify(forward);
    var bwd = await sample.json(prompt2, { modelTier: 'quick' });
    var out = {};
    langs.forEach(function (l) {
      out[l] = { text: forward[l], back: typeof (bwd && bwd[l]) === 'string' ? bwd[l].slice(0, 1200) : '' };
      if (!forward[l]) out[l].error = true;
    });
    return { results: out, detail: 'Claude (Online-Demo, getrennte Rückübersetzung)' };
  }

  /*
   * translate(text, langs, opts) -> {
   *   engine, label, detail, ms, origin ('kernsatz'|'live'|'scenario'),
   *   kernsatz?, scenario?, results: { lang: { text, back, origin } }, suggestion?
   * }
   */
  async function translate(text, langs, opts) {
    opts = opts || {};
    var t0 = performance.now();
    var clean = String(text || '').trim();
    if (!clean) throw new Error('Bitte zuerst einen Satz eingeben.');

    var ks = G.matchKernsatz(clean, D.kernsaetze);
    if (opts.kernsatzId || (ks && ks.exact)) {
      var k = opts.kernsatzId ? D.kernsaetze.filter(function (x) { return x.id === opts.kernsatzId; })[0] : ks.item;
      var res = {};
      langs.forEach(function (l) { res[l] = { text: k.t[l] || '', back: k.de, origin: 'kernsatz' }; });
      return done('kernsatz', 'kernsatz', res, { kernsatz: k });
    }

    var sc = D.scenarios.filter(function (s) { return opts.scenarioId ? s.id === opts.scenarioId : G.normKey(s.de) === G.normKey(clean); })[0];
    if (sc) {
      var r2 = {};
      langs.forEach(function (l) { var p = sc.r[l] || ['', '']; r2[l] = { text: p[0], back: p[1] }; });
      return done('scenario', 'live', r2, { scenario: sc });
    }

    var eng = liveEngine(opts.engine);
    if (!eng) {
      var err = new Error('Keine Live-Übersetzung verfügbar. In dieser Demo laufen geprüfte Kernsätze und die Prüf-Demo; für freie Sätze den Edge-Server mit Engine starten.');
      err.code = 'no_engine';
      err.suggestion = ks && ks.score >= 0.45 ? ks.item : null;
      throw err;
    }
    var out = eng === 'edge' ? await viaEdge(clean, langs, opts.glossary || D.glossary)
      : eng === 'browser' ? await viaBrowser(clean, langs)
      : await viaClaude(clean, langs, opts.glossary || D.glossary);
    return done(eng, 'live', out.results, { detail: out.detail, suggestion: ks && ks.score >= 0.45 ? ks.item : null });

    function done(engine, origin, results, extra) {
      var r = Object.assign({ engine: engine, label: ENGINE_LABEL[engine], origin: origin, results: results, ms: Math.round(performance.now() - t0) }, extra || {});
      return r;
    }
  }

  // ------------------------------------------------------------------
  // Vorlesen (Ton fürs Handy oder den Gehörschutz) – Stimmen des Geräts
  // ------------------------------------------------------------------
  function voices() {
    try { return root.speechSynthesis ? root.speechSynthesis.getVoices() : []; } catch (e) { return []; }
  }
  function voiceFor(lang) {
    var tag = (LANG[lang] && LANG[lang].tts) || lang;
    var list = voices().filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf(tag.toLowerCase().slice(0, 2)) === 0; });
    list.sort(function (a, b) { return (b.localService ? 1 : 0) - (a.localService ? 1 : 0); });
    return list[0] || null;
  }
  // opts.onend(fertig) wird gerufen, wenn die Ausgabe endet (fertig=false: abgebrochen/Fehler)
  function speak(text, lang, opts) {
    opts = opts || {};
    if (!root.speechSynthesis) return { ok: false, reason: 'Dieser Browser kann nicht vorlesen.' };
    var v = voiceFor(lang);
    if (!v) return { ok: false, reason: 'Auf diesem Gerät ist keine Stimme für ' + (LANG[lang] ? LANG[lang].name : lang) + ' installiert.' };
    try {
      root.speechSynthesis.cancel();
      var u = new root.SpeechSynthesisUtterance(text);
      u.lang = v.lang; u.voice = v; u.rate = opts.rate || 0.92;
      var ended = false;
      function end(ok) { if (ended) return; ended = true; if (opts.onend) opts.onend(ok); }
      u.onend = function () { end(true); };
      u.onerror = function () { end(false); };
      root.speechSynthesis.speak(u);
      // Sicherheitsnetz: manche Browser melden das Ende nicht zuverlässig
      if (opts.onend) setTimeout(function () { end(!root.speechSynthesis.speaking); }, Math.min(30000, 2500 + String(text).length * 90));
      return { ok: true, local: v.localService, voice: v.name, cancel: function () { try { root.speechSynthesis.cancel(); } catch (e) { /* ignorieren */ } end(false); } };
    } catch (e) { return { ok: false, reason: 'Vorlesen nicht möglich.' }; }
  }
  // iOS und einige Browser erlauben Vorlesen erst nach einer Nutzer-Geste: leere Ausgabe in der Geste anstoßen
  function unlockSpeech() {
    try { if (root.speechSynthesis && !root.speechSynthesis.speaking) root.speechSynthesis.speak(new root.SpeechSynthesisUtterance('')); } catch (e) { /* ignorieren */ }
  }

  // Mehrere Sprachen nacheinander vorlesen (Lautsprecher am Gerät der Führungskraft)
  function speakAll(list) {
    if (!root.speechSynthesis) return { ok: false, missing: [] };
    try { root.speechSynthesis.cancel(); } catch (e) { /* ignorieren */ }
    var missing = [], any = false;
    (list || []).forEach(function (it) {
      if (!it || !it.text) return;
      var v = voiceFor(it.lang);
      if (!v) { missing.push(it.lang); return; }
      var u = new root.SpeechSynthesisUtterance(it.text);
      u.lang = v.lang; u.voice = v; u.rate = 0.92;
      root.speechSynthesis.speak(u);
      any = true;
    });
    return { ok: any, missing: missing };
  }

  // ------------------------------------------------------------------
  // Spracheingabe der Führungskraft
  // ------------------------------------------------------------------
  function sttMode() {
    if (state.edge.available && state.edge.health && state.edge.health.stt && state.edge.health.stt.configured && root.MediaRecorder) return 'edge';
    var SR = root.SpeechRecognition || root.webkitSpeechRecognition;
    return SR ? 'browser' : null;
  }

  // Liefert ein Objekt mit stop(); ruft onText(text, final) auf, onEnd() wenn die Erkennung vorbei ist
  // (auch ohne Ergebnis, z. B. Stille), onError(meldung) nur bei echten Fehlern.
  async function listen(onText, onError, onEnd) {
    var mode = sttMode();
    if (mode === 'edge') {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      var chunks = [];
      var rec = new root.MediaRecorder(stream);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = async function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        try {
          var blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          var res = await fetch('api/stt', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
          var body = await res.json();
          if (!res.ok) throw new Error(body.error || 'stt');
          onText(String(body.text || ''), true);
        } catch (e) { onError && onError('Spracherkennung am Edge-Server fehlgeschlagen.'); }
        onEnd && onEnd();
      };
      rec.start();
      return { mode: mode, stop: function () { if (rec.state !== 'inactive') rec.stop(); } };
    }
    if (mode === 'browser') {
      var SR = root.SpeechRecognition || root.webkitSpeechRecognition;
      var r = new SR();
      r.lang = 'de-DE'; r.interimResults = true; r.continuous = false;
      r.onresult = function (e) {
        var txt = '', fin = false;
        for (var i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; fin = e.results[i].isFinal; }
        onText(txt, fin);
      };
      r.onerror = function (e) {
        if (e.error === 'no-speech' || e.error === 'aborted') return; // kein Fehler: nichts gesagt oder bewusst beendet
        onError && onError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Mikrofon nicht freigegeben.' : 'Spracherkennung nicht verfügbar.');
      };
      r.onend = function () { onEnd && onEnd(); };
      r.start();
      return { mode: mode, stop: function () { try { r.stop(); } catch (e) { /* schon beendet */ } } };
    }
    throw new Error('Keine Spracherkennung verfügbar.');
  }

  root.SB_ENGINES = {
    state: state, LABEL: ENGINE_LABEL,
    detectEdge: detectEdge, detectBrowser: detectBrowser, detectClaude: detectClaude,
    available: available, liveEngine: liveEngine, translate: translate,
    speak: speak, speakAll: speakAll, unlockSpeech: unlockSpeech, voiceFor: voiceFor, sttMode: sttMode, listen: listen
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

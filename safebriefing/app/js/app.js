/*
 * SafeBriefing – Leitstand, Geräteansichten und Beschäftigten-Ansicht
 */
(function () {
  'use strict';

  var D = window.SB_DATA, G = window.SBGuardrail, E = window.SB_ENGINES, BUS = window.SB_BUS, PIC = window.SB_PICTOS;
  var SB = window.SB = window.SB || {};
  var LANG = {};
  D.languages.forEach(function (l) { LANG[l.code] = l; });
  var TARGETS = D.languages.filter(function (l) { return l.code !== 'de'; }).map(function (l) { return l.code; });
  var framed = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  // ------------------------------------------------------------------
  // Hilfsfunktionen
  // ------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function hhmmss(ts) { var d = new Date(ts); return hhmm(ts) + ':' + pad(d.getSeconds()); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function deDate(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso; }
  function ago(ts) {
    var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'vor ' + s + ' s';
    return 'vor ' + Math.round(s / 60) + ' min';
  }
  function lname(code) { return LANG[code] ? LANG[code].name : code; }
  function ui(lang) { return D.ui[lang] || D.ui.en; }
  function dirOf(lang) { return LANG[lang] && LANG[lang].dir === 'rtl' ? 'rtl' : 'ltr'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  var ICONS = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.5M12 17.5v.3"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-5.5z"/>',
    q: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.6M12 17v.4"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>'
  };
  function icon(n) {
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';
  }
  function qrSvg(text) {
    try {
      var q = window.qrcode(0, 'M');
      q.addData(text);
      q.make();
      return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'QR-Code' });
    } catch (e) { return ''; }
  }
  function quizById(id) { return D.quiz.concat(D.fremdfirmen.quiz).filter(function (x) { return x.id === id; })[0] || null; }
  // Vorbereiteter Inhalt: Kernsatz oder Fremdfirmen-Regel, einheitlich als { id, de, t, pictos }
  function itemById(id) {
    var k = D.kernsaetze.filter(function (x) { return x.id === id; })[0];
    if (k) return { id: k.id, de: k.de, t: k.t, pictos: k.pictos, title: null, emergency: !!k.emergency };
    var r = D.fremdfirmen.rules.filter(function (x) { return x.id === id; })[0];
    if (r) {
      var t = {};
      Object.keys(r.text).forEach(function (l) { if (l !== 'de') t[l] = r.title[l] + ': ' + r.text[l]; });
      return { id: r.id, de: r.title.de + ': ' + r.text.de, t: t, pictos: [r.picto], title: r.title.de, emergency: false };
    }
    return null;
  }
  function pictos(list, size) { return (list || []).map(function (p) { return PIC.render(p, size); }).join(''); }

  // ------------------------------------------------------------------
  // Zustand (Glossar, Nachweise, Fremdfirmen bleiben im Browser gespeichert)
  // ------------------------------------------------------------------
  var STORE_KEY = 'safebriefing.v1';
  function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {}; } catch (e) { return {}; } }
  var saved = load();

  function newWorker(lang) { return { lang: lang || null, acked: {}, answered: {}, showDe: false, signed: false, askQ: '', askA: null, askBusy: false, note: '', sound: false, spoken: {}, ended: false, pass: null, otherLangs: false }; }

  var S = SB.S = {
    route: 'leitstand', routeLang: null,
    langs: saved.langs || ['pl', 'ro', 'tr', 'ar', 'uk'],
    settings: Object.assign({ engine: 'auto', autoRelease: false, emergencyPolicy: 'warn', minSimilarity: 0.3, sim: true }, saved.settings || {}),
    glossary: saved.glossary || clone(D.glossary),
    contractors: saved.contractors || clone(D.demo.contractors),
    sessions: saved.sessions || clone(D.demo.sessions),
    findings: saved.findings || [],
    topic: 'Schichtbriefing ' + D.site.halle + ' · ' + D.site.schicht,
    sessionStart: Date.now(),
    libTab: 'kern', deviceTab: 'display', previewLang: { phone: 'pl', glasses: 'ro' },
    draft: null, busy: false, error: null,
    feed: [], feedback: [], quiz: null, participants: [],
    acks: {}, simAcks: {}, notUnderstood: {},
    stats: { released: 0, blocked: 0, confirmed: 0, held: 0 },
    devices: {}, ownMessages: 0,
    worker: newWorker(saved.workerLang), preview: newWorker('pl'),
    induction: { step: 0, lang: null, answers: {}, name: '', firma: '', result: null },
    glFilter: { cat: 'alle', q: '' }, nachweisSel: null, flash: null,
    programs: saved.programs || clone(D.programs),
    simple: { step: 'pick', programId: null, langs: saved.simpleLangs || ['uk', 'ar', 'el'], idx: 0, busy: false, pending: null, error: null, typing: false, listening: false, speakHere: true, summary: null, sessionId: null, quizAsked: false, note: '' },
    session: null
  };

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        langs: S.langs, settings: S.settings, glossary: S.glossary, contractors: S.contractors,
        sessions: S.sessions.slice(-60), findings: S.findings.slice(-100), workerLang: S.worker.lang,
        programs: S.programs, simpleLangs: S.simple.langs
      }));
    } catch (e) { /* privates Fenster o. Ä. – App läuft ohne Speicherung weiter */ }
  }

  // ------------------------------------------------------------------
  // Nachrichten zwischen Leitstand und Geräten
  // ------------------------------------------------------------------
  BUS.on('briefing.msg', function (m) {
    if (!m || !m.id) return;
    var i = S.feed.findIndex(function (x) { return x.id === m.id; });
    var isNew = i < 0;
    if (i >= 0) S.feed[i] = m; else S.feed.unshift(m);
    S.feed = S.feed.slice(0, 40);
    // Handy der Beschäftigten: neue Anweisung automatisch vorlesen
    var w = S.worker;
    if (S.route === 'join' && isNew && w.lang && w.sound && !w.spoken[m.id] && Date.now() - m.ts < 20000) {
      w.spoken[m.id] = 1;
      E.speak(w.lang === 'de' ? m.de : (m.texts[w.lang] || ui(w.lang).held), w.lang);
    }
    refresh('feed');
  });
  BUS.on('briefing.session', function (x) {
    if (!x || !x.id) return;
    if (!S.session || S.session.id !== x.id) { S.worker.ended = false; S.worker.signed = false; S.worker.pass = null; }
    S.session = { id: x.id, title: String(x.title || ''), type: x.type, langs: Array.isArray(x.langs) ? x.langs.filter(function (l) { return LANG[l]; }) : [] };
    refresh('session');
  });
  BUS.on('briefing.end', function () {
    S.worker.ended = true;
    if (S.quiz) S.quiz.closed = true;
    refresh('session');
  });
  BUS.on('briefing.quiz', function (q) {
    if (!q || !q.id) return;
    if (S.quiz && S.quiz.id === q.id) return;
    S.quiz = { id: q.id, qid: q.qid, ts: q.ts, closed: false, correct: 0, wrong: 0, sim: 0, byLang: {} };
    refresh('quiz');
  });
  BUS.on('briefing.quizend', function (q) { if (S.quiz && q && q.id === S.quiz.id) { S.quiz.closed = true; refresh('quiz'); } });
  BUS.on('briefing.reset', function () { S.feed = []; S.quiz = null; S.feedback = []; S.worker.acked = {}; S.preview.acked = {}; refresh('all'); });
  BUS.on('worker.ack', function (a) {
    if (!a || !a.msgId) return;
    S.acks[a.msgId] = (S.acks[a.msgId] || 0) + 1;
    refresh('acks');
  });
  BUS.on('worker.feedback', function (f) {
    if (!f) return;
    S.feedback.unshift(Object.assign({ ts: Date.now() }, f));
    S.feedback = S.feedback.slice(0, 50);
    if (f.kind === 'nicht' && f.msgId) S.notUnderstood[f.msgId] = (S.notUnderstood[f.msgId] || 0) + 1;
    refresh('rueck');
  });
  BUS.on('worker.answer', function (a) {
    if (!a || !S.quiz || a.quizId !== S.quiz.id || S.quiz.closed) return;
    if (a.correct) S.quiz.correct++; else S.quiz.wrong++;
    var b = S.quiz.byLang[a.lang] = S.quiz.byLang[a.lang] || { c: 0, w: 0 };
    if (a.correct) b.c++; else b.w++;
    refresh('quiz');
  });
  BUS.on('worker.join', function (j, msg) {
    if (!j) return;
    if (msg.from !== BUS.tabId && j.device) S.devices[j.device] = { lang: j.lang, ts: Date.now() };
    if (j.signed && j.name) {
      S.participants.push({ name: String(j.name).slice(0, 80), firma: String(j.firma || '').slice(0, 80), lang: j.lang, ts: Date.now() });
      if (j.passCode && !S.contractors.some(function (c) { return c.passCode === j.passCode; })) {
        S.contractors.unshift({ id: 'c' + Date.now().toString(36), name: String(j.name).slice(0, 80), firma: String(j.firma || '–').slice(0, 80) || '–', lang: j.lang,
          bereich: 'Gruppeneinweisung', koordinator: 'offen', since: today(), until: String(j.until || today()), permits: [], passCode: String(j.passCode).slice(0, 12), fresh: true });
        persist();
      }
    }
    // Spät beigetretene Geräte bekommen die letzten Anweisungen erneut (gleiche id → kein Duplikat)
    if ((S.route === 'leitstand' || S.route === 'start') && msg.from !== BUS.tabId && !j.signed) {
      if (S.route === 'start' && S.simple.step === 'live' && SB.sessionInfo) BUS.publish('briefing.session', SB.sessionInfo());
      if (S.ownMessages > 0) S.feed.slice(0, 3).reverse().forEach(function (m) { BUS.publish('briefing.msg', m); });
      if (S.quiz && !S.quiz.closed) BUS.publish('briefing.quiz', { id: S.quiz.id, qid: S.quiz.qid, ts: S.quiz.ts });
    }
    refresh('session');
  });

  // ------------------------------------------------------------------
  // Simulierte Belegschaft (klar als simuliert gekennzeichnet)
  // ------------------------------------------------------------------
  function simDevicesFor(langs) {
    var n = 0;
    langs.forEach(function (l) { n += D.demo.simDevices[l] || 1; });
    return n;
  }
  function simulateAcks(msg) {
    if (!S.settings.sim) return;
    var langs = Object.keys(msg.texts);
    var total = 0;
    langs.forEach(function (l) { total += D.demo.simDevices[l] || 1; });
    for (var i = 0; i < total; i++) {
      setTimeout(function () { S.simAcks[msg.id] = (S.simAcks[msg.id] || 0) + 1; refresh('acks'); }, 500 + Math.random() * 3500);
    }
    if (S.ownMessages % 3 === 2 && langs.length) {
      var l = langs[Math.floor(Math.random() * langs.length)];
      var qr = D.quickReplies[0];
      setTimeout(function () {
        S.feedback.unshift({ ts: Date.now(), lang: l, kind: 'quick', id: qr.id, text: qr.t[l], de: qr.t.de, msgId: msg.id, sim: true });
        refresh('rueck');
      }, 2600);
    }
  }
  function simulateAnswers(quiz) {
    if (!S.settings.sim) return;
    var langs = S.langs.slice();
    langs.forEach(function (l) {
      var n = D.demo.simDevices[l] || 1;
      for (var i = 0; i < n; i++) {
        setTimeout(function () {
          if (!S.quiz || S.quiz.id !== quiz.id || S.quiz.closed) return;
          var ok = Math.random() < 0.86;
          S.quiz.sim++;
          if (ok) S.quiz.correct++; else S.quiz.wrong++;
          var b = S.quiz.byLang[l] = S.quiz.byLang[l] || { c: 0, w: 0 };
          if (ok) b.c++; else b.w++;
          refresh('quiz');
        }, 1200 + Math.random() * 5000);
      }
    });
  }

  // ------------------------------------------------------------------
  // Übersetzen, prüfen, freigeben
  // ------------------------------------------------------------------
  async function runCheck(text, opts) {
    opts = opts || {};
    var langs = S.langs.slice();
    if (!langs.length) { S.error = { msg: 'Bitte mindestens eine Sprache der Schicht auswählen.' }; refresh('check'); return; }
    S.busy = true; S.error = null; S.draft = null;
    refresh('check');
    try {
      var r = await E.translate(text, langs, { kernsatzId: opts.kernsatzId, scenarioId: opts.scenarioId, engine: S.settings.engine, glossary: S.glossary });
      var results = {};
      langs.forEach(function (l) { results[l] = Object.assign({ origin: r.origin }, r.results[l] || { text: '', back: '' }); });
      var source = r.kernsatz ? r.kernsatz.de : (r.scenario ? r.scenario.de : String(text).trim());
      var analysis = G.analyzeAll({
        source: source, results: results, glossary: S.glossary, origin: r.origin,
        options: { emergencyPolicy: S.settings.emergencyPolicy, minSimilarity: S.settings.minSimilarity }
      });
      var pics = r.kernsatz ? r.kernsatz.pictos.slice() : [];
      G.glossaryHits(source, S.glossary).forEach(function (g) { if (g.picto && pics.indexOf(g.picto) < 0) pics.push(g.picto); });
      S.draft = {
        id: BUS.rid(), source: source, origin: r.origin, engine: r.engine, label: r.label, detail: r.detail || '', ms: r.ms,
        kernsatz: r.kernsatz || null, scenario: r.scenario || null, suggestion: r.suggestion || null,
        langs: langs, results: results, analysis: analysis, confirmed: {}, pictos: pics.slice(0, 3)
      };
      S.busy = false;
      if (S.settings.autoRelease && analysis.status === 'green') { release(false, true); return; }
    } catch (e) {
      S.busy = false;
      S.error = { msg: e && e.message ? e.message : 'Übersetzung fehlgeschlagen.', suggestion: e && e.suggestion ? e.suggestion : null };
    }
    refresh('check');
  }

  function langState(d, l) {
    var st = d.analysis.perLang[l].status;
    if (st === 'red') return 'blocked';
    if (st === 'yellow' && !d.confirmed[l]) return 'pending';
    return 'ok';
  }

  // Eine freigegebene Anweisung an alle Geräte senden
  function sendMessage(o) {
    var msg = { id: o.id || BUS.rid(), ts: Date.now(), de: o.de, texts: o.texts, held: o.held || [], pictos: o.pictos || [], origin: o.origin, engine: o.engine, kernsatzId: o.kernsatzId || null };
    S.ownMessages++;
    S.stats.released++;
    S.stats.held += msg.held.length;
    BUS.publish('briefing.msg', msg);
    simulateAcks(msg);
    return msg;
  }

  function recordBlocked(source, lang, result, analysis, engine, state) {
    S.findings.unshift({
      ts: Date.now(), source: source, lang: lang, translation: result.text, back: result.back, engine: engine,
      problems: analysis.checks.filter(function (c) { return c.level === 'block' || (state !== 'offen' && c.level === 'warn'); }).map(function (c) { return c.title + ': ' + c.detail; }), state: state || 'offen'
    });
  }

  function release(onlyOk, auto) {
    var d = S.draft;
    if (!d) return;
    var texts = {}, held = [];
    d.langs.forEach(function (l) {
      var s = langState(d, l);
      if (s === 'ok') texts[l] = d.results[l].text; else held.push(l);
    });
    if (!onlyOk && held.length) return;
    if (!Object.keys(texts).length) return;
    S.stats.confirmed += Object.keys(d.confirmed).filter(function (l) { return d.confirmed[l]; }).length;
    d.langs.forEach(function (l) {
      var a = d.analysis.perLang[l];
      if (a.status === 'red') { S.stats.blocked++; recordBlocked(d.source, l, d.results[l], a, d.engine); }
    });
    persist();
    sendMessage({ id: d.id, de: d.source, texts: texts, held: held, pictos: d.pictos, origin: d.origin, engine: d.engine, kernsatzId: d.kernsatz ? d.kernsatz.id : null });
    S.draft = null;
    S.flash = auto ? 'Automatisch freigegeben: alle Sprachen grün.' : (held.length ? 'Freigegeben. ' + plural(held.length, 'Sprache wird', 'Sprachen werden') + ' zurückgehalten.' : 'Freigegeben an ' + plural(Object.keys(texts).length, 'Sprache', 'Sprachen') + '.');
    var ta = $('#say'); if (ta) { ta.value = ''; updateCount(); }
    refresh('all');
  }

  function startQuiz(qid) {
    var q = { id: BUS.rid(), qid: qid, ts: Date.now() };
    BUS.publish('briefing.quiz', q);
    if (S.quiz) simulateAnswers(S.quiz);
  }

  function sessionRecord(topic, type) {
    var real = Object.keys(S.devices).length;
    var sim = S.settings.sim ? simDevicesFor(S.langs) : 0;
    var q = S.quiz;
    return {
      id: 'n-' + Date.now().toString(36), type: type || 'briefing', date: today(), start: hhmm(S.sessionStart), end: hhmm(Date.now()),
      topic: topic, leader: D.site.leader, langs: S.langs.slice(), released: S.stats.released, blocked: S.stats.blocked,
      confirmed: S.stats.confirmed, held: S.stats.held,
      participants: S.participants.length + sim + real, named: S.participants.slice(), simulated: sim,
      quiz: q ? { correct: q.correct, total: q.correct + q.wrong, qid: q.qid } : null,
      messages: S.feed.slice().reverse().map(function (m) { return { ts: m.ts, de: m.de, held: m.held, langs: Object.keys(m.texts), kernsatz: !!m.kernsatzId }; }),
      live: true
    };
  }

  function resetLive() {
    BUS.publish('briefing.reset', {});
    S.stats = { released: 0, blocked: 0, confirmed: 0, held: 0 };
    S.participants = []; S.acks = {}; S.simAcks = {}; S.notUnderstood = {}; S.ownMessages = 0; S.sessionStart = Date.now();
  }

  function closeSession() {
    var sess = sessionRecord(S.topic, 'briefing');
    S.sessions.push(sess);
    persist();
    resetLive();
    S.nachweisSel = sess.id;
    location.hash = 'nachweise';
  }

  // ------------------------------------------------------------------
  // Render: Leitstand
  // ------------------------------------------------------------------
  function viewLeitstand(root) {
    root.innerHTML =
      '<div class="ls-grid">' +
        '<div class="stack">' +
          '<section class="card session-bar" id="ls-session" aria-label="Briefing"></section>' +
          '<section class="card mobile-only" aria-label="Ansichten ausprobieren"><h3>Ansichten ausprobieren</h3>' +
            '<p class="small muted" style="margin:4px 0 10px">So sieht es bei den Beschäftigten aus. Erst unten einen Kernsatz freigeben, dann eine Ansicht öffnen.</p>' +
            '<div class="try-grid">' +
              '<a class="btn" href="#join-pl">' + icon('speaker') + 'Handy (Polnisch)</a>' +
              '<a class="btn" href="#join-ar">' + icon('speaker') + 'Handy (Arabisch)</a>' +
              '<a class="btn" href="#display">' + icon('expand') + 'Hallen-Display</a>' +
              '<a class="btn" href="#brille-ro">' + icon('expand') + 'Smart-Brille</a>' +
              '<a class="btn" href="#pforte">' + icon('doc') + 'Fremdfirmen-Pforte</a>' +
            '</div></section>' +
          '<section class="card" id="ls-composer" aria-label="Ansage"></section>' +
          '<div id="ls-check" aria-live="polite"></div>' +
          '<section class="card" id="ls-rueck" aria-label="Rückmeldungen"></section>' +
          '<section class="card" id="ls-quiz" aria-label="Verständnis-Check"></section>' +
          '<section class="card" id="ls-feed" aria-label="Verlauf"></section>' +
        '</div>' +
        '<aside class="ls-side stack">' +
          '<section class="card devices" id="ls-devices" aria-label="Ausgabe"></section>' +
          '<section class="card" id="ls-join" aria-label="Beitreten"></section>' +
        '</aside>' +
      '</div>';
    renderSession(); renderComposer(); renderCheck(); renderRueck(); renderQuiz(); renderFeed(); renderDevices(); renderJoin();
  }

  function deviceCount() {
    var real = Object.keys(S.devices).length;
    var sim = S.settings.sim ? simDevicesFor(S.langs) : 0;
    return { real: real, sim: sim };
  }

  function renderSession() {
    var el = $('#ls-session'); if (!el) return;
    var dc = deviceCount();
    var eng = E.liveEngine(S.settings.engine);
    el.innerHTML =
      '<div class="card-head" style="margin-bottom:0">' +
        '<div class="grow"><span class="label">Briefing läuft seit ' + hhmm(S.sessionStart) + '</span>' +
        '<label class="sr-only" for="topic">Thema</label><input id="topic" type="text" value="' + esc(S.topic) + '" style="font:600 1.35rem var(--font-display);border:0;padding:2px 0;background:transparent"></div>' +
        '<button class="btn sm" data-action="close-session">' + icon('doc') + 'Abschließen und Nachweis</button>' +
      '</div>' +
      '<div class="row"><span class="label" style="margin-inline-end:4px">Sprachen der Schicht</span>' +
        TARGETS.map(function (l) {
          return '<button class="chip ' + (S.langs.indexOf(l) >= 0 ? 'on' : '') + '" data-action="toggle-lang" data-lang="' + l + '" aria-pressed="' + (S.langs.indexOf(l) >= 0) + '"><span class="code">' + l.toUpperCase() + '</span>' + esc(LANG[l].name) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="session-meta">' +
        '<span>Geräte <b>' + (dc.real + dc.sim) + '</b>' + (dc.sim ? ' (' + dc.sim + ' simuliert)' : '') + '</span>' +
        '<span>Freigegeben <b>' + S.stats.released + '</b></span>' +
        '<span>Gesperrte Übersetzungen <b>' + S.stats.blocked + '</b></span>' +
        '<span>Bestätigt nach Prüfung <b>' + S.stats.confirmed + '</b></span>' +
        '<span>Live-Engine <b>' + esc(eng ? E.LABEL[eng] : 'keine (nur Kernsätze und Prüf-Demo)') + '</b></span>' +
      '</div>';
  }

  function renderComposer() {
    var el = $('#ls-composer'); if (!el) return;
    var stt = !framed && E.sttMode();
    el.innerHTML =
      '<div class="card-head"><h2>Ansage</h2><span class="small muted">Kurze Sätze, ein Gedanke pro Satz.</span></div>' +
      '<label class="sr-only" for="say">Ansage auf Deutsch</label>' +
      '<textarea id="say" maxlength="280" placeholder="Sprechen oder tippen, z. B. „Heute an Linie 2 nur mit Schutzbrille arbeiten.“"></textarea>' +
      '<div class="composer-actions">' +
        (stt ? '<button class="btn" data-action="mic" id="mic" title="' + (stt === 'edge' ? 'Spracherkennung lokal am Edge-Server' : 'Demo: Browser-Spracherkennung kann Audio an den Browser-Hersteller senden') + '">' + icon('mic') + 'Sprechen</button>' : '') +
        '<button class="btn primary" data-action="translate">' + icon('shield') + 'Übersetzen und prüfen</button>' +
        '<span class="count" id="say-count">0 / 280</span>' +
      '</div>' +
      (stt === 'browser' ? '<p class="small muted" style="margin-top:6px">Spracheingabe im Demo-Modus über den Browser. Im Werk läuft die Spracherkennung lokal auf dem Edge-Server.</p>' : '') +
      '<div class="subtabs" role="tablist">' +
        '<button role="tab" aria-selected="' + (S.libTab === 'kern') + '" data-action="libtab" data-tab="kern">Geprüfte Kernsätze</button>' +
        '<button role="tab" aria-selected="' + (S.libTab === 'demo') + '" data-action="libtab" data-tab="demo">Prüf-Demo: typische KI-Fehler</button>' +
      '</div>' +
      '<div id="ls-library"></div>';
    renderLibrary();
  }

  function renderLibrary() {
    var el = $('#ls-library'); if (!el) return;
    if (S.libTab === 'demo') {
      el.innerHTML = '<p class="small muted" style="margin-bottom:8px">Simulierte Live-Engine mit eingebauten Fehlern. Zeigt, was der Sinnvergleich abfängt, bevor etwas auf dem Display erscheint.</p>' +
        '<div class="scenario-list">' + D.scenarios.map(function (s) {
          return '<button class="scenario" data-action="scenario" data-id="' + s.id + '"><b>' + esc(s.label) + '</b><span>' + esc(s.hint) + '</span></button>';
        }).join('') + '</div>';
      return;
    }
    var cats = [];
    D.kernsaetze.forEach(function (k) { if (cats.indexOf(k.cat) < 0) cats.push(k.cat); });
    el.innerHTML = '<p class="small muted" style="margin-bottom:8px">Fachlich freigegeben und von Muttersprachlern geprüft. Notfallhinweise kommen nur von hier, nie aus der Live-Übersetzung.</p>' +
      '<div class="stack" style="gap:10px">' + cats.map(function (c) {
        return '<div><span class="label">' + esc(c) + '</span><div class="chip-group" style="margin-top:4px">' +
          D.kernsaetze.filter(function (k) { return k.cat === c; }).map(function (k) {
            return '<button class="chip ' + (k.emergency ? 'emergency' : '') + '" data-action="kernsatz" data-id="' + k.id + '">' + (k.emergency ? '<span class="pill red" style="padding:0 6px">Notfall</span>' : '') + esc(k.de) + '</button>';
          }).join('') + '</div></div>';
      }).join('') + '</div>';
  }

  function updateCount() {
    var ta = $('#say'), c = $('#say-count');
    if (ta && c) c.textContent = ta.value.length + ' / 280';
  }

  function highlightBack(source, back) {
    var src = {};
    (G.normDE(source).match(/[\p{L}\p{N}]+/gu) || []).forEach(function (t) { src[t.length > 6 ? t.slice(0, 6) : t] = 1; });
    return esc(back).replace(/[\p{L}\p{N}]+/gu, function (w) {
      var n = G.normDE(w);
      var st = n.length > 6 ? n.slice(0, 6) : n;
      return (n.length > 3 && !src[st]) ? '<mark>' + w + '</mark>' : w;
    });
  }

  function statusPill(st, text) { return '<span class="pill ' + st + '">' + esc(text) + '</span>'; }

  function renderCheck() {
    var el = $('#ls-check'); if (!el) return;
    var flash = S.flash ? '<div class="notice ok" style="margin-bottom:12px">' + icon('check') + ' ' + esc(S.flash) + '</div>' : '';
    S.flash = null;
    if (S.busy) {
      el.innerHTML = '<section class="card"><div class="busy"><span class="spinner"></span>Übersetze in ' + plural(S.langs.length, 'Sprache', 'Sprachen') + ' und prüfe die Rückübersetzung …</div></section>';
      return;
    }
    if (S.error) {
      var sug = S.error.suggestion;
      el.innerHTML = flash + '<section class="card"><div class="notice bad">' + esc(S.error.msg) + '</div>' +
        (sug ? '<div class="notice suggest">Passender geprüfter Kernsatz: <b>' + esc(sug.de) + '</b> <button class="btn sm" data-action="kernsatz" data-id="' + sug.id + '">Kernsatz verwenden</button></div>' : '') +
        '</section>';
      return;
    }
    var d = S.draft;
    if (!d) { el.innerHTML = flash; return; }
    var a = d.analysis;
    var blocked = d.langs.filter(function (l) { return a.perLang[l].status === 'red'; });
    var pending = d.langs.filter(function (l) { return langState(d, l) === 'pending'; });
    var okLangs = d.langs.filter(function (l) { return langState(d, l) === 'ok'; });
    var banner;
    if (a.status === 'red') {
      var first = a.perLang[blocked[0]].checks.filter(function (c) { return c.level === 'block'; })[0];
      banner = ['alert', 'Gesperrt: ' + first.title + ' (' + blocked.map(lname).join(', ') + ')', 'Diese Sprache erhält die Anweisung nicht. Bitte umformulieren oder einen geprüften Kernsatz verwenden.'];
    } else if (a.status === 'yellow') {
      banner = ['alert', 'Bitte Rückübersetzung prüfen', plural(a.counts.yellow, 'Sprache braucht', 'Sprachen brauchen') + ' Ihre Bestätigung, bevor sie angezeigt ' + (a.counts.yellow === 1 ? 'wird' : 'werden') + '.'];
    } else {
      banner = ['shield', 'Sinn geprüft, bereit zur Freigabe', d.origin === 'kernsatz' ? 'Vorab geprüfter Kernsatz in allen Sprachen.' : 'Rückübersetzung, Zahlen, Verneinungen und Fachbegriffe in allen Sprachen geprüft.'];
    }
    var rows = d.langs.map(function (l) {
      var r = d.results[l], an = a.perLang[l];
      var findings = an.checks.filter(function (c) { return c.level !== 'ok'; }).map(function (c) {
        return '<span class="finding ' + c.level + '" title="' + esc(c.detail) + '">' + esc(c.title) + (c.detail && c.level !== 'info' ? ': ' + esc(c.detail) : '') + '</span>';
      }).concat(an.checks.filter(function (c) { return c.level === 'ok'; }).map(function (c) {
        return '<span class="finding ok" title="' + esc(c.detail) + '">✓ ' + esc(c.title) + '</span>';
      })).join('');
      var decide = an.status === 'red' ? statusPill('red', 'gesperrt')
        : an.status === 'yellow' ? statusPill('yellow', d.confirmed[l] ? 'bestätigt' : 'prüfen') +
          '<label><input type="checkbox" data-action="confirm" data-lang="' + l + '"' + (d.confirmed[l] ? ' checked' : '') + '> Rückübersetzung passt</label>'
        : statusPill('green', d.origin === 'kernsatz' ? 'geprüft' : 'grün');
      return '<div class="lrow">' +
        '<div class="lname"><span class="lang-badge">' + l.toUpperCase() + '</span>' + esc(lname(l)) + '</div>' +
        '<div><div class="tr" lang="' + l + '" dir="' + dirOf(l) + '">' + esc(r.text || '–') + '</div>' +
          (d.origin === 'kernsatz' ? '' : '<div class="back"><span class="label">Rückübersetzung</span><br>' + highlightBack(d.source, r.back || '–') + '</div>') + '</div>' +
        '<div class="decide">' + decide + '</div>' +
        '<div class="findings">' + findings + '</div>' +
      '</div>';
    }).join('');
    var canAll = !blocked.length && !pending.length;
    var actions =
      (canAll ? '<button class="btn ok" data-action="release">' + icon('send') + 'Freigeben an ' + plural(d.langs.length, 'Sprache', 'Sprachen') + '</button>' : '') +
      (!canAll && okLangs.length ? '<button class="btn primary" data-action="release-ok">' + icon('send') + 'Nur geprüfte Sprachen senden (' + okLangs.length + ' von ' + d.langs.length + ')</button>' : '') +
      '<button class="btn" data-action="rephrase">Umformulieren</button>' +
      '<button class="btn ghost" data-action="discard">Verwerfen</button>' +
      (a.status !== 'green' ? '<button class="btn ghost sm" data-action="false-alarm" title="Geht an die Sifa zur Prüfung des Glossars">Als Fehlalarm melden</button>' : '');
    el.innerHTML = flash +
      '<section class="card check st-' + a.status + '">' +
        '<div class="check-banner">' + icon(banner[0]) + '<div><strong>' + esc(banner[1]) + '</strong><span class="small">' + esc(banner[2]) + '</span></div></div>' +
        '<div class="check-source"><span class="label">Original · ' + esc(d.label) + (d.detail ? ' · ' + esc(d.detail) : '') + ' · ' + (d.ms / 1000).toFixed(1).replace('.', ',') + ' s</span>' +
          '<div class="row"><span class="de grow">' + esc(d.source) + '</span>' + pictos(d.pictos, '34px') + '</div></div>' +
        '<div class="check-rows">' + rows + '</div>' +
        (blocked.length && okLangs.length ? '<p class="small muted" style="padding:8px 2px 0">Gesperrte Sprachen sehen auf ihren Geräten: „Wird noch geprüft – bitte Führungskraft fragen.“</p>' : '') +
        (d.suggestion && d.origin !== 'kernsatz' ? '<div class="notice suggest">Es gibt einen geprüften Kernsatz: <b>' + esc(d.suggestion.de) + '</b> <button class="btn sm" data-action="kernsatz" data-id="' + d.suggestion.id + '">Kernsatz verwenden</button></div>' : '') +
        '<div class="check-actions">' + actions + '</div>' +
      '</section>';
  }

  function ackText(m) {
    var total = Object.keys(m.texts).reduce(function (n, l) { return n + (S.settings.sim ? (D.demo.simDevices[l] || 1) : 0); }, 0) + Object.keys(S.devices).length;
    var got = (S.acks[m.id] || 0) + (S.simAcks[m.id] || 0);
    return { got: got, total: Math.max(total, got) };
  }

  function renderFeed() {
    var el = $('#ls-feed'); if (!el) return;
    el.innerHTML = '<div class="card-head"><h2>Verlauf</h2><span class="small muted">Wird Teil des Unterweisungsnachweises</span></div>' +
      (S.feed.length ? S.feed.map(function (m) {
        var k = ackText(m), nu = S.notUnderstood[m.id] || 0;
        return '<div class="feed-item"><time>' + hhmm(m.ts) + '</time><div><div>' + esc(m.de) + '</div><div class="row small muted" style="margin-top:4px">' +
          statusPill(m.held.length ? 'yellow' : 'green', 'an ' + Object.keys(m.texts).length + (m.held.length ? ', ' + m.held.length + ' zurückgehalten' : '')) +
          (m.kernsatzId ? statusPill('blue', 'Kernsatz') : '') +
          '<span>' + k.got + ' / ' + k.total + ' „verstanden“</span>' + (nu ? '<span style="color:var(--bad)">' + nu + '× nicht verstanden</span>' : '') +
          '</div></div>' + pictos(m.pictos, '28px') + '</div>';
      }).join('') : '<p class="empty">Noch nichts freigegeben. Kernsatz wählen oder Ansage eingeben.</p>');
  }

  function renderRueck() {
    var el = $('#ls-rueck'); if (!el) return;
    var last = S.feed[0];
    var nu = last ? (S.notUnderstood[last.id] || 0) : 0;
    el.innerHTML = '<div class="card-head"><h2>Rückkanal</h2><span class="small muted">Anonym. Senkt die Hürde für „Ich habe es nicht verstanden“.</span></div>' +
      (nu ? '<div class="notice warn" style="margin-bottom:8px">' + nu + '× „nicht verstanden“ zur letzten Anweisung. Wiederholen, einfacher sagen oder vor Ort zeigen.</div>' : '') +
      (S.feedback.length ? S.feedback.slice(0, 8).map(function (f) {
        return '<div class="rk-item"><span class="lang-badge">' + esc(String(f.lang || '').toUpperCase()) + '</span><span class="grow">' + esc(f.de || f.text) +
          (f.de && f.text && f.de !== f.text ? ' <span class="muted small" lang="' + esc(f.lang) + '" dir="' + dirOf(f.lang) + '">(' + esc(f.text) + ')</span>' : '') +
          (f.sim ? ' <span class="pill grey">simuliert</span>' : '') + '</span><span class="small muted mono">' + hhmm(f.ts) + '</span></div>';
      }).join('') : '<p class="empty">Noch keine Rückmeldungen.</p>');
  }

  function renderQuiz() {
    var el = $('#ls-quiz'); if (!el) return;
    var q = S.quiz, def = q ? quizById(q.qid) : null;
    var opts = D.quiz.map(function (x) { return '<option value="' + x.id + '">' + esc(x.q.de) + '</option>'; }).join('');
    var head = '<div class="card-head"><h2>Verständnis-Check</h2><span class="small muted">Antworten anonym, nur Summen</span></div>';
    if (!q) {
      el.innerHTML = head + '<div class="row"><label class="sr-only" for="quiz-sel">Frage</label><select id="quiz-sel" class="grow" style="width:auto">' + opts + '</select>' +
        '<button class="btn primary" data-action="quiz-start">' + icon('q') + 'An alle senden</button></div>' +
        '<p class="small muted" style="margin-top:8px">Die Frage erscheint auf jedem Handy in der eigenen Sprache. So wird aus „Ja, verstanden“ ein Nachweis, ohne Einzelne zu bewerten.</p>';
      return;
    }
    var total = q.correct + q.wrong;
    var expected = deviceCount().real + deviceCount().sim;
    var pc = total ? Math.round(q.correct / total * 100) : 0;
    el.innerHTML = head +
      '<p style="font-weight:600;margin-bottom:10px">' + esc(def ? def.q.de : '') + '</p>' +
      '<div class="bars">' +
        '<div class="bar"><span>Richtig</span><span class="track"><span class="fill ok" style="width:' + (expected ? q.correct / expected * 100 : 0) + '%"></span></span><span class="num">' + q.correct + '</span></div>' +
        '<div class="bar"><span>Falsch</span><span class="track"><span class="fill bad" style="width:' + (expected ? q.wrong / expected * 100 : 0) + '%"></span></span><span class="num">' + q.wrong + '</span></div>' +
        '<div class="bar"><span>Ausstehend</span><span class="track"><span class="fill" style="width:' + (expected ? Math.max(0, expected - total) / expected * 100 : 0) + '%"></span></span><span class="num">' + Math.max(0, expected - total) + '</span></div>' +
      '</div>' +
      '<div class="row small muted" style="margin-top:10px">' + Object.keys(q.byLang).map(function (l) {
        var b = q.byLang[l]; return '<span><span class="lang-badge">' + l.toUpperCase() + '</span> ' + b.c + '/' + (b.c + b.w) + '</span>';
      }).join('') + (q.sim ? '<span class="pill grey">' + q.sim + ' simuliert</span>' : '') + '</div>' +
      '<div class="row" style="margin-top:12px"><span class="grow">' + (total ? '<b>' + pc + ' %</b> richtig' : 'Warte auf Antworten …') + (q.closed ? ' · abgeschlossen' : '') + '</span>' +
        (q.closed ? '<button class="btn sm" data-action="quiz-new">Neue Frage</button>' : '<button class="btn sm" data-action="quiz-end">Abschließen</button>') + '</div>' +
      (total && q.wrong / total > 0.2 ? '<div class="notice warn" style="margin-top:10px">Mehr als jede fünfte Antwort falsch: Punkt wiederholen und vorführen lassen.</div>' : '');
  }

  // ------------------------------------------------------------------
  // Gerätewand
  // ------------------------------------------------------------------
  function renderDevices() {
    var el = $('#ls-devices'); if (!el) return;
    var tabs = [['display', 'Hallen-Display'], ['phone', 'Handy'], ['glasses', 'Smart-Brille'], ['audio', 'Ton / Gehörschutz']];
    var body = '';
    if (S.deviceTab === 'display') {
      body = '<div class="device-stage"><div class="frame-display" id="dev-display">' + hallHtml() + '</div>' +
        '<div class="row"><a class="btn sm" href="#display">' + icon('expand') + 'Vollbild</a>' + (!framed ? '<a class="btn sm ghost" href="#display" target="_blank" rel="noopener">' + icon('external') + 'Neues Fenster (Beamer)</a>' : '') + '</div>' +
        '<p class="small muted">Beamer oder Großbildschirm in der Halle. Wer schlecht liest, sieht zusätzlich das Sicherheitszeichen.</p></div>';
    } else if (S.deviceTab === 'phone') {
      body = '<div class="device-stage">' + langSelect('prev-phone', S.preview.lang || 'pl') +
        '<div class="phone"><div class="phone-screen" id="dev-phone">' + workerHtml(S.preview, 'preview') + '</div></div>' +
        '<a class="btn sm" href="#join-' + (S.preview.lang || 'pl') + '">' + icon('expand') + 'Als Handy-Ansicht öffnen</a></div>';
    } else if (S.deviceTab === 'glasses') {
      body = '<div class="device-stage glasses-wrap">' + langSelect('prev-glasses', S.previewLang.glasses) +
        '<svg class="glasses-svg" viewBox="0 0 220 60" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 20 H214"/><rect x="16" y="20" width="82" height="32" rx="12"/><rect x="122" y="20" width="82" height="32" rx="12"/><path d="M98 32 q12 -9 24 0"/><rect x="146" y="27" width="40" height="16" rx="3" fill="currentColor" opacity=".25"/></svg>' +
        '<div class="frame-hud" id="dev-glasses">' + hudHtml(S.previewLang.glasses) + '</div>' +
        '<a class="btn sm" href="#brille-' + S.previewLang.glasses + '">' + icon('expand') + 'Brillen-Ansicht öffnen</a>' +
        '<p class="small muted">Für Industriebrillen mit Browser oder Begleit-App. Schwarz bleibt auf dem Brillenglas durchsichtig; nur Text und Zeichen leuchten.</p></div>';
    } else {
      var last = S.feed[0];
      body = '<div class="audio-list">' + S.langs.map(function (l, i) {
        var v = E.voiceFor(l);
        var txt = last ? (last.texts[l] || ui(l).held) : '';
        return '<div class="audio-row"><span class="lang-badge">K' + (i + 1) + '</span><div><b>' + l.toUpperCase() + '</b> ' + esc(LANG[l].native) +
          '<div class="small muted">' + (v ? 'Stimme: ' + esc(v.name) + (v.localService ? ' (lokal)' : ' (online)') : 'Keine Stimme auf diesem Gerät') + '</div></div>' +
          '<button class="btn sm" data-action="speak" data-lang="' + l + '"' + (!last || !v ? ' disabled' : '') + ' aria-label="Abspielen ' + esc(lname(l)) + '">' + icon('play') + '</button></div>';
      }).join('') + '</div>' +
      '<p class="small muted" style="margin-top:10px">Im Werk: je Sprache ein Funkkanal, Empfänger per Kabel in den Kapselgehörschutz mit Audioeingang. Notfallhinweise kommen vorab eingesprochen, nie live.</p>';
    }
    el.innerHTML = '<div class="card-head"><h2>Ausgabe live</h2><span class="small muted">Vorschau aller Kanäle</span></div>' +
      '<div class="subtabs" role="tablist">' + tabs.map(function (t) {
        return '<button role="tab" aria-selected="' + (S.deviceTab === t[0]) + '" data-action="devtab" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' + body;
  }

  function langSelect(id, val) {
    return '<label class="sr-only" for="' + id + '">Sprache der Vorschau</label><select id="' + id + '" data-change="' + id + '" style="width:auto">' +
      TARGETS.map(function (l) { return '<option value="' + l + '"' + (l === val ? ' selected' : '') + '>' + l.toUpperCase() + ' · ' + esc(LANG[l].native) + '</option>'; }).join('') + '</select>';
  }

  function joinUrl(lang) {
    var h = E.state.edge.health;
    var suffix = '#join' + (lang ? '-' + lang : '');
    if (h && h.lanUrls && h.lanUrls.length) return h.lanUrls[0].replace(/\/?$/, '/') + suffix;
    if (framed) return null;
    if (/^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)) return location.href.split('#')[0] + suffix;
    return null;
  }

  function renderJoin() {
    var el = $('#ls-join'); if (!el) return;
    var url = joinUrl();
    el.innerHTML = '<div class="qr-card">' + (url ? '<div class="qr">' + qrSvg(url) + '</div>' : '<div class="qr-missing">QR-Code erscheint mit dem Edge-Server im Werks-WLAN</div>') +
      '<div><h3>Handys verbinden</h3><p class="small muted">QR-Code scannen, Sprache wählen. Ohne App, ohne Anmeldung, ohne Firmen-E-Mail.</p>' +
      (url ? '<p class="small mono" style="word-break:break-all;margin-top:6px">' + esc(url) + '</p>'
        : '<p class="small" style="margin-top:6px">' + (framed ? 'In der Online-Demo: diese Seite auf dem Handy öffnen und unter „Handy“ die Ansicht starten.' : 'Lokal testen: weiteres Fenster mit <a href="#join" target="_blank" rel="noopener">Handy-Ansicht</a> öffnen.') + '</p>') +
      '</div></div>';
  }

  // Hallen-Display
  function hallHtml() {
    var top = '<div class="hall-top"><b>' + esc(D.site.werk) + ' · ' + esc(D.site.halle) + ' · ' + esc(D.site.schicht) + '</b><span>KI-übersetzt · geprüft · ' + hhmm(Date.now()) + '</span></div>';
    var q = S.quiz && !S.quiz.closed ? quizById(S.quiz.qid) : null;
    var m = S.feed[0];
    var main;
    if (q) {
      main = '<div class="hall-main"><div class="hall-langs hall-quiz"><div class="hall-de">Verständnisfrage – bitte auf dem Handy antworten</div>' +
        ['de'].concat(S.langs).map(function (l) {
          return '<div class="hall-line"><span class="code">' + l.toUpperCase() + '</span><span class="txt" lang="' + l + '" dir="' + dirOf(l) + '">' + esc(q.q[l] || '') + '</span></div>';
        }).join('') + '</div></div>';
    } else if (m) {
      main = '<div class="hall-main"><div style="min-width:0"><div class="hall-de">' + esc(m.de) + '</div><div class="hall-langs">' +
        S.langs.map(function (l) {
          var held = !m.texts[l];
          return '<div class="hall-line' + (held ? ' held' : '') + '"><span class="code">' + l.toUpperCase() + '</span><span class="txt" lang="' + l + '" dir="' + dirOf(l) + '">' + esc(held ? ui(l).held : m.texts[l]) + '</span></div>';
        }).join('') + '</div></div><div class="hall-pictos">' + pictos(m.pictos) + '</div></div>';
    } else {
      main = '<div class="hall-idle"><div><h3>Schichtbriefing beginnt gleich</h3><p style="color:var(--display-muted)">' + S.langs.map(function (l) { return esc(LANG[l].native); }).join(' · ') + '</p></div></div>';
    }
    return '<div class="hall">' + top + main + '<div class="hall-foot"><span>Übersetzt mit KI, Sinn automatisch geprüft, Kernsätze fachlich freigegeben</span><span>Fragen? Handy: „Nicht verstanden“</span></div></div>';
  }

  // Smart-Brille
  function hudHtml(lang) {
    var q = S.quiz && !S.quiz.closed ? quizById(S.quiz.qid) : null;
    var m = S.feed[0];
    var top = '<div class="hud-top"><span>' + lang.toUpperCase() + ' · ' + esc(D.site.halle) + '</span><span>' + hhmm(Date.now()) + '</span></div>';
    var body;
    if (q) {
      body = '<div>' + esc(q.q[lang]) + '</div><div class="hud-opts">' + q.a.map(function (a, i) { return '<span>' + 'ABC'[i] + ' · ' + esc(a[lang]) + '</span>'; }).join('') + '</div>';
    } else if (m) {
      var txt = m.texts[lang];
      body = (m.pictos && m.pictos[0] ? '<span class="hud-picto">' + PIC.render(m.pictos[0], '100%') + '</span>' : '') +
        '<div' + (txt ? '' : ' class="hud-held"') + '>' + esc(txt || ui(lang).held) + '</div>';
    } else {
      body = '<div style="color:var(--hud-dim)">' + esc(ui(lang).waiting) + '</div>';
    }
    return '<div class="hud" lang="' + lang + '" dir="' + dirOf(lang) + '">' + top + body + '</div>';
  }

  // ------------------------------------------------------------------
  // Beschäftigten-Ansicht (Handy)
  // ------------------------------------------------------------------
  function passCode() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = 'P-'; for (var i = 0; i < 4; i++) c += a[Math.floor(Math.random() * a.length)]; return c; }
  function addDays(iso, days) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

  function workerHtml(w, ctx) {
    var sess = S.session;
    var sessLangs = sess && sess.langs && sess.langs.length ? sess.langs : null;
    if (!w.lang) {
      var list = sessLangs && !w.otherLangs ? sessLangs : TARGETS.concat(['de']);
      var heads = (sessLangs || ['de', 'en']).map(function (l) { return '<span lang="' + l + '" dir="' + dirOf(l) + '">' + esc(ui(l).chooseLang) + '</span>'; }).join(' · ');
      return '<div class="w"><div class="w-head"><b>' + esc(D.site.werk) + '</b><span class="small muted">' + esc(sess ? sess.title : D.site.halle) + '</span></div>' +
        '<p class="w-pick">' + heads + '</p>' +
        '<div class="w-langs big">' + list.map(function (l) {
          return '<button data-action="w-setlang" data-ctx="' + ctx + '" data-lang="' + l + '" lang="' + l + '" dir="' + dirOf(l) + '">' + esc(LANG[l].native) + '</button>';
        }).join('') + '</div>' +
        (sessLangs && !w.otherLangs ? '<button class="btn ghost sm" data-action="w-otherlangs" data-ctx="' + ctx + '">Andere Sprache · Other language</button>' : '') +
        '<p class="w-foot">' + esc(D.ui.de.privacy) + '</p></div>';
    }
    var L = w.lang, U = ui(L);
    var head = '<div class="w-head"><b>' + esc(sess ? sess.title : U.live) + '</b><button class="chip" data-action="w-chooselang" data-ctx="' + ctx + '">' + esc(LANG[L].native) + '</button></div>';

    if (w.ended) {
      var endBody;
      if (w.pass) {
        endBody = '<div class="w-pass">' + icon('check') + '<b style="font:600 1.3rem var(--font-display)">' + esc(U.passTitle) + '</b>' +
          '<div class="qr">' + qrSvg('SAFEBRIEFING-PASS:' + w.pass.code) + '</div><div class="mono" style="font-size:1.2rem">' + esc(w.pass.code) + '</div>' +
          '<div>' + esc(w.pass.name) + (w.pass.firma ? ' · ' + esc(w.pass.firma) : '') + '</div><div class="small">' + esc(U.validUntil) + ' <b>' + deDate(w.pass.until) + '</b></div>' +
          '<p class="small muted">' + esc(U.showAtGate) + '</p></div>';
      } else if (w.signed) {
        endBody = '<div class="notice ok">' + icon('check') + ' ' + esc(U.confirmed) + '</div>';
      } else {
        endBody = '<div class="w-card latest"><div class="txt">' + esc(U.ended) + '</div>' +
          '<input id="sig-name-' + ctx + '" type="text" placeholder="' + esc(U.name) + '" autocomplete="name">' +
          '<input id="sig-firma-' + ctx + '" type="text" placeholder="' + esc(U.company) + '" autocomplete="organization">' +
          '<button class="btn primary" data-action="w-sign" data-ctx="' + ctx + '">' + esc(U.confirm) + '</button></div>';
      }
      return '<div class="w" lang="' + L + '" dir="' + dirOf(L) + '">' + head + endBody + '<p class="w-foot">' + esc(U.privacy) + '</p></div>';
    }

    var q = S.quiz && !S.quiz.closed ? quizById(S.quiz.qid) : null;
    var quizHtml = '';
    if (q) {
      var ans = w.answered[S.quiz.id];
      quizHtml = ans === undefined
        ? '<div class="w-quiz"><span class="label">' + esc(U.checkTitle) + '</span><b>' + esc(q.q[L] || q.q.de) + '</b>' +
          q.a.map(function (a, i) { return '<button data-action="w-answer" data-ctx="' + ctx + '" data-i="' + i + '">' + esc(a[L] || a.de) + '</button>'; }).join('') +
          '<span class="small muted">' + esc(U.anonymous) + '</span></div>'
        : '<div class="notice ' + (ans === q.correct ? 'ok' : 'warn') + '">' + esc(ans === q.correct ? U.correct : U.wrong) + '</div>';
    }
    var sound = w.sound
      ? '<button class="chip on" data-action="w-sound" data-ctx="' + ctx + '" aria-pressed="true">' + icon('speaker') + esc(U.soundOn) + '</button>'
      : '';
    var soundBig = w.sound ? '' : '<button class="btn primary w-soundbig" data-action="w-sound" data-ctx="' + ctx + '" aria-pressed="false">' + icon('speaker') + esc(U.tapSound) + '</button>';
    var m = S.feed[0];
    var latest = '';
    if (m) {
      var txt = L === 'de' ? m.de : m.texts[L];
      var acked = w.acked[m.id];
      latest = '<div class="w-card latest' + (txt ? '' : ' held') + '">' +
        (m.pictos && m.pictos.length ? '<div class="row">' + pictos(m.pictos, '52px') + '</div>' : '') +
        '<div class="txt big">' + esc(txt || U.held) + '</div>' +
        (w.showDe && L !== 'de' ? '<div class="de" lang="de" dir="ltr">' + esc(m.de) + '</div>' : '') +
        (acked ? '<div class="w-ok">' + icon('check') + ' ' + esc(acked === 'nicht' ? U.sent : U.understood) + '</div>'
          : '<div class="w-actions">' +
            '<button class="btn ok" data-action="w-ack" data-ctx="' + ctx + '" data-id="' + m.id + '">' + icon('check') + esc(U.understood) + '</button>' +
            '<button class="btn" data-action="w-nicht" data-ctx="' + ctx + '" data-id="' + m.id + '">' + icon('q') + esc(U.question) + '</button>' +
            '<button class="btn" data-action="w-speak" data-ctx="' + ctx + '" data-id="' + m.id + '" aria-label="' + esc(U.replay) + '" title="' + esc(U.replay) + '">' + icon('speaker') + '</button>' +
          '</div>') +
        '<div class="w-meta"><span>' + hhmm(m.ts) + '</span><span>' + esc(m.kernsatzId ? U.verified : U.aiLabel) + '</span></div></div>';
    } else {
      latest = '<div class="w-card"><div class="txt muted">' + esc(U.waiting) + '</div></div>';
    }
    var older = S.feed.slice(1, 5).map(function (o) {
      var t = L === 'de' ? o.de : (o.texts[L] || U.held);
      return '<button class="w-old" data-action="w-replay" data-ctx="' + ctx + '" data-id="' + o.id + '"><span class="mono small">' + hhmm(o.ts) + '</span><span>' + esc(t) + '</span>' + icon('speaker') + '</button>';
    }).join('');
    var askA = w.askA ? '<div class="w-answer">' + esc(w.askA.text) + (w.askA.src ? '<div class="small muted" style="margin-top:4px">' + esc(U.source) + ': ' + esc(w.askA.src) + '</div>' : '') + '</div>' : '';
    return '<div class="w" lang="' + L + '" dir="' + dirOf(L) + '">' + head +
      '<div class="w-meta"><span>' + esc(D.site.werk) + '</span>' + sound + '</div>' +
      soundBig +
      (w.note ? '<div class="notice small">' + esc(w.note) + '</div>' : '') +
      quizHtml + latest +
      (older ? '<div class="w-olds">' + older + '</div>' : '') +
      '<details class="w-more"><summary>' + esc(U.more) + '</summary><div class="w-section">' +
        (L !== 'de' ? '<button class="chip" data-action="w-showde" data-ctx="' + ctx + '">' + esc(U.showGerman) + '</button>' : '') +
        '<span class="label">' + esc(U.quickTitle) + '</span><div class="w-quick">' + D.quickReplies.map(function (r) {
          return '<button data-action="w-quick" data-ctx="' + ctx + '" data-id="' + r.id + '">' + esc(r.t[L] || r.t.de) + '</button>';
        }).join('') + '</div>' +
        '<span class="label">' + esc(U.askTitle) + '</span>' +
        '<div class="row"><label class="sr-only" for="ask-' + ctx + '">' + esc(U.askTitle) + '</label><input id="ask-' + ctx + '" type="text" class="grow" style="width:auto" placeholder="' + esc(U.askPlaceholder) + '" value="' + esc(w.askQ) + '">' +
        '<button class="btn sm" data-action="w-ask" data-ctx="' + ctx + '"' + (w.askBusy ? ' disabled' : '') + '>' + esc(U.ask) + '</button></div>' +
        '<span class="small muted">' + esc(U.askHint) + '</span>' + askA +
      '</div></details>' +
      '<p class="w-foot">' + esc(U.privacy) + '</p></div>';
  }

  function wctx(ctx) { return ctx === 'preview' ? S.preview : S.worker; }

  // Fragen-Assistent: antwortet nur aus freigegebenen Inhalten
  function askLocal(lang, question) {
    var best = null;
    var pool = D.kernsaetze.map(function (k) { return { text: k.t[lang] || k.de, src: k.de }; })
      .concat(D.fremdfirmen.rules.map(function (r) { return { text: r.text[lang] || r.text.de, src: r.text.de }; }));
    pool.forEach(function (p) {
      var sc = G.similarity(question, p.text);
      if (!best || sc > best.score) best = { score: sc, text: p.text, src: p.src };
    });
    return best && best.score >= 0.2 ? { text: best.text, src: best.src } : { text: ui(lang).fallback, src: '' };
  }
  async function askClaude(lang, question) {
    var sample = E.state.claude.sample;
    var content = D.kernsaetze.map(function (k) { return '[' + k.id + '] ' + k.de; }).concat(D.fremdfirmen.rules.map(function (r) { return '[' + r.id + '] ' + r.text.de; })).join('\n');
    var prompt = 'Du bist der Fragen-Assistent einer Sicherheitsunterweisung in einem Werk. Antworte AUSSCHLIESSLICH auf Basis dieser freigegebenen Inhalte:\n' + content +
      '\n\nWenn die Frage damit nicht sicher beantwortet werden kann, antworte genau mit: "' + ui(lang).fallback + '".\n' +
      'Antworte in der Sprache "' + lang + '" (' + lname(lang) + '), höchstens zwei kurze Sätze. Erfinde nichts.\n' +
      'Gib nur JSON zurück: {"answer":"…","source":"<id oder leer>","question_de":"<Frage auf Deutsch>"}\n\nFrage: """' + question + '"""';
    var r = await sample.json(prompt, { modelTier: 'quick' });
    var src = '';
    if (r && r.source) {
      var k = D.kernsaetze.filter(function (x) { return x.id === r.source; })[0];
      var f = D.fremdfirmen.rules.filter(function (x) { return x.id === r.source; })[0];
      src = k ? k.de : f ? f.text.de : '';
    }
    return { text: String(r && r.answer || ui(lang).fallback).slice(0, 600), src: src, de: String(r && r.question_de || '').slice(0, 300) };
  }

  // ------------------------------------------------------------------
  // Aktionen
  // ------------------------------------------------------------------
  var mic = null;
  var ACTIONS = {
    'toggle-lang': function (el) {
      var l = el.dataset.lang, i = S.langs.indexOf(l);
      if (i >= 0) S.langs.splice(i, 1); else S.langs.push(l);
      S.langs.sort(function (a, b) { return TARGETS.indexOf(a) - TARGETS.indexOf(b); });
      persist(); renderSession(); renderDevices();
    },
    translate: function () { var ta = $('#say'); if (ta) runCheck(ta.value); },
    kernsatz: function (el) {
      var k = D.kernsaetze.filter(function (x) { return x.id === el.dataset.id; })[0];
      var ta = $('#say'); if (ta && k) { ta.value = k.de; updateCount(); }
      runCheck(k ? k.de : '', { kernsatzId: el.dataset.id });
    },
    scenario: function (el) {
      var s = D.scenarios.filter(function (x) { return x.id === el.dataset.id; })[0];
      var ta = $('#say'); if (ta && s) { ta.value = s.de; updateCount(); }
      runCheck(s ? s.de : '', { scenarioId: el.dataset.id });
    },
    libtab: function (el) { S.libTab = el.dataset.tab; renderComposer(); },
    devtab: function (el) { S.deviceTab = el.dataset.tab; renderDevices(); },
    confirm: function (el) { if (S.draft) { S.draft.confirmed[el.dataset.lang] = el.checked; renderCheck(); } },
    release: function () { release(false); },
    'release-ok': function () { release(true); },
    discard: function () { S.draft = null; S.error = null; renderCheck(); },
    rephrase: function () {
      var ta = $('#say'); if (ta && S.draft) { ta.value = S.draft.source; updateCount(); ta.focus(); }
      S.draft = null; renderCheck();
    },
    'false-alarm': function () {
      var d = S.draft; if (!d) return;
      d.langs.forEach(function (l) {
        var a = d.analysis.perLang[l];
        if (a.status !== 'green') S.findings.unshift({ ts: Date.now(), source: d.source, lang: l, translation: d.results[l].text, back: d.results[l].back, engine: d.engine, problems: a.checks.filter(function (c) { return c.level === 'block' || c.level === 'warn'; }).map(function (c) { return c.title + ': ' + c.detail; }), state: 'Fehlalarm gemeldet' });
      });
      persist();
      S.flash = 'An die Sifa gemeldet (Glossar → Lernschleife).';
      renderCheck();
    },
    'close-session': closeSession,
    'quiz-start': function () { var s = $('#quiz-sel'); startQuiz(s ? s.value : D.quiz[0].id); },
    'quiz-end': function () { if (S.quiz) BUS.publish('briefing.quizend', { id: S.quiz.id }); },
    'quiz-new': function () { S.quiz = null; renderQuiz(); renderDevices(); },
    speak: function (el) {
      var m = S.feed[0]; if (!m) return;
      var l = el.dataset.lang;
      E.speak(m.texts[l] || ui(l).held, l);
    },
    mic: async function (el) {
      if (mic) { mic.stop(); mic = null; el.classList.remove('rec'); el.innerHTML = icon('mic') + 'Sprechen'; return; }
      var ta = $('#say');
      try {
        mic = await E.listen(function (text, fin) {
          if (ta) { ta.value = text.slice(0, 280); updateCount(); }
          if (fin && mic && mic.mode === 'browser') { mic = null; el.classList.remove('rec'); el.innerHTML = icon('mic') + 'Sprechen'; }
        }, function (err) { S.error = { msg: err }; mic = null; renderCheck(); el.classList.remove('rec'); el.innerHTML = icon('mic') + 'Sprechen'; });
        el.classList.add('rec'); el.innerHTML = icon('mic') + 'Stopp';
      } catch (e) { S.error = { msg: e.message || 'Mikrofon nicht verfügbar.' }; renderCheck(); }
    },
    // Beschäftigte
    'w-setlang': function (el) {
      var w = wctx(el.dataset.ctx); w.lang = el.dataset.lang;
      if (el.dataset.ctx !== 'preview') { persist(); BUS.publish('worker.join', { device: BUS.tabId, lang: w.lang }); }
      else S.preview.lang = w.lang;
      refreshWorker(el.dataset.ctx);
    },
    'w-chooselang': function (el) { wctx(el.dataset.ctx).lang = null; refreshWorker(el.dataset.ctx); },
    'w-otherlangs': function (el) { wctx(el.dataset.ctx).otherLangs = true; refreshWorker(el.dataset.ctx); },
    'w-sound': function (el) {
      var w = wctx(el.dataset.ctx);
      w.sound = !w.sound;
      if (w.sound) {
        // Erstes Vorlesen direkt nach dem Tippen – danach dürfen neue Anweisungen automatisch vorgelesen werden
        var m = S.feed[0];
        var r = E.speak(m ? (w.lang === 'de' ? m.de : (m.texts[w.lang] || ui(w.lang).held)) : ui(w.lang).soundOn, w.lang);
        if (m) w.spoken[m.id] = 1;
        if (!r.ok) w.note = r.reason;
      } else if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignorieren */ } }
      refreshWorker(el.dataset.ctx); w.note = '';
    },
    'w-replay': function (el) {
      var w = wctx(el.dataset.ctx);
      var m = S.feed.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!m) return;
      var r = E.speak(w.lang === 'de' ? m.de : (m.texts[w.lang] || ui(w.lang).held), w.lang);
      if (!r.ok) { w.note = r.reason; refreshWorker(el.dataset.ctx); w.note = ''; }
    },
    'w-showde': function (el) { var w = wctx(el.dataset.ctx); w.showDe = !w.showDe; refreshWorker(el.dataset.ctx); },
    'w-ack': function (el) {
      var w = wctx(el.dataset.ctx); w.acked[el.dataset.id] = 'ok';
      BUS.publish('worker.ack', { msgId: el.dataset.id, lang: w.lang });
      refreshWorker(el.dataset.ctx);
    },
    'w-nicht': function (el) {
      var w = wctx(el.dataset.ctx); w.acked[el.dataset.id] = 'nicht';
      var m = S.feed.filter(function (x) { return x.id === el.dataset.id; })[0];
      BUS.publish('worker.feedback', { lang: w.lang, kind: 'nicht', msgId: el.dataset.id, text: ui(w.lang).question, de: 'Nicht verstanden: „' + (m ? m.de : '') + '“' });
      refreshWorker(el.dataset.ctx);
    },
    'w-speak': function (el) {
      var w = wctx(el.dataset.ctx);
      var m = S.feed.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!m) return;
      var r = E.speak(w.lang === 'de' ? m.de : (m.texts[w.lang] || ui(w.lang).held), w.lang);
      if (!r.ok) { w.note = r.reason; refreshWorker(el.dataset.ctx); w.note = ''; }
    },
    'w-quick': function (el) {
      var w = wctx(el.dataset.ctx);
      var r = D.quickReplies.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!r) return;
      BUS.publish('worker.feedback', { lang: w.lang, kind: 'quick', id: r.id, text: r.t[w.lang], de: r.t.de, msgId: S.feed[0] ? S.feed[0].id : null });
      w.note = ui(w.lang).sent; refreshWorker(el.dataset.ctx); w.note = '';
    },
    'w-answer': function (el) {
      var w = wctx(el.dataset.ctx); if (!S.quiz) return;
      var q = quizById(S.quiz.qid);
      var i = Number(el.dataset.i);
      w.answered[S.quiz.id] = i;
      BUS.publish('worker.answer', { quizId: S.quiz.id, correct: i === q.correct, lang: w.lang });
      refreshWorker(el.dataset.ctx);
    },
    'w-ask': async function (el) {
      var ctx = el.dataset.ctx, w = wctx(ctx);
      var inp = $('#ask-' + ctx); var qtext = inp ? inp.value.trim().slice(0, 300) : '';
      if (!qtext) return;
      w.askQ = qtext; w.askBusy = true; refreshWorker(ctx);
      var ans;
      try { ans = E.state.claude.sample ? await askClaude(w.lang, qtext) : askLocal(w.lang, qtext); }
      catch (e) { ans = askLocal(w.lang, qtext); }
      w.askA = ans; w.askBusy = false;
      BUS.publish('worker.feedback', { lang: w.lang, kind: 'frage', text: qtext, de: ans.de ? 'Frage: ' + ans.de : 'Frage (' + lname(w.lang) + ')' });
      refreshWorker(ctx);
    },
    'w-sign': function (el) {
      var ctx = el.dataset.ctx, w = wctx(ctx);
      var n = $('#sig-name-' + ctx), f = $('#sig-firma-' + ctx);
      var name = n ? n.value.trim() : '';
      if (!name) { if (n) n.focus(); return; }
      w.signed = true;
      var firma = f ? f.value.trim() : '';
      var payload = { device: ctx === 'preview' ? null : BUS.tabId, lang: w.lang, signed: true, name: name.slice(0, 80), firma: firma.slice(0, 80) };
      if (S.session && S.session.type === 'fremdfirma') {
        w.pass = { code: passCode(), name: payload.name, firma: payload.firma, until: addDays(today(), 365) };
        payload.passCode = w.pass.code; payload.until = w.pass.until;
      }
      BUS.publish('worker.join', payload);
      refreshWorker(ctx);
    }
  };
  SB.ACTIONS = ACTIONS;

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.action === 'confirm') return; // via click
    var id = el.dataset && el.dataset.change;
    if (id === 'prev-phone') { S.preview = newWorker(el.value); renderDevices(); }
    else if (id === 'prev-glasses') { S.previewLang.glasses = el.value; renderDevices(); }
    else if (SB.onChange) SB.onChange(el);
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'say') updateCount();
    if (e.target.id === 'topic') S.topic = e.target.value.slice(0, 120);
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.id === 'say' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runCheck(e.target.value); }
    if (e.target.id && e.target.id.indexOf('ask-') === 0 && e.key === 'Enter') { e.preventDefault(); var b = e.target.parentNode.querySelector('[data-action="w-ask"]'); if (b) b.click(); }
  });

  function refreshWorker(ctx) {
    if (ctx === 'preview') { var p = $('#dev-phone'); if (p) p.innerHTML = workerHtml(S.preview, 'preview'); }
    else { var k = $('#kiosk-worker'); if (k) k.innerHTML = workerHtml(S.worker, 'kiosk'); }
  }

  // Teil-Aktualisierung je nach Ereignis
  function refresh(what) {
    if (S.route === 'leitstand') {
      if (what === 'check' || what === 'all') renderCheck();
      if (what === 'feed' || what === 'acks' || what === 'all') { renderFeed(); renderRueck(); }
      if (what === 'rueck' || what === 'all') renderRueck();
      if (what === 'quiz' || what === 'all') renderQuiz();
      if (what === 'feed' || what === 'quiz' || what === 'all') {
        var d = $('#dev-display'); if (d) d.innerHTML = hallHtml();
        var g = $('#dev-glasses'); if (g) g.innerHTML = hudHtml(S.previewLang.glasses);
        refreshWorker('preview');
        if (S.deviceTab === 'audio') renderDevices();
      }
      if (what === 'session' || what === 'feed' || what === 'all') renderSession();
    } else if (S.route === 'display') {
      var kd = $('#kiosk-display'); if (kd) kd.innerHTML = hallHtml();
    } else if (S.route === 'brille') {
      var kh = $('#kiosk-hud'); if (kh) kh.innerHTML = hudHtml(S.routeLang || S.previewLang.glasses);
    } else if (S.route === 'join') {
      if (what !== 'acks' && what !== 'rueck') refreshWorker('kiosk');
    } else if (S.route === 'start') {
      if (SB.refreshSimple) SB.refreshSimple(what);
    } else if (SB.refreshAdmin) {
      SB.refreshAdmin(what);
    }
  }
  SB.refresh = refresh;

  // ------------------------------------------------------------------
  // Router
  // ------------------------------------------------------------------
  var ADMIN = ['start', 'leitstand', 'unterweisungen', 'fremdfirmen', 'glossar', 'nachweise', 'cockpit', 'system'];
  function parseRoute() {
    var h = (location.hash || '').replace(/^#/, '');
    var m = h.match(/^(start|leitstand|unterweisungen|fremdfirmen|glossar|nachweise|cockpit|system|display|join|brille|pforte)(?:-([a-z]{2}))?$/);
    return m ? { name: m[1], lang: m[2] && LANG[m[2]] ? m[2] : null } : { name: 'start', lang: null };
  }

  function render() {
    var r = parseRoute();
    S.route = r.name; S.routeLang = r.lang;
    var root = $('#app');
    var kiosk = ADMIN.indexOf(r.name) < 0;
    document.body.classList.toggle('kiosk', kiosk);
    document.body.classList.toggle('kiosk-light', r.name === 'join' || r.name === 'pforte');
    document.body.classList.toggle('simple-mode', r.name === 'start');
    document.querySelectorAll('nav.tabs-main a').forEach(function (a) {
      if (a.getAttribute('href') === '#' + r.name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var back = '<a class="btn sm kiosk-back no-print" href="#start">' + icon('back') + 'Zurück</a>';
    var backFoot = '<p class="kiosk-foot no-print"><a href="#start">' + icon('back') + 'Zurück zum Start (Demo)</a></p>';
    if (r.name === 'display') {
      root.innerHTML = '<div class="kiosk-display" id="kiosk-display">' + hallHtml() + '</div>' + back;
    } else if (r.name === 'brille') {
      root.innerHTML = '<div class="kiosk-hud" id="kiosk-hud">' + hudHtml(r.lang || S.previewLang.glasses) + '</div>' + back;
    } else if (r.name === 'join') {
      if (r.lang && S.worker.lang !== r.lang) { S.worker.lang = r.lang; persist(); }
      root.innerHTML = '<div class="kiosk-phone"><div id="kiosk-worker">' + workerHtml(S.worker, 'kiosk') + '</div>' + backFoot + '</div>';
      if (S.worker.lang) BUS.publish('worker.join', { device: BUS.tabId, lang: S.worker.lang });
    } else if (r.name === 'pforte') {
      if (r.lang) S.induction.lang = r.lang;
      root.innerHTML = '<div class="kiosk-phone"><div id="kiosk-induction"></div>' + backFoot + '</div>';
      if (SB.renderInduction) SB.renderInduction($('#kiosk-induction'));
    } else if (r.name === 'start') {
      root.innerHTML = '<main class="simple-page" id="page"></main>';
      if (SB.views && SB.views.start) SB.views.start($('#page'));
    } else if (r.name === 'leitstand') {
      root.innerHTML = '<main class="page" id="page"></main>';
      viewLeitstand($('#page'));
    } else {
      root.innerHTML = '<main class="page" id="page"></main>';
      if (SB.views && SB.views[r.name]) SB.views[r.name]($('#page'));
    }
    window.scrollTo(0, 0);
  }
  SB.render = render;

  function renderModeChip() {
    var el = $('#mode-chip'); if (!el) return;
    var st = E.state;
    var txt, cls;
    if (st.edge.available) { txt = 'Edge-Server im Werk · Daten bleiben lokal'; cls = 'on'; }
    else if (st.claude.sample) { txt = 'Online-Demo · Live-Übersetzung über Claude (Cloud)'; cls = 'demo'; }
    else { txt = 'Demo im Browser · keine Daten verlassen das Gerät'; cls = 'demo'; }
    el.innerHTML = '<span class="dot ' + cls + '"></span>' + esc(txt);
  }
  SB.renderModeChip = renderModeChip;

  // Hilfen für admin.js
  SB.h = { esc: esc, icon: icon, qrSvg: qrSvg, pictos: pictos, hhmm: hhmm, hhmmss: hhmmss, deDate: deDate, today: today, ago: ago, lname: lname, ui: ui, dirOf: dirOf, plural: plural, persist: persist, framed: framed, LANG: LANG, TARGETS: TARGETS, joinUrl: joinUrl, statusPill: statusPill,
    quizById: quizById, itemById: itemById, sendMessage: sendMessage, startQuiz: startQuiz, deviceCount: deviceCount, sessionRecord: sessionRecord,
    resetLive: resetLive, recordBlocked: recordBlocked, simDevicesFor: simDevicesFor, refreshWorker: refreshWorker, hallHtml: hallHtml, newWorker: newWorker };

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  window.addEventListener('hashchange', render);
  setInterval(function () {
    if (S.route === 'display') { var kd = $('#kiosk-display'); if (kd) kd.innerHTML = hallHtml(); }
  }, 30000);
  if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = function () { if (S.route === 'leitstand' && S.deviceTab === 'audio') renderDevices(); };

  document.addEventListener('DOMContentLoaded', function () {
    render();
    renderModeChip();
    E.detectEdge().then(function (ok) {
      if (ok) { BUS.connectEdge(); renderModeChip(); if (S.route === 'leitstand') { renderJoin(); renderSession(); renderComposer(); } }
    });
    E.detectBrowser().then(function () { if (S.route === 'leitstand') renderSession(); if (S.route === 'system') render(); });
    E.detectClaude().then(function (c) {
      if (c && c.room) BUS.connectRoom(c.room);
      renderModeChip();
      if (S.route === 'leitstand') renderSession();
      if (S.route === 'join' && S.worker.lang) BUS.publish('worker.join', { device: BUS.tabId, lang: S.worker.lang });
    });
  });
})();

/*
 * SafeBriefing – Start-Modus
 *
 * Drei Schritte, ohne Erklärung bedienbar:
 *   1. Was steht an?        – vorbereitete Unterweisung wählen
 *   2. Wer steht vor Ihnen? – Sprachen antippen
 *   3. Los                  – vorbereitete Punkte senden oder frei sprechen
 * Alles Weitere (Prüfdetails, Glossar, Einstellungen) liegt in der Verwaltung.
 */
(function () {
  'use strict';

  var D = window.SB_DATA, G = window.SBGuardrail, E = window.SB_ENGINES, BUS = window.SB_BUS, PIC = window.SB_PICTOS;
  var SB = window.SB, S = SB.S, H = SB.h;
  var esc = H.esc, icon = H.icon;
  var X = S.simple;
  var mic = null, micDone = false;

  function $(sel) { return document.querySelector(sel); }
  function prog() { return S.programs.filter(function (p) { return p.id === X.programId; })[0] || null; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  SB.sessionInfo = function () {
    var p = prog();
    return { id: X.sessionId, title: p ? p.title : 'Unterweisung', type: p ? p.type : 'briefing', langs: X.langs.slice() };
  };

  SB.views = SB.views || {};
  SB.views.start = function (root) {
    root.innerHTML = '<div class="simple" id="simple"></div>';
    draw();
  };

  function steps(n) {
    return '<ol class="steps" aria-label="Schritte">' + ['Unterweisung', 'Sprachen', 'Los'].map(function (t, i) {
      return '<li class="' + (i + 1 === n ? 'on' : (i + 1 < n ? 'done' : '')) + '"' + (i + 1 === n ? ' aria-current="step"' : '') + '>' + (i + 1) + ' · ' + t + '</li>';
    }).join('') + '</ol>';
  }

  function draw() {
    var el = $('#simple'); if (!el) return;
    if (X.step === 'langs' && prog()) el.innerHTML = langsHtml();
    else if (X.step === 'live' && prog()) el.innerHTML = liveHtml();
    else if (X.step === 'done' && X.summary) el.innerHTML = doneHtml();
    else { X.step = 'pick'; el.innerHTML = pickHtml(); }
  }

  // ---------------- 1. Was steht an? ----------------
  function pickHtml() {
    return steps(1) + '<h1>Was steht an?</h1>' +
      '<div class="tiles">' + S.programs.map(function (p) {
        var n = p.items.length;
        return '<button class="tile" data-action="s-program" data-id="' + esc(p.id) + '">' + PIC.render(p.picto, '52px') +
          '<b>' + esc(p.title) + '</b><span>' + esc(p.sub || '') + '</span>' +
          '<span class="meta">' + (n ? plural(n, 'vorbereiteter Punkt', 'vorbereitete Punkte') : 'Frei sprechen') + (p.quiz ? ' · mit Verständnisfrage' : '') + '</span></button>';
      }).join('') + '</div>' +
      '<p class="simple-foot"><a href="#join">' + icon('speaker') + 'Ich nehme teil – Handy-Ansicht öffnen</a></p>';
  }

  // ---------------- 2. Wer steht vor Ihnen? ----------------
  function langsHtml() {
    var p = prog();
    return steps(2) + '<p class="crumb">' + esc(p.title) + '</p><h1>Wer steht vor Ihnen?</h1>' +
      '<p class="lead">Sprachen antippen – mehrere sind möglich.</p>' +
      '<div class="ltiles">' + H.TARGETS.map(function (l) {
        var on = X.langs.indexOf(l) >= 0;
        return '<button class="ltile' + (on ? ' on' : '') + '" data-action="s-lang" data-lang="' + l + '" aria-pressed="' + on + '">' +
          '<span class="nat" lang="' + l + '" dir="' + H.dirOf(l) + '">' + esc(H.LANG[l].native) + '</span><span class="de">' + esc(H.LANG[l].name) + '</span>' +
          (on ? '<span class="tick">' + icon('check') + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="simple-actions"><button class="btn ghost" data-action="s-back">' + icon('back') + 'Zurück</button>' +
      '<button class="btn primary xl" data-action="s-go"' + (X.langs.length ? '' : ' disabled') + '>Los geht’s' + (X.langs.length ? ' · ' + plural(X.langs.length, 'Sprache', 'Sprachen') : '') + '</button></div>';
  }

  // ---------------- 3. Los ----------------
  function liveHtml() {
    var p = prog();
    return '<div class="live">' +
      '<div class="live-head"><div class="grow"><span class="label">' + esc(p.title) + '</span><div class="chip-group">' + X.langs.map(function (l) {
        return '<span class="chip on"><span class="code">' + l.toUpperCase() + '</span><span lang="' + l + '" dir="' + H.dirOf(l) + '">' + esc(H.LANG[l].native) + '</span></span>';
      }).join('') + '</div></div>' +
      '<div class="row"><button class="btn sm' + (X.showQr ? ' on' : '') + '" data-action="s-qr" aria-expanded="' + !!X.showQr + '">' + icon('expand') + 'Handys verbinden</button>' +
      '<button class="btn sm' + (X.speakHere ? ' on' : '') + '" data-action="s-speakhere" aria-pressed="' + X.speakHere + '" title="Gesendete Anweisungen auf diesem Gerät in allen Sprachen vorlesen">' + icon('speaker') + (X.speakHere ? 'Vorlesen an' : 'Vorlesen aus') + '</button></div></div>' +
      '<div id="s-qr-box">' + (X.showQr ? qrHtml() : '') + '</div>' +
      '<section class="card s-now" id="s-now" aria-live="polite">' + nowHtml() + '</section>' +
      '<div id="s-decision" aria-live="polite">' + decisionHtml() + '</div>' +
      (p.items.length ? '<section class="card s-next" id="s-next">' + nextHtml() + '</section>' : '') +
      '<div id="s-type">' + typeHtml() + '</div>' +
      '</div>' +
      '<div class="live-bar" id="s-bar">' + barHtml() + '</div>';
  }

  function barHtml() {
    var quizRunning = S.quiz && !S.quiz.closed;
    return '<button class="btn" data-action="' + (quizRunning ? 's-quizend' : 's-quiz') + '">' + icon('q') + (quizRunning ? 'Frage beenden' : 'Frage') + '</button>' +
      '<button class="mic-big' + (X.listening ? ' rec' : '') + '" data-action="s-mic" aria-label="' + (X.listening ? 'Aufnahme beenden und senden' : 'Sprechen') + '">' + icon('mic') + '<span>' + (X.listening ? 'Fertig' : 'Sprechen') + '</span></button>' +
      '<button class="btn" data-action="s-end">' + icon('doc') + 'Beenden</button>';
  }

  function qrHtml() {
    var url = H.joinUrl();
    return '<section class="card s-qr"><div class="qr-card">' + (url ? '<div class="qr big">' + H.qrSvg(url) + '</div>' : '') +
      '<div><h3>Handys verbinden</h3><p class="small">' +
      (url ? 'QR-Code scannen, Sprache antippen, „Vorlesen an“. Ohne App, ohne Anmeldung.'
        : (H.framed ? 'Teilnehmende öffnen diesen Link auf ihrem Handy und tippen auf „Ich nehme teil“.' : 'Im Werks-WLAN erscheint hier der QR-Code. Zum Ausprobieren: Handy-Ansicht in einem zweiten Fenster öffnen.')) + '</p>' +
      '<div class="row" style="margin-top:8px"><a class="btn sm" href="#join">' + icon('speaker') + 'Handy-Ansicht ansehen</a><a class="btn sm" href="#display">' + icon('expand') + 'Beamer-Ansicht</a></div></div></div></section>';
  }

  function nowHtml() {
    var q = S.quiz && !S.quiz.closed ? H.quizById(S.quiz.qid) : null;
    var dc = H.deviceCount(), expected = dc.real + dc.sim;
    if (q) {
      var t = S.quiz.correct + S.quiz.wrong;
      return '<span class="label">Verständnisfrage läuft – alle sehen sie in ihrer Sprache</span><p class="now-de">' + esc(q.q.de) + '</p>' +
        '<div class="qbar"><span class="ok">' + S.quiz.correct + ' richtig</span><span class="bad">' + S.quiz.wrong + ' falsch</span><span class="muted">' + Math.max(0, expected - t) + ' offen</span></div>' +
        (t && S.quiz.wrong / t > 0.2 ? '<p class="small" style="color:var(--bad)">Mehr als jede fünfte Antwort falsch: Punkt wiederholen und vorführen lassen.</p>' : '');
    }
    var m = S.feed[0];
    if (!m) {
      var p = prog();
      return '<span class="label">Bereit</span><p class="now-de muted">' +
        (p && p.items.length ? 'Tippen Sie auf „Senden“ für den ersten Punkt – oder sprechen Sie frei.' : 'Tippen Sie unten auf „Sprechen“ und sagen Sie Ihre Anweisung.') + '</p>';
    }
    var acks = (S.acks[m.id] || 0) + (S.simAcks[m.id] || 0), nu = S.notUnderstood[m.id] || 0;
    return '<span class="label">Gesendet · ' + H.hhmm(m.ts) + (m.kernsatzId ? ' · geprüfter Text' : ' · Sinn geprüft') + '</span>' +
      '<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><p class="now-de grow">' + esc(m.de) + '</p>' + H.pictos(m.pictos, '40px') + '</div>' +
      '<div class="now-langs">' + X.langs.map(function (l) {
        return '<div class="now-line"><span class="lang-badge">' + l.toUpperCase() + '</span><span lang="' + l + '" dir="' + H.dirOf(l) + '"' + (m.texts[l] ? '' : ' class="held"') + '>' +
          esc(m.texts[l] || 'zurückgehalten – bitte mündlich erklären') + '</span></div>';
      }).join('') + '</div>' +
      '<div class="now-stats"><span class="ok">' + icon('check') + acks + ' verstanden</span>' +
      (nu ? '<span class="bad">' + icon('q') + nu + '× nicht verstanden – bitte wiederholen oder zeigen</span>' : '') +
      (S.settings.sim ? '<span class="muted small">Demo: inkl. simulierter Handys</span>' : '') + '</div>' +
      (X.voiceNote ? '<p class="small muted" style="margin-top:6px">' + esc(X.voiceNote) + '</p>' : '');
  }

  function nextHtml() {
    var p = prog(), n = p.items.length;
    if (X.idx >= n) {
      var askQuiz = p.quiz && !X.quizAsked;
      return '<span class="label">Alle ' + n + ' Punkte gesendet</span><p class="next-de">' + (askQuiz ? 'Jetzt kurz prüfen, ob es angekommen ist.' : 'Fertig. Unterweisung beenden, der Nachweis entsteht automatisch.') + '</p>' +
        '<div class="row">' + (askQuiz ? '<button class="btn primary xl grow" data-action="s-quiz">' + icon('q') + 'Verständnisfrage stellen</button>' : '<button class="btn primary xl grow" data-action="s-end">' + icon('doc') + 'Beenden und Nachweis</button>') + '</div>' + dots(p);
    }
    var it = H.itemById(p.items[X.idx]);
    if (!it) return '';
    return '<div class="row"><span class="label grow">Nächster Punkt ' + (X.idx + 1) + ' von ' + n + '</span><span class="pill green">fachlich geprüft</span></div>' +
      '<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><p class="next-de grow">' + esc(it.de) + '</p>' + H.pictos(it.pictos, '44px') + '</div>' +
      '<div class="row"><button class="btn primary xl grow" data-action="s-send">' + icon('send') + 'Senden</button><button class="btn ghost" data-action="s-skip">Überspringen</button></div>' + dots(p);
  }

  function dots(p) {
    return '<div class="dots" aria-hidden="true">' + p.items.map(function (x, i) { return '<i class="' + (i < X.idx ? 'done' : i === X.idx ? 'cur' : '') + '"></i>'; }).join('') + '</div>';
  }

  function decisionHtml() {
    if (X.listening) return '<section class="card s-busy"><div class="busy"><span class="rec-dot"></span>Ich höre zu … zum Senden auf „Fertig“ tippen.</div>' + (X.heard ? '<p class="heard">„' + esc(X.heard) + '“</p>' : '') + '</section>';
    if (X.busy) return '<section class="card s-busy"><div class="busy"><span class="spinner"></span>Übersetze in ' + plural(X.langs.length, 'Sprache', 'Sprachen') + ' und prüfe den Sinn …</div>' + (X.heard ? '<p class="heard">„' + esc(X.heard) + '“</p>' : '') + '</section>';
    if (X.error) {
      return '<section class="card s-dec bad"><strong>' + esc(X.error.title || 'Nicht gesendet') + '</strong><p>' + esc(X.error.msg) + '</p>' +
        (X.error.suggestion ? '<div class="row"><span class="grow small">Passender geprüfter Satz: <b>' + esc(X.error.suggestion.de) + '</b></span><button class="btn sm" data-action="s-sendk" data-id="' + esc(X.error.suggestion.id) + '">Diesen senden</button></div>' : '') +
        '<div class="row" style="margin-top:8px"><button class="btn ghost sm" data-action="s-dismiss">Schließen</button></div></section>';
    }
    var pd = X.pending;
    if (!pd) return X.note ? '<div class="notice ok s-note">' + icon('check') + ' ' + esc(X.note) + '</div>' : '';
    var a = pd.analysis;
    var red = X.langs.filter(function (l) { return a.perLang[l].status === 'red'; });
    var yellow = X.langs.filter(function (l) { return a.perLang[l].status === 'yellow'; });
    var okCount = X.langs.length - red.length;
    if (red.length) {
      var block = a.perLang[red[0]].checks.filter(function (c) { return c.level === 'block'; })[0];
      return '<section class="card s-dec bad"><strong>Nicht gesendet: ' + esc(block.title) + ' (' + red.map(H.lname).join(', ') + ')</strong>' +
        '<p>Sie sagten: „' + esc(pd.source) + '“</p><p>Zurückübersetzt: <i>„' + esc(pd.results[red[0]].back || '–') + '“</i></p>' +
        '<p class="small">Bitte anders sagen – kurz und eindeutig.</p>' +
        '<div class="row"><button class="btn primary" data-action="s-mic">' + icon('mic') + 'Neu sprechen</button>' +
        (okCount ? '<button class="btn" data-action="s-confirm">Nur an ' + plural(okCount, 'geprüfte Sprache', 'geprüfte Sprachen') + ' senden</button>' : '') +
        '<button class="btn ghost" data-action="s-dismiss">Verwerfen</button></div></section>';
    }
    var warn = a.perLang[yellow[0]].checks.filter(function (c) { return c.level === 'warn'; })[0];
    return '<section class="card s-dec warn"><strong>Kurz prüfen: Haben Sie das gemeint?</strong>' +
      '<p class="small">Sie sagten: „' + esc(pd.source) + '“ – so kommt es aus der Übersetzung zurück:</p>' +
      yellow.map(function (l) { return '<div class="now-line"><span class="lang-badge">' + l.toUpperCase() + '</span><span>„' + esc(pd.results[l].back || '–') + '“</span></div>'; }).join('') +
      (warn ? '<p class="small muted">Hinweis: ' + esc(warn.title) + (warn.detail ? ' – ' + esc(warn.detail) : '') + '</p>' : '') +
      '<div class="row"><button class="btn ok" data-action="s-confirm">' + icon('check') + 'Ja, senden</button><button class="btn" data-action="s-mic">' + icon('mic') + 'Neu sprechen</button></div></section>';
  }

  function typeHtml() {
    if (!X.typing) return '<button class="link-btn" data-action="s-typing">Lieber tippen</button>';
    return '<div class="type-row"><label class="sr-only" for="s-text">Ansage</label><input id="s-text" type="text" maxlength="280" placeholder="Ansage eingeben …" autocomplete="off" enterkeyhint="send">' +
      '<button class="btn primary" data-action="s-type-send" aria-label="Übersetzen und senden">' + icon('send') + '</button></div>' +
      '<p class="small muted" style="margin-top:6px">' + (X.micBlocked ? 'Das Mikrofon ist hier nicht freigegeben. Am Handy einfach die Mikrofon-Taste der Tastatur antippen und sprechen.' : 'Tipp am Handy: Mikrofon-Taste der Tastatur antippen und sprechen.') + '</p>';
  }

  function doneHtml() {
    var s = X.summary;
    var pc = s.quiz && s.quiz.total ? Math.round(s.quiz.correct / s.quiz.total * 100) : null;
    return '<div class="done">' + icon('check') + '<h1>Unterweisung abgeschlossen</h1><p class="lead">' + esc(s.topic) + ' · ' + s.langs.map(H.lname).join(', ') + '</p>' +
      '<div class="kpis" style="width:100%"><div class="kpi"><b>' + (s.released || 0) + '</b><span>Anweisungen gesendet</span></div>' +
      '<div class="kpi"><b>' + s.participants + '</b><span>Teilnehmende' + (s.simulated ? ' (inkl. Demo)' : '') + '</span></div>' +
      '<div class="kpi"><b>' + (pc === null ? '–' : pc + ' %') + '</b><span>Verständnisfrage richtig</span></div>' +
      '<div class="kpi"><b>' + (s.blocked || 0) + '</b><span>Fehlübersetzungen gestoppt</span></div></div>' +
      '<p class="small muted">Die Teilnehmenden bestätigen jetzt auf dem Handy ihren Namen' + (s.type === 'fremdfirma' ? ' und erhalten ihren Einweisungs-Pass' : '') + '.</p>' +
      '<div class="simple-actions" style="width:100%"><a class="btn" href="#nachweise">' + icon('doc') + 'Nachweis ansehen</a><button class="btn primary xl" data-action="s-new">Neue Unterweisung</button></div></div>';
  }

  // Nur die veränderlichen Teile neu zeichnen – das Eingabefeld behält den Fokus
  function drawLive() {
    if (X.step !== 'live') return;
    var map = { '#s-now': nowHtml, '#s-decision': decisionHtml, '#s-bar': barHtml };
    Object.keys(map).forEach(function (sel) { var el = $(sel); if (el) el.innerHTML = map[sel](); });
    var nx = $('#s-next'); if (nx) nx.innerHTML = nextHtml();
    var qr = $('#s-qr-box'); if (qr) qr.innerHTML = X.showQr ? qrHtml() : '';
  }
  function drawType() { var t = $('#s-type'); if (t) t.innerHTML = typeHtml(); }

  SB.refreshSimple = function (what) {
    if (X.step === 'live') drawLive();
  };

  // ---------------- Senden ----------------
  function speakHere(msg) {
    X.voiceNote = '';
    if (!X.speakHere) return;
    var r = E.speakAll(X.langs.filter(function (l) { return msg.texts[l]; }).map(function (l) { return { text: msg.texts[l], lang: l }; }));
    if (r.missing && r.missing.length) X.voiceNote = 'Auf diesem Gerät fehlt eine Vorlese-Stimme für: ' + r.missing.map(H.lname).join(', ') + '. Auf den Handys der Teilnehmenden kann es trotzdem klappen.';
  }

  function sendItem(it, advance) {
    var texts = {}, held = [];
    X.langs.forEach(function (l) { if (it.t[l]) texts[l] = it.t[l]; else held.push(l); });
    var msg = H.sendMessage({ de: it.de, texts: texts, held: held, pictos: it.pictos, origin: 'kernsatz', engine: 'kernsatz', kernsatzId: it.id });
    if (advance) X.idx++;
    X.pending = null; X.error = null; X.note = '';
    speakHere(msg);
    drawLive();
  }

  function commit(pd) {
    var texts = {}, held = [];
    X.langs.forEach(function (l) { if (pd.analysis.perLang[l].status === 'red') held.push(l); else texts[l] = pd.results[l].text; });
    if (!Object.keys(texts).length) return;
    S.stats.confirmed += X.langs.filter(function (l) { return pd.analysis.perLang[l].status === 'yellow'; }).length;
    var msg = H.sendMessage({ de: pd.source, texts: texts, held: held, pictos: pd.pictos, origin: pd.origin, engine: pd.engine, kernsatzId: pd.kernsatzId });
    X.pending = null;
    X.note = held.length ? 'Gesendet. ' + plural(held.length, 'Sprache wird', 'Sprachen werden') + ' zurückgehalten.' : 'Gesendet – Sinn in allen Sprachen geprüft.';
    speakHere(msg);
    drawLive();
    var shown = X.note;
    setTimeout(function () { if (X.note === shown) { X.note = ''; drawLive(); } }, 5000);
  }

  async function process(text) {
    text = String(text || '').trim().slice(0, 280);
    if (!text) return;
    X.busy = true; X.error = null; X.pending = null; X.note = ''; X.heard = text;
    drawLive();
    try {
      var r = await E.translate(text, X.langs, { engine: S.settings.engine, glossary: S.glossary });
      var results = {};
      X.langs.forEach(function (l) { results[l] = Object.assign({ origin: r.origin }, r.results[l] || { text: '', back: '' }); });
      var source = r.kernsatz ? r.kernsatz.de : (r.scenario ? r.scenario.de : text);
      var analysis = G.analyzeAll({
        source: source, results: results, glossary: S.glossary, origin: r.origin,
        options: { emergencyPolicy: S.settings.emergencyPolicy, minSimilarity: S.settings.minSimilarity }
      });
      var pics = r.kernsatz ? r.kernsatz.pictos.slice() : [];
      G.glossaryHits(source, S.glossary).forEach(function (g) { if (g.picto && pics.indexOf(g.picto) < 0) pics.push(g.picto); });
      var pd = { source: source, results: results, analysis: analysis, pictos: pics.slice(0, 3), engine: r.engine, origin: r.origin, kernsatzId: r.kernsatz ? r.kernsatz.id : null };
      X.busy = false; X.heard = '';
      if (analysis.status === 'green') { commit(pd); return; }
      X.langs.forEach(function (l) {
        if (analysis.perLang[l].status === 'red') { S.stats.blocked++; H.recordBlocked(source, l, results[l], analysis.perLang[l], r.engine); }
      });
      H.persist();
      X.pending = pd;
    } catch (e) {
      X.busy = false; X.heard = '';
      X.error = e && e.code === 'no_engine'
        ? { title: 'Freies Sprechen ist hier nicht eingerichtet', msg: 'Dafür braucht es eine Übersetzung im Hintergrund (lokal im Werk oder in der Online-Demo). Die vorbereiteten Punkte funktionieren immer.', suggestion: e.suggestion || null }
        : { title: 'Nicht gesendet', msg: (e && e.message) || 'Übersetzung fehlgeschlagen. Bitte noch einmal versuchen.' };
    }
    drawLive();
  }

  function openTyping(blocked) {
    X.typing = true; X.micBlocked = !!blocked;
    drawType();
    var inp = $('#s-text'); if (inp) inp.focus();
  }

  async function toggleMic() {
    if (X.listening && mic) { mic.stop(); if (mic.mode === 'browser') { /* Ergebnis kommt über onresult */ } return; }
    if (H.framed || !E.sttMode()) { openTyping(true); return; }
    X.pending = null; X.error = null; X.heard = ''; micDone = false;
    try {
      mic = await E.listen(function (text, fin) {
        X.heard = text;
        if (fin && !micDone) {
          micDone = true; X.listening = false; mic = null;
          process(text);
        } else drawLive();
      }, function () {
        X.listening = false; mic = null; drawLive(); openTyping(true);
      });
      X.listening = true;
      drawLive();
    } catch (e) { X.listening = false; mic = null; drawLive(); openTyping(true); }
  }

  // ---------------- Aktionen ----------------
  Object.assign(SB.ACTIONS, {
    's-program': function (el) { X.programId = el.dataset.id; X.step = 'langs'; draw(); window.scrollTo(0, 0); },
    's-lang': function (el) {
      var l = el.dataset.lang, i = X.langs.indexOf(l);
      if (i >= 0) X.langs.splice(i, 1); else X.langs.push(l);
      X.langs.sort(function (a, b) { return H.TARGETS.indexOf(a) - H.TARGETS.indexOf(b); });
      H.persist(); draw();
    },
    's-back': function () { X.step = 'pick'; draw(); },
    's-go': function () {
      if (!X.langs.length) return;
      H.resetLive();
      S.langs = X.langs.slice();
      S.topic = prog().title;
      X.sessionId = BUS.rid(); X.idx = 0; X.pending = null; X.error = null; X.note = ''; X.quizAsked = false; X.summary = null; X.typing = false; X.showQr = false; X.voiceNote = '';
      X.step = 'live';
      H.persist();
      BUS.publish('briefing.session', SB.sessionInfo());
      draw(); window.scrollTo(0, 0);
    },
    's-send': function () {
      var p = prog(); var it = p && H.itemById(p.items[X.idx]);
      if (it) sendItem(it, true);
    },
    's-skip': function () { X.idx++; drawLive(); },
    's-sendk': function (el) { var it = H.itemById(el.dataset.id); if (it) sendItem(it, false); },
    's-speakhere': function () {
      X.speakHere = !X.speakHere;
      if (!X.speakHere && window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignorieren */ } }
      draw();
    },
    's-qr': function () { X.showQr = !X.showQr; draw(); },
    's-typing': function () { openTyping(false); },
    's-type-send': function () { var inp = $('#s-text'); if (inp && inp.value.trim()) { var v = inp.value; inp.value = ''; process(v); } },
    's-mic': function () { toggleMic(); },
    's-confirm': function () { if (X.pending) commit(X.pending); },
    's-dismiss': function () { X.pending = null; X.error = null; drawLive(); },
    's-quiz': function () {
      var p = prog();
      H.startQuiz((p && p.quiz) || 'q-stapler');
      X.quizAsked = true;
      drawLive();
    },
    's-quizend': function () { if (S.quiz) BUS.publish('briefing.quizend', { id: S.quiz.id }); drawLive(); },
    's-end': function () {
      var p = prog();
      if (mic) { try { mic.stop(); } catch (e) { /* ignorieren */ } mic = null; X.listening = false; }
      if (S.quiz && !S.quiz.closed) BUS.publish('briefing.quizend', { id: S.quiz.id });
      BUS.publish('briefing.end', { id: X.sessionId, type: p.type });
      var sess = H.sessionRecord(p.title, p.type === 'fremdfirma' ? 'fremdfirma' : 'briefing');
      S.sessions.push(sess);
      H.persist();
      S.nachweisSel = sess.id;
      X.summary = sess; X.step = 'done';
      draw(); window.scrollTo(0, 0);
    },
    's-new': function () { X.step = 'pick'; X.programId = null; X.summary = null; draw(); window.scrollTo(0, 0); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 's-text' && e.key === 'Enter') { e.preventDefault(); SB.ACTIONS['s-type-send'](); }
  });
})();

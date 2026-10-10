/*
 * SafeBriefing – Start-Modus
 *
 * Drei Schritte, ohne Erklärung bedienbar:
 *   1. Was steht an?        – vorbereitete Unterweisung wählen
 *   2. Wer steht vor Ihnen? – Sprachen antippen
 *   3. Los                  – sprechen → Rückübersetzung sehen und hören → senden
 *
 * Der dritte Schritt folgt dem Readback-Prinzip aus Luftfahrt und Medizin
 * (closed-loop communication): Die Führungskraft spricht, die Maschine
 * „liest zurück“ (Rückübersetzung), die Führungskraft bestätigt. Erst dann
 * geht die Anweisung an Display, Handys und Brillen. Tippen ist nur Rückfall.
 * Alles Weitere (Prüfdetails, Glossar, Einstellungen) liegt in der Verwaltung.
 */
(function () {
  'use strict';

  var D = window.SB_DATA, G = window.SBGuardrail, E = window.SB_ENGINES, BUS = window.SB_BUS, PIC = window.SB_PICTOS;
  var SB = window.SB, S = SB.S, H = SB.h;
  var esc = H.esc, icon = H.icon;
  var X = S.simple;
  var mic = null, micDone = false;        // Spracherkennung
  var reader = null, readToken = 0;       // Vorlesen der Rückübersetzung
  var cdTimer = null;                     // Countdown „Hände frei“
  var HOLD_MS = 700;                      // ab dieser Dauer gilt ein Druck als „gedrückt halten“
  var COUNTDOWN_S = 5;

  function $(sel) { return document.querySelector(sel); }
  function prog() { return S.programs.filter(function (p) { return p.id === X.programId; })[0] || null; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function micAvailable() { return !H.framed && !!E.sttMode(); }
  function handsFree() { return S.settings.release === 'readback'; }

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
    else if (X.step === 'live' && prog()) { el.innerHTML = liveHtml(); lastBarKey = barKey(); }
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
      '<button class="btn sm' + (X.speakHere ? ' on' : '') + '" data-action="s-speakhere" aria-pressed="' + X.speakHere + '" title="Gesendete Anweisungen auf diesem Gerät in allen Sprachen vorlesen">' + icon('speaker') + (X.speakHere ? 'Vorlesen an' : 'Vorlesen aus') + '</button>' +
      '<button class="btn sm' + (handsFree() ? ' on' : '') + '" data-action="s-handsfree" aria-pressed="' + handsFree() + '" title="Rückübersetzung vorlesen, danach automatisch senden – nur wenn alles grün ist">' + icon('check') + 'Hände frei</button></div></div>' +
      '<div id="s-qr-box">' + (X.showQr ? qrHtml() : '') + '</div>' +
      '<div id="s-decision" aria-live="polite">' + decisionHtml() + '</div>' +
      '<section class="card s-now" id="s-now" aria-live="polite">' + nowHtml() + '</section>' +
      (p.items.length ? '<section class="card s-next" id="s-next">' + nextHtml() + '</section>' : '') +
      '<div id="s-type">' + typeHtml() + '</div>' +
      '</div>' +
      '<div class="live-bar" id="s-bar">' + barHtml() + '</div>';
  }

  function barKey() { return (S.quiz && !S.quiz.closed) ? 'quiz' : 'nq'; }
  var lastBarKey = '';
  function barHtml() {
    var quizRunning = S.quiz && !S.quiz.closed;
    return '<button class="btn" data-action="' + (quizRunning ? 's-quizend' : 's-quiz') + '">' + icon('q') + (quizRunning ? 'Frage beenden' : 'Frage') + '</button>' +
      '<div class="mic-col"><button class="mic-big' + (X.listening ? ' rec' : '') + '" data-action="s-mic" aria-label="' + micLabel() + '">' + icon('mic') + '<span>' + (X.listening ? 'Fertig' : 'Sprechen') + '</span></button>' +
      '<span class="mic-hint">' + micHint() + '</span></div>' +
      '<button class="btn" data-action="s-end">' + icon('doc') + 'Beenden</button>';
  }
  function micLabel() { return X.listening ? 'Aufnahme beenden' : 'Sprechen'; }
  function micHint() {
    if (!micAvailable()) return H.framed ? 'Mikrofon hier gesperrt – öffnet Tippfeld' : 'Keine Spracherkennung – öffnet Tippfeld';
    return X.listening ? 'Sprechen … dann loslassen oder antippen' : 'Antippen oder gedrückt halten';
  }
  // Die Leiste nur bei Bedarf komplett neu zeichnen – sonst geht ein laufender Druck auf den Knopf verloren
  function drawBar() {
    var b = $('#s-bar'); if (!b) return;
    if (barKey() !== lastBarKey) { b.innerHTML = barHtml(); lastBarKey = barKey(); return; }
    var m = b.querySelector('.mic-big'), h = b.querySelector('.mic-hint');
    if (m) { m.classList.toggle('rec', !!X.listening); m.setAttribute('aria-label', micLabel()); var sp = m.querySelector('span'); if (sp) sp.textContent = X.listening ? 'Fertig' : 'Sprechen'; }
    if (h) h.textContent = micHint();
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
        (micAvailable() ? 'Unten auf „Sprechen“ tippen und einen kurzen Satz sagen. Sie sehen und hören, wie er zurückkommt – dann „Senden“.'
          : 'Unten auf „Sprechen“ tippen und den Satz eingeben. Sie sehen, wie er zurückkommt – dann „Senden“.') +
        (p && p.items.length ? ' Oder den vorbereiteten Punkt unten senden.' : '') + '</p>';
    }
    var acks = (S.acks[m.id] || 0) + (S.simAcks[m.id] || 0), nu = S.notUnderstood[m.id] || 0;
    return '<span class="label">Gesendet · ' + H.hhmm(m.ts) + (m.kernsatzId ? ' · geprüfter Text' : ' · Sinn geprüft und freigegeben') + '</span>' +
      '<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><p class="now-de grow">' + esc(m.de) + '</p>' + H.pictos(m.pictos, '40px') + '</div>' +
      '<div class="now-langs">' + X.langs.map(function (l) {
        return '<div class="now-line"><span class="lang-badge">' + l.toUpperCase() + '</span><span lang="' + l + '" dir="' + H.dirOf(l) + '"' + (m.texts[l] ? '' : ' class="held"') + '>' +
          esc(m.texts[l] || 'zurückgehalten – bitte mündlich erklären') + '</span></div>';
      }).join('') + '</div>' +
      '<div class="now-stats"><span class="ok">' + icon('check') + acks + ' verstanden</span>' +
      (nu ? '<span class="bad">' + icon('q') + nu + '× nicht verstanden – bitte wiederholen oder zeigen</span>' : '') +
      (S.settings.sim ? '<span class="muted small">Demo: inkl. simulierter Handys</span>' : '') + '</div>' +
      (X.speakNote ? '<p class="small muted" style="margin-top:6px">' + esc(X.speakNote) + '</p>' : '');
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
    return '<div class="row"><span class="label grow">Vorbereiteter Punkt ' + (X.idx + 1) + ' von ' + n + '</span><span class="pill green">fachlich geprüft</span></div>' +
      '<div class="row" style="flex-wrap:nowrap;align-items:flex-start"><p class="next-de grow">' + esc(it.de) + '</p>' + H.pictos(it.pictos, '44px') + '</div>' +
      '<div class="row"><button class="btn primary xl grow" data-action="s-send">' + icon('send') + 'Punkt senden</button><button class="btn ghost" data-action="s-skip">Überspringen</button></div>' + dots(p);
  }

  function dots(p) {
    return '<div class="dots" aria-hidden="true">' + p.items.map(function (x, i) { return '<i class="' + (i < X.idx ? 'done' : i === X.idx ? 'cur' : '') + '"></i>'; }).join('') + '</div>';
  }

  // ---------------- Entscheidung: hören → sehen → senden ----------------
  function decisionHtml() {
    if (X.listening) {
      return '<section class="card s-busy listen"><div class="busy"><span class="rec-dot"></span><b>Ich höre zu …</b><span class="small">kurz und eindeutig sprechen</span></div>' +
        '<p class="heard big">' + (X.heard ? '„' + esc(X.heard) + '“' : '…') + '</p></section>';
    }
    if (X.busy) {
      return '<section class="card s-busy"><p class="said"><span class="label">Verstanden</span><br>„' + esc(X.heard) + '“</p>' +
        '<div class="busy"><span class="spinner"></span>Übersetze in ' + plural(X.langs.length, 'Sprache', 'Sprachen') + ', übersetze zurück und prüfe den Sinn …</div></section>';
    }
    if (X.error) {
      return '<section class="card s-dec bad"><strong>' + esc(X.error.title || 'Nicht gesendet') + '</strong><p>' + esc(X.error.msg) + '</p>' +
        (X.error.suggestion ? '<div class="row"><span class="grow small">Passender geprüfter Satz: <b>' + esc(X.error.suggestion.de) + '</b></span><button class="btn sm" data-action="s-sendk" data-id="' + esc(X.error.suggestion.id) + '">Diesen senden</button></div>' : '') +
        '<div class="row" style="margin-top:8px"><button class="btn primary" data-action="s-mic">' + icon('mic') + 'Neu sprechen</button><button class="btn ghost sm" data-action="s-dismiss">Schließen</button></div></section>';
    }
    var pd = X.pending;
    if (!pd) return X.note ? '<div class="notice ' + (X.noteKind || 'ok') + ' s-note">' + (X.noteKind === 'warn' ? '' : icon('check') + ' ') + esc(X.note) + '</div>' : '';
    var a = pd.analysis;
    var red = X.langs.filter(function (l) { return a.perLang[l].status === 'red'; });
    if (red.length) return blockedHtml(pd, red);
    return confirmHtml(pd);
  }

  function badges(langs) {
    return '<span class="lang-badges">' + langs.map(function (l) { return '<span class="lang-badge">' + l.toUpperCase() + '</span>'; }).join('') + '</span>';
  }

  function saidHtml(pd) {
    return '<p class="said"><span class="label">Sie sagten</span><br>„' + esc(pd.source) + '“ <button class="link-btn inline" data-action="s-correct" title="Falsch verstanden? Satz korrigieren">korrigieren</button></p>';
  }

  function blockedHtml(pd, red) {
    var a = pd.analysis, okCount = X.langs.length - red.length;
    var block = a.perLang[red[0]].checks.filter(function (c) { return c.level === 'block'; })[0];
    return '<section class="card s-dec bad"><strong>Nicht gesendet: ' + esc(block.title) + ' (' + red.map(H.lname).join(', ') + ')</strong>' +
      saidHtml(pd) +
      '<div class="backs">' + red.map(function (l) {
        return '<div class="back-line bad">' + badges([l]) + '<span class="back-text">„' + esc(pd.results[l].back || '–') + '“</span></div>';
      }).join('') + '</div>' +
      '<p class="small">So kam es zurück. Bitte anders sagen – kurz und eindeutig.</p>' +
      '<div class="row"><button class="btn primary xl" data-action="s-mic">' + icon('mic') + 'Neu sprechen</button>' +
      (okCount ? '<button class="btn" data-action="s-confirm">Nur an ' + plural(okCount, 'geprüfte Sprache', 'geprüfte Sprachen') + ' senden</button>' : '') +
      '<button class="btn ghost" data-action="s-dismiss">Verwerfen</button></div></section>';
  }

  function confirmHtml(pd) {
    var a = pd.analysis;
    var yellow = X.langs.filter(function (l) { return a.perLang[l].status === 'yellow'; });
    var ok = !yellow.length;
    var groups = G.groupBacks(pd.source, pd.results, X.langs);
    var warn = yellow.length ? a.perLang[yellow[0]].checks.filter(function (c) { return c.level === 'warn'; })[0] : null;
    var status = '';
    if (X.reading) status = '<p class="s-status"><span class="rec-dot blue"></span>Ich lese die Rückübersetzung vor …</p>';
    else if (X.countdown > 0) status = '<div class="countdown" role="timer"><span>Wird in ' + X.countdown + ' s gesendet</span><span class="bar"><i style="width:' + Math.round(X.countdown / COUNTDOWN_S * 100) + '%"></i></span><button class="btn sm" data-action="s-stop">' + icon('x') + 'Stopp</button></div>';
    else if (X.cdStopped) status = '<p class="s-status small">Gestoppt. „Senden“ antippen oder neu sprechen.</p>';
    else if (X.voiceNote) status = '<p class="s-status small muted">' + esc(X.voiceNote) + '</p>';
    return '<section class="card s-dec confirm' + (ok ? ' ok' : ' warn') + '">' +
      '<div class="row"><strong class="grow">' + (ok ? 'So kommt es an – senden?' : 'Kurz prüfen: Haben Sie das gemeint?') + '</strong>' +
      '<span class="pill ' + (ok ? 'green' : 'yellow') + '">' + (pd.kernsatzId ? 'geprüfter Satz' : (ok ? 'Sinn geprüft' : 'bitte prüfen')) + '</span></div>' +
      saidHtml(pd) +
      '<div class="backs"><span class="label">Rückübersetzung – so kommt es zurück</span>' + groups.map(function (g) {
        var gy = g.langs.filter(function (l) { return yellow.indexOf(l) >= 0; }).length;
        return '<div class="back-line' + (gy ? ' warn' : '') + '">' + badges(g.langs) + '<span class="back-text">„' + esc(g.back || 'keine Rückübersetzung') + '“</span>' +
          (g.same ? '<span class="pill green">wörtlich gleich</span>' : (gy ? '<span class="pill yellow">prüfen</span>' : '')) + '</div>';
      }).join('') + '</div>' +
      (warn ? '<p class="small muted">Hinweis: ' + esc(warn.title) + (warn.detail ? ' – ' + esc(warn.detail) : '') + '</p>' : '') +
      status +
      '<div class="row"><button class="btn ok xl grow" data-action="s-confirm">' + icon('check') + (ok ? 'Senden' : 'Ja, so gemeint – senden') + '</button>' +
      '<button class="btn" data-action="s-hear"' + (X.reading ? ' disabled' : '') + ' title="Rückübersetzung auf Deutsch vorlesen">' + icon('speaker') + 'Anhören</button>' +
      '<button class="btn" data-action="s-mic">' + icon('mic') + 'Neu sprechen</button>' +
      '<button class="btn ghost sm" data-action="s-dismiss">Verwerfen</button></div></section>';
  }

  function typeHtml() {
    if (!X.typing) return '<button class="link-btn" data-action="s-typing">Lieber tippen</button>';
    return '<div class="type-row"><label class="sr-only" for="s-text">Ansage</label><input id="s-text" type="text" maxlength="280" placeholder="Ansage eingeben …" autocomplete="off" enterkeyhint="send">' +
      '<button class="btn primary" data-action="s-type-send" aria-label="Übersetzen und prüfen">' + icon('send') + '</button></div>' +
      '<p class="small muted" style="margin-top:6px">' + (X.micBlocked
        ? (H.framed ? 'Das Mikrofon ist in dieser Vorschau gesperrt. Am Handy: Mikrofon-Taste der Tastatur antippen und sprechen. ' : 'Hier ist keine Spracherkennung verfügbar. Am Handy: Mikrofon-Taste der Tastatur antippen und sprechen. ')
        : 'Tipp am Handy: Mikrofon-Taste der Tastatur antippen und sprechen. ') +
      '<button class="link-btn inline" data-action="s-typing-close">Tippfeld schließen</button></p>' +
      (X.micBlocked && H.framed ? '<p class="small"><button class="btn sm" data-action="s-window">' + icon('external') + 'In eigenem Fenster öffnen – dort geht das Mikrofon</button></p>' : '');
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
    var map = { '#s-now': nowHtml, '#s-decision': decisionHtml };
    Object.keys(map).forEach(function (sel) { var el = $(sel); if (el) el.innerHTML = map[sel](); });
    var nx = $('#s-next'); if (nx) nx.innerHTML = nextHtml();
    var qr = $('#s-qr-box'); if (qr) qr.innerHTML = X.showQr ? qrHtml() : '';
    drawBar();
  }
  function drawType() { var t = $('#s-type'); if (t) t.innerHTML = typeHtml(); }

  SB.refreshSimple = function (what) {
    if (X.step === 'live') drawLive();
  };

  function note(text, kind) {
    X.note = text; X.noteKind = kind || 'ok';
    var shown = text;
    setTimeout(function () { if (X.note === shown) { X.note = ''; drawLive(); } }, 6000);
  }

  // ---------------- Senden ----------------
  function speakHere(msg) {
    X.speakNote = '';
    if (!X.speakHere) return;
    var r = E.speakAll(X.langs.filter(function (l) { return msg.texts[l]; }).map(function (l) { return { text: msg.texts[l], lang: l }; }));
    if (r.missing && r.missing.length) X.speakNote = 'Auf diesem Gerät fehlt eine Vorlese-Stimme für: ' + r.missing.map(H.lname).join(', ') + '. Auf den Handys der Teilnehmenden kann es trotzdem klappen.';
  }

  function sendItem(it, advance) {
    stopReading(); stopCountdown();
    var texts = {}, held = [];
    X.langs.forEach(function (l) { if (it.t[l]) texts[l] = it.t[l]; else held.push(l); });
    var msg = H.sendMessage({ de: it.de, texts: texts, held: held, pictos: it.pictos, origin: 'kernsatz', engine: 'kernsatz', kernsatzId: it.id });
    if (advance) X.idx++;
    X.pending = null; X.error = null; X.note = ''; X.cdStopped = false;
    speakHere(msg);
    drawLive();
  }

  function commit(pd) {
    stopReading(); stopCountdown();
    var texts = {}, held = [];
    X.langs.forEach(function (l) { if (pd.analysis.perLang[l].status === 'red') held.push(l); else texts[l] = pd.results[l].text; });
    if (!Object.keys(texts).length) return;
    S.stats.confirmed += X.langs.filter(function (l) { return pd.analysis.perLang[l].status === 'yellow'; }).length;
    var msg = H.sendMessage({ de: pd.source, texts: texts, held: held, pictos: pd.pictos, origin: pd.origin, engine: pd.engine, kernsatzId: pd.kernsatzId });
    X.pending = null; X.cdStopped = false;
    note(held.length ? 'Gesendet. ' + plural(held.length, 'Sprache wird', 'Sprachen werden') + ' zurückgehalten.' : 'Gesendet – Sinn in allen Sprachen geprüft.');
    speakHere(msg);
    drawLive();
  }

  async function process(text) {
    text = String(text || '').trim().slice(0, 280);
    if (!text) return;
    stopReading(); stopCountdown();
    X.busy = true; X.error = null; X.pending = null; X.note = ''; X.heard = text; X.cdStopped = false; X.voiceNote = '';
    if (X.typing) { X.typing = false; drawType(); }
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
      if (analysis.status === 'green' && S.settings.release === 'auto') { commit(pd); return; }
      X.langs.forEach(function (l) {
        if (analysis.perLang[l].status === 'red') { S.stats.blocked++; H.recordBlocked(source, l, results[l], analysis.perLang[l], r.engine); }
      });
      H.persist();
      X.pending = pd;
      drawLive();
      afterPending(pd);
      return;
    } catch (e) {
      X.busy = false; X.heard = '';
      X.error = e && e.code === 'no_engine'
        ? { title: 'Freies Sprechen ist hier nicht eingerichtet', msg: 'Dafür braucht es eine Übersetzung im Hintergrund (lokal im Werk oder in der Online-Demo). Die vorbereiteten Punkte funktionieren immer.', suggestion: e.suggestion || null }
        : { title: 'Nicht gesendet', msg: (e && e.message) || 'Übersetzung fehlgeschlagen. Bitte noch einmal versuchen.' };
    }
    drawLive();
  }

  // Readback: Rückübersetzung vorlesen; bei „Hände frei“ und Grün danach Countdown
  function afterPending(pd) {
    if (pd.analysis.status === 'red') return;
    var auto = handsFree() && pd.analysis.status === 'green';
    if (S.settings.readBack) readBack(pd, auto);
    else if (auto) startCountdown();
  }

  function readBack(pd, thenCountdown) {
    stopReading();
    var langs = X.langs.filter(function (l) { return pd.analysis.perLang[l].status !== 'red'; });
    var groups = G.groupBacks(pd.source, pd.results, langs);
    var text = 'Rückübersetzung: ' + groups.map(function (g) {
      return (groups.length > 1 ? g.langs.map(H.lname).join(' und ') + ': ' : '') + (g.back || 'keine Rückübersetzung');
    }).join('. ');
    var token = ++readToken;
    X.reading = true;
    var r = E.speak(text, 'de', { onend: function (ok) {
      if (token !== readToken) return;
      X.reading = false; reader = null;
      if (ok && thenCountdown && X.pending === pd) startCountdown(); else drawLive();
    } });
    if (!r.ok) {
      X.reading = false; reader = null;
      X.voiceNote = (r.reason || 'Vorlesen nicht möglich.') + ' Bitte lesen und „Senden“ antippen.';
    } else reader = r;
    drawLive();
  }
  function stopReading() { readToken++; if (reader) { reader.cancel(); reader = null; } X.reading = false; }

  function startCountdown() {
    stopCountdown();
    X.countdown = COUNTDOWN_S; X.cdStopped = false;
    drawLive();
    cdTimer = setInterval(function () {
      X.countdown--;
      if (X.countdown <= 0) { stopCountdown(); if (X.pending) commit(X.pending); else drawLive(); }
      else drawLive();
    }, 1000);
  }
  function stopCountdown() { if (cdTimer) clearInterval(cdTimer); cdTimer = null; X.countdown = 0; }

  // ---------------- Mikrofon ----------------
  function openTyping(blocked, prefill) {
    X.typing = true; X.micBlocked = !!blocked;
    drawType();
    var inp = $('#s-text');
    if (inp) { if (prefill) inp.value = prefill; inp.focus(); if (prefill) inp.select(); }
  }

  async function startMic() {
    if (X.listening) return;
    if (!micAvailable()) { openTyping(true); return; }
    stopReading(); stopCountdown();
    X.pending = null; X.error = null; X.note = ''; X.heard = ''; X.cdStopped = false; micDone = false;
    if (X.typing) { X.typing = false; drawType(); }
    E.unlockSpeech();
    X.listening = true;
    drawLive();
    try {
      mic = await E.listen(function (text, fin) {
        X.heard = text;
        if (fin && !micDone) { micDone = true; X.listening = false; mic = null; process(text); }
        else drawLive();
      }, function (msg) {
        if (micDone) return;
        micDone = true; X.listening = false; mic = null;
        X.error = { title: 'Mikrofon', msg: msg + ' Sie können den Satz auch eintippen.' };
        drawLive(); openTyping(true);
      }, function () {
        if (micDone) return;
        micDone = true; X.listening = false; mic = null;
        var t = String(X.heard || '').trim();
        if (t) process(t); else { X.heard = ''; note('Nichts gehört. Bitte noch einmal auf „Sprechen“ tippen und deutlich sprechen.', 'warn'); drawLive(); }
      });
      if (micDone) { try { mic && mic.stop(); } catch (e) { /* ignorieren */ } mic = null; }
    } catch (e) { micDone = true; X.listening = false; mic = null; drawLive(); openTyping(true); }
  }
  function stopMic() { if (mic) { try { mic.stop(); } catch (e) { /* ignorieren */ } } }

  // Antippen (Start/Stopp) oder gedrückt halten (Walkie-Talkie) – beides geht
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest('.mic-big');
    if (!el || X.step !== 'live') return;
    if (X.listening) { X.micByDown = false; return; }
    X.micByDown = true; X.micHeld = false; X.micDownAt = Date.now();
    startMic();
  });
  document.addEventListener('pointerup', function () {
    if (!X.micByDown) return;
    if (Date.now() - X.micDownAt >= HOLD_MS) { X.micByDown = false; X.micHeld = true; stopMic(); }
  });
  document.addEventListener('pointercancel', function () { X.micByDown = false; X.micHeld = false; });
  document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('.mic-big')) e.preventDefault(); });

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
      X.sessionId = BUS.rid(); X.idx = 0; X.pending = null; X.error = null; X.note = ''; X.quizAsked = false; X.summary = null; X.typing = false; X.showQr = false; X.voiceNote = ''; X.speakNote = ''; X.heard = ''; X.cdStopped = false;
      X.step = 'live';
      H.persist();
      E.unlockSpeech();
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
    's-handsfree': function () {
      S.settings.release = handsFree() ? 'confirm' : 'readback';
      if (!handsFree()) stopCountdown();
      H.persist(); draw();
    },
    's-qr': function () { X.showQr = !X.showQr; draw(); },
    's-typing': function () { openTyping(false); },
    's-typing-close': function () { X.typing = false; drawType(); },
    's-type-send': function () { var inp = $('#s-text'); if (inp && inp.value.trim()) { var v = inp.value; inp.value = ''; process(v); } },
    's-window': function () { try { window.open(location.href, '_blank', 'noopener'); } catch (e) { /* ignorieren */ } },
    's-mic': function () {
      if (X.micHeld) { X.micHeld = false; return; }           // Loslassen nach Halten hat schon gestoppt
      if (X.micByDown) { X.micByDown = false; return; }       // kurzer Tipp: weiter zuhören bis zum nächsten Tipp
      if (X.listening) stopMic(); else startMic();
    },
    's-confirm': function () { if (X.pending) commit(X.pending); },
    's-stop': function () { stopCountdown(); stopReading(); X.cdStopped = true; drawLive(); },
    's-hear': function () { if (X.pending && !X.reading) { E.unlockSpeech(); readBack(X.pending, false); } },
    's-correct': function () { stopReading(); stopCountdown(); X.cdStopped = false; drawLive(); if (X.pending) openTyping(false, X.pending.source); },
    's-dismiss': function () { stopReading(); stopCountdown(); X.pending = null; X.error = null; X.cdStopped = false; drawLive(); },
    's-quiz': function () {
      var p = prog();
      H.startQuiz((p && p.quiz) || 'q-stapler');
      X.quizAsked = true;
      drawLive();
    },
    's-quizend': function () { if (S.quiz) BUS.publish('briefing.quizend', { id: S.quiz.id }); drawLive(); },
    's-end': function () {
      var p = prog();
      stopReading(); stopCountdown();
      if (mic) { micDone = true; try { mic.stop(); } catch (e) { /* ignorieren */ } mic = null; X.listening = false; }
      if (S.quiz && !S.quiz.closed) BUS.publish('briefing.quizend', { id: S.quiz.id });
      BUS.publish('briefing.end', { id: X.sessionId, type: p.type });
      var sess = H.sessionRecord(p.title, p.type === 'fremdfirma' ? 'fremdfirma' : 'briefing');
      S.sessions.push(sess);
      H.persist();
      S.nachweisSel = sess.id;
      X.summary = sess; X.step = 'done'; X.pending = null;
      draw(); window.scrollTo(0, 0);
    },
    's-new': function () { X.step = 'pick'; X.programId = null; X.summary = null; draw(); window.scrollTo(0, 0); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 's-text' && e.key === 'Enter') { e.preventDefault(); SB.ACTIONS['s-type-send'](); }
  });
})();

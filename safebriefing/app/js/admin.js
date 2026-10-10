/*
 * SafeBriefing – Fremdfirmen, Werks-Glossar, Nachweise, Cockpit, System & Datenschutz
 */
(function () {
  'use strict';

  var D = window.SB_DATA, G = window.SBGuardrail, E = window.SB_ENGINES, PIC = window.SB_PICTOS;
  var SB = window.SB, S = SB.S, H = SB.h;
  var esc = H.esc, icon = H.icon;
  var views = SB.views = SB.views || {};

  function $(sel, el) { return (el || document).querySelector(sel); }
  function addDays(iso, days) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
  function daysUntil(iso) { return Math.round((new Date(iso + 'T12:00:00') - new Date(H.today() + 'T12:00:00')) / 86400000); }
  function passCode() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'P-'; for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function contractorStatus(c) {
    var d = daysUntil(c.until);
    if (d < 0) return { st: 'red', text: 'abgelaufen' };
    if (d <= 30) return { st: 'yellow', text: 'läuft in ' + d + ' Tagen ab' };
    return { st: 'green', text: 'gültig' };
  }
  function copy(text, btn) {
    var done = function () { if (btn) { var t = btn.textContent; btn.textContent = 'Kopiert'; setTimeout(function () { btn.textContent = t; }, 1500); } };
    try { navigator.clipboard.writeText(text).then(done, function () { fallback(); }); } catch (e) { fallback(); }
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* manuell kopieren */ } ta.remove(); }
  }

  // ------------------------------------------------------------------
  // Fremdfirmen
  // ------------------------------------------------------------------
  var RULES = D.fremdfirmen.rules, FQ = D.fremdfirmen.quiz;
  var LAST_RULE = RULES.length, FIRST_Q = RULES.length + 1, DATA_STEP = RULES.length + FQ.length + 1, PASS_STEP = DATA_STEP + 1;

  function renderInduction(el) {
    if (!el) return;
    var I = S.induction, L = I.lang, U = H.ui(L || 'de');
    var html;
    if (!L || I.step === 0) {
      html = '<div class="w"><div class="w-head"><b>' + esc(D.site.werk) + '</b><span class="small muted">Pforte · Fremdfirmen</span></div>' +
        '<p style="font-weight:600">Sicherheitseinweisung · Safety induction</p>' +
        '<div class="w-langs">' + H.TARGETS.concat(['de']).map(function (l) {
          return '<button data-action="ind-lang" data-lang="' + l + '" lang="' + l + '" dir="' + H.dirOf(l) + '">' + esc(H.LANG[l].native) + '</button>';
        }).join('') + '</div><p class="w-foot">' + esc(D.ui.de.privacy) + '</p></div>';
    } else if (I.step <= LAST_RULE) {
      var r = RULES[I.step - 1];
      html = stepWrap(U.rulesTitle, I.step, '<div class="w-rule">' + PIC.render(r.picto) + '<h3>' + esc(r.title[L]) + '</h3><p>' + esc(r.text[L]) + '</p>' +
        (L !== 'de' ? '<p class="small muted" lang="de" dir="ltr">' + esc(r.text.de) + '</p>' : '') +
        '<button class="btn sm" data-action="ind-speak" aria-label="' + esc(U.listen) + '">' + icon('speaker') + esc(U.listen) + '</button></div>');
    } else if (I.step < DATA_STEP) {
      var qi = I.step - FIRST_Q, q = FQ[qi];
      html = stepWrap(U.checkTitle, I.step, '<div class="w-quiz"><b>' + esc(q.q[L]) + '</b>' + q.a.map(function (a, i) {
        return '<button data-action="ind-answer" data-i="' + i + '"' + (I.answers[q.id] === i ? ' style="border-color:var(--accent);background:var(--accent-soft)"' : '') + '>' + esc(a[L]) + '</button>';
      }).join('') + '</div>', I.answers[q.id] === undefined);
    } else if (I.step === DATA_STEP) {
      var score = FQ.filter(function (q) { return I.answers[q.id] === q.correct; }).length;
      if (score < FQ.length) {
        html = stepWrap(U.checkTitle, I.step, '<div class="notice warn">' + esc(U.retry) + ' (' + score + '/' + FQ.length + ')</div>' +
          '<button class="btn primary" data-action="ind-restart">' + esc(U.rulesTitle) + '</button>', true, true);
      } else {
        html = stepWrap(U.passed + ' · ' + score + '/' + FQ.length, I.step,
          '<label class="field"><span class="label">' + esc(U.name) + '</span><input id="ind-name" type="text" autocomplete="name" value="' + esc(I.name) + '"></label>' +
          '<label class="field"><span class="label">' + esc(U.company) + '</span><input id="ind-firma" type="text" autocomplete="organization" value="' + esc(I.firma) + '"></label>' +
          '<button class="btn primary" data-action="ind-finish">' + esc(U.confirm) + '</button>' +
          '<p class="small muted">Name, Firma und Datum werden nur für den Einweisungsnachweis gespeichert.</p>', true, true);
      }
    } else {
      var c = I.result;
      html = '<div class="w" lang="' + L + '" dir="' + H.dirOf(L) + '"><div class="w-pass">' + icon('check') +
        '<b style="font:600 1.4rem var(--font-display)">' + esc(U.passTitle) + '</b>' +
        '<div class="qr">' + H.qrSvg('SAFEBRIEFING-PASS:' + c.passCode) + '</div>' +
        '<div class="mono" style="font-size:1.3rem">' + esc(c.passCode) + '</div>' +
        '<div>' + esc(c.name) + (c.firma ? ' · ' + esc(c.firma) : '') + '</div>' +
        '<div class="small">' + esc(U.validUntil) + ' <b>' + H.deDate(c.until) + '</b></div>' +
        '<p class="small muted">' + esc(U.showAtGate) + '</p></div>' +
        '<button class="btn ghost sm" data-action="ind-reset">Nächste Person</button></div>';
    }
    el.innerHTML = html;
  }
  SB.renderInduction = renderInduction;

  function stepWrap(title, step, inner, noNext, noBack) {
    var L = S.induction.lang, U = H.ui(L);
    var total = PASS_STEP - 1;
    return '<div class="w" lang="' + L + '" dir="' + H.dirOf(L) + '">' +
      '<div class="w-head"><b>' + esc(title) + '</b><button class="chip" data-action="ind-reset">' + esc(H.LANG[L].native) + '</button></div>' +
      '<div class="progress" aria-hidden="true"><i style="width:' + Math.round(step / total * 100) + '%"></i></div>' +
      '<span class="w-step">' + step + ' / ' + total + '</span>' + inner +
      '<div class="row">' + (!noBack && step > 1 ? '<button class="btn" data-action="ind-back">' + esc(U.back) + '</button>' : '') +
      '<span class="grow"></span>' + (!noNext ? '<button class="btn primary" data-action="ind-next">' + esc(U.next) + '</button>' : '') + '</div></div>';
  }

  function inductionTarget() { return $('#kiosk-induction') || $('#ff-phone'); }

  Object.assign(SB.ACTIONS, {
    'ind-lang': function (el) { S.induction = { step: 1, lang: el.dataset.lang, answers: {}, name: '', firma: '', result: null }; renderInduction(inductionTarget()); },
    'ind-next': function () { S.induction.step++; renderInduction(inductionTarget()); },
    'ind-back': function () { S.induction.step = Math.max(1, S.induction.step - 1); renderInduction(inductionTarget()); },
    'ind-restart': function () { S.induction.step = 1; S.induction.answers = {}; renderInduction(inductionTarget()); },
    'ind-reset': function () { S.induction = { step: 0, lang: null, answers: {}, name: '', firma: '', result: null }; renderInduction(inductionTarget()); },
    'ind-answer': function (el) {
      var q = FQ[S.induction.step - FIRST_Q];
      S.induction.answers[q.id] = Number(el.dataset.i);
      S.induction.step++;
      renderInduction(inductionTarget());
    },
    'ind-speak': function () {
      var r = RULES[S.induction.step - 1]; if (r) E.speak(r.title[S.induction.lang] + '. ' + r.text[S.induction.lang], S.induction.lang);
    },
    'ind-finish': function () {
      var I = S.induction;
      var n = $('#ind-name'), f = $('#ind-firma');
      I.name = n ? n.value.trim() : ''; I.firma = f ? f.value.trim() : '';
      if (!I.name) { if (n) n.focus(); return; }
      var c = { id: 'c' + Date.now().toString(36), name: I.name.slice(0, 80), firma: I.firma.slice(0, 80) || '–', lang: I.lang, bereich: 'bei Anmeldung festlegen', koordinator: 'offen',
        since: H.today(), until: addDays(H.today(), 365), permits: [], passCode: passCode(), fresh: true };
      S.contractors.unshift(c);
      S.sessions.push({ id: 'n-' + Date.now().toString(36), type: 'fremdfirma', date: H.today(), start: H.hhmm(Date.now()), end: H.hhmm(Date.now()),
        topic: 'Fremdfirmen-Einweisung · Pforte (Selbst-Einweisung)', leader: 'Pforte / Koordinator', langs: [I.lang], released: RULES.length, blocked: 0, confirmed: 0,
        participants: 1, named: [{ name: c.name, firma: c.firma, lang: c.lang }], quiz: { correct: FQ.length, total: FQ.length }, live: true,
        messages: RULES.map(function (r) { return { de: r.text.de, langs: [I.lang], held: [], kernsatz: true }; }) });
      H.persist();
      I.result = c; I.step = PASS_STEP;
      renderInduction(inductionTarget());
      if (S.route === 'fremdfirmen') renderContractors();
    },
    'pass-check': function () {
      var inp = $('#pass-q'), out = $('#pass-out'); if (!inp || !out) return;
      var q = inp.value.trim().toUpperCase().replace(/^SAFEBRIEFING-PASS:/, '');
      var c = S.contractors.filter(function (x) { return (x.passCode && x.passCode.toUpperCase() === q) || x.name.toUpperCase().indexOf(q) >= 0; })[0];
      if (!q) { out.innerHTML = ''; return; }
      if (!c) { out.innerHTML = '<div class="notice bad">Kein Einweisungsnachweis gefunden. Zutritt erst nach Einweisung.</div>'; return; }
      var st = contractorStatus(c);
      out.innerHTML = '<div class="notice ' + (st.st === 'green' ? 'ok' : st.st === 'yellow' ? 'warn' : 'bad') + '"><b>' + esc(c.name) + '</b> · ' + esc(c.firma) + ' · ' + esc(H.lname(c.lang)) +
        '<br>Einweisung ' + esc(st.text) + ' (bis ' + H.deDate(c.until) + ')' + (st.st === 'red' ? '. Bitte erneut einweisen.' : '') + '</div>';
    }
  });

  var FF_CHECKS = [
    ['Gegenseitig über Gefahren unterrichten und Schutzmaßnahmen abstimmen, wenn Beschäftigte mehrerer Arbeitgeber zusammenarbeiten.', '§ 8 Abs. 1 ArbSchG'],
    ['Sich vergewissern, dass Beschäftigte der Fremdfirma angemessene Anweisungen für die Gefahren im Werk erhalten haben – in verständlicher Form.', '§ 8 Abs. 2 ArbSchG'],
    ['Koordinator bestimmen, wenn eine gegenseitige Gefährdung möglich ist; Auftragnehmer vertraglich auf die Werksregeln verpflichten.', '§§ 5, 6 DGUV Vorschrift 1'],
    ['Leiharbeit: Der Entleiher unterweist arbeitsplatzbezogen – nicht die Verleihfirma.', '§ 12 Abs. 2 ArbSchG, § 11 Abs. 6 AÜG'],
    ['Bauarbeiten mehrerer Firmen auf dem Gelände: Sicherheits- und Gesundheitsschutzkoordination (SiGeKo) klären.', '§ 3 BaustellV'],
    ['Erlaubnisscheinverfahren für Heißarbeiten, Arbeiten in Behältern und engen Räumen sowie an elektrischen Anlagen; Freigabe vor Ort.', 'z. B. DGUV Regel 113-004'],
    ['Nachunternehmerketten: Jede Person wird eingewiesen. Der Vorarbeiter als „Dolmetscher“ ist ungeprüft und ersetzt keine Einweisung.', 'Praxis, DGUV Regel 100-001'],
    ['Verständnis prüfen und dokumentieren – Muttersprache ist nicht vorgeschrieben, Verständlichkeit schon.', 'DGUV Regel 100-001, § 12 BetrSichV'],
    ['Einweisung mindestens jährlich und bei Änderungen (neuer Bereich, neue Verkehrsführung) wiederholen; Gültigkeit am Pass sichtbar.', '§ 4 DGUV Vorschrift 1'],
    ['Datenschutz für Fremdpersonal: nur Name, Firma, Datum, Sprache und „bestanden“ speichern; Information nach Art. 13 DSGVO, Löschfrist festlegen.', 'Art. 5, 13 DSGVO'],
    ['Werksgeheimnis: Fotoverbot und Kamerafunktion von Smart-Brillen mit dem Werkschutz und dem Betriebsrat klären.', 'Werksordnung, § 87 Abs. 1 Nr. 6 BetrVG'],
    ['Informationssicherheit beim Auftraggeber (z. B. TISAX oder ISO 27001 für Lieferanten): lokaler Betrieb ohne Cloud vereinfacht die Freigabe.', 'Lieferantenanforderungen']
  ];

  views.fremdfirmen = function (root) {
    root.innerHTML =
      '<div class="card-head"><div><span class="label">Fremdfirmen und Leiharbeit</span><h2 style="font-size:1.8rem">Einweisung an der Pforte – in der eigenen Sprache</h2></div>' +
        '<a class="btn" href="#pforte">' + icon('expand') + 'Pforten-Ansicht öffnen</a></div>' +
      '<div class="two-col">' +
        '<div class="stack"><div class="phone" style="margin:0 auto"><div class="phone-screen" id="ff-phone"></div></div>' +
          '<p class="small muted" style="text-align:center">Selbst-Einweisung per QR-Code an der Pforte oder am Leih-Tablet. Ohne Firmenkonto, ohne App.</p></div>' +
        '<div class="stack">' +
          '<div class="kpis" id="ff-kpis"></div>' +
          '<section class="card"><div class="card-head"><h3>Koordinator-Übersicht</h3><span class="pill grey">Beispieldaten</span></div><div class="table-wrap" id="ff-table"></div></section>' +
          '<section class="card"><h3 style="margin-bottom:8px">Einweisungsnachweis prüfen</h3><div class="row"><label class="sr-only" for="pass-q">Pass-Code oder Name</label>' +
            '<input id="pass-q" type="search" class="grow" style="width:auto" placeholder="Pass-Code (z. B. P-7K3M) oder Name"><button class="btn" data-action="pass-check">Prüfen</button></div><div id="pass-out" style="margin-top:8px"></div></section>' +
          '<section class="card"><h3 style="margin-bottom:10px">Worauf bei Fremdfirmen besonders achten</h3><ul class="checklist">' +
            FF_CHECKS.map(function (c) { return '<li><span>' + esc(c[0]) + '<span class="src">' + esc(c[1]) + '</span></span></li>'; }).join('') +
          '</ul><p class="small muted" style="margin-top:10px">Keine Rechtsberatung. Einordnung vor externer Verwendung fachlich und juristisch prüfen lassen.</p></section>' +
        '</div>' +
      '</div>';
    renderInduction($('#ff-phone'));
    renderContractors();
  };

  function renderContractors() {
    var t = $('#ff-table'), k = $('#ff-kpis'); if (!t) return;
    var counts = { green: 0, yellow: 0, red: 0 };
    S.contractors.forEach(function (c) { counts[contractorStatus(c).st]++; });
    if (k) k.innerHTML =
      '<div class="kpi"><b>' + S.contractors.length + '</b><span>Personen eingewiesen</span></div>' +
      '<div class="kpi"><b style="color:var(--ok)">' + counts.green + '</b><span>gültig</span></div>' +
      '<div class="kpi"><b style="color:var(--warn)">' + counts.yellow + '</b><span>laufen in 30 Tagen ab</span></div>' +
      '<div class="kpi"><b style="color:var(--bad)">' + counts.red + '</b><span>abgelaufen – kein Zutritt</span></div>';
    t.innerHTML = '<table class="rtable"><thead><tr><th>Person</th><th>Firma</th><th>Sprache</th><th>Bereich · Koordinator</th><th>Erlaubnisscheine</th><th>Einweisung</th></tr></thead><tbody>' +
      S.contractors.map(function (c) {
        var st = contractorStatus(c);
        return '<tr><td><b>' + esc(c.name) + '</b>' + (c.passCode ? '<div class="small mono muted">' + esc(c.passCode) + '</div>' : '') + (c.fresh ? ' <span class="pill blue">neu</span>' : '') + '</td>' +
          '<td data-label="Firma">' + esc(c.firma) + '</td><td data-label="Sprache"><span class="lang-badge">' + esc(c.lang.toUpperCase()) + '</span></td>' +
          '<td data-label="Bereich · Koordinator">' + esc(c.bereich) + '<div class="small muted">' + esc(c.koordinator) + '</div></td>' +
          '<td data-label="Erlaubnisscheine">' + (c.permits.length ? c.permits.map(esc).join('<br>') : '<span class="muted">–</span>') + '</td>' +
          '<td data-label="Einweisung"><span class="status-dot ' + st.st + '"></span>' + esc(st.text) + '<div class="small muted mono">bis ' + H.deDate(c.until) + '</div></td></tr>';
      }).join('') + '</tbody></table>';
  }

  // ------------------------------------------------------------------
  // Werks-Glossar
  // ------------------------------------------------------------------
  views.glossar = function (root) {
    var cats = ['alle'];
    S.glossary.forEach(function (g) { if (cats.indexOf(g.cat) < 0) cats.push(g.cat); });
    var langs = S.langs.length ? S.langs : ['pl', 'ro', 'tr'];
    var approved = S.glossary.filter(function (g) { return g.status === 'freigegeben'; }).length;
    root.innerHTML =
      '<div class="card-head"><div><span class="label">Werks-Glossar</span><h2 style="font-size:1.8rem">Fachbegriffe, die in jeder Sprache stimmen</h2></div>' +
        '<div class="row"><button class="btn" data-action="gl-export">' + icon('doc') + 'Als JSON kopieren</button><button class="btn primary" data-action="gl-new">Neuer Begriff</button></div></div>' +
      '<div class="kpis" style="margin-bottom:14px">' +
        '<div class="kpi"><b>' + S.glossary.length + '</b><span>Begriffe</span></div>' +
        '<div class="kpi"><b>' + approved + '</b><span>fachlich freigegeben</span></div>' +
        '<div class="kpi"><b>' + S.glossary.filter(function (g) { return g.critical; }).length + '</b><span>sicherheitskritisch (Sperre bei Verstoß)</span></div>' +
        '<div class="kpi"><b>' + S.findings.length + '</b><span>Fälle in der Lernschleife</span></div>' +
      '</div>' +
      '<div id="gl-form"></div>' +
      '<div class="row" style="margin-bottom:10px">' + cats.map(function (c) {
        return '<button class="chip ' + (S.glFilter.cat === c ? 'on' : '') + '" data-action="gl-cat" data-cat="' + esc(c) + '">' + esc(c === 'alle' ? 'Alle' : c) + '</button>';
      }).join('') + '<span class="grow"></span><label class="sr-only" for="gl-q">Suche</label><input id="gl-q" type="search" placeholder="Suchen …" style="width:200px" value="' + esc(S.glFilter.q) + '"></div>' +
      '<div class="table-wrap" id="gl-table"></div>' +
      '<p class="small muted" style="margin-top:8px">Spalten zeigen die Sprachen der aktuellen Schicht. Rot durchgestrichen: unzulässige Übersetzungen – sie sperren die Ausgabe, wenn der freigegebene Begriff fehlt.</p>' +
      '<section class="card" style="margin-top:16px"><div class="card-head"><h3>Lernschleife: gesperrte und gemeldete Übersetzungen</h3><span class="small muted">Jeder Fall verbessert Glossar und Prüfregeln</span></div><div id="gl-findings"></div></section>';
    renderGlossaryTable(langs);
    renderFindings();
  };

  function renderGlossaryTable(langs) {
    var el = $('#gl-table'); if (!el) return;
    langs = langs || (S.langs.length ? S.langs : ['pl', 'ro', 'tr']);
    var q = S.glFilter.q.toLowerCase();
    var rows = S.glossary.filter(function (g) {
      if (S.glFilter.cat !== 'alle' && g.cat !== S.glFilter.cat) return false;
      if (!q) return true;
      return (g.de + ' ' + g.note + ' ' + JSON.stringify(g.t)).toLowerCase().indexOf(q) >= 0;
    });
    el.innerHTML = '<table class="rtable"><thead><tr><th>Begriff</th><th>Status</th>' + langs.map(function (l) { return '<th>' + l.toUpperCase() + ' · ' + esc(H.lname(l)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (g) {
        return '<tr><td><div class="row" style="flex-wrap:nowrap;align-items:flex-start">' + PIC.render(g.picto, '32px') + '<div><b>' + esc(g.de) + '</b>' + (g.critical ? ' <span class="pill red">kritisch</span>' : '') +
          '<div class="small muted">' + esc(g.cat) + ' · ' + esc(g.note) + '</div></div></div></td>' +
          '<td data-label="Status">' + (g.status === 'freigegeben' ? H.statusPill('green', 'freigegeben') + '<div class="small muted">' + esc(g.approvedBy) + ', ' + H.deDate(g.approvedAt) + '</div>'
            : H.statusPill('yellow', 'Entwurf') + '<div><button class="btn sm" style="margin-top:6px" data-action="gl-approve" data-id="' + esc(g.id) + '">Fachlich freigeben</button></div>') + '</td>' +
          langs.map(function (l) {
            var t = g.t[l];
            var lab = ' data-label="' + l.toUpperCase() + ' · ' + esc(H.lname(l)) + '"';
            if (!t) return '<td' + lab + '><span class="pill yellow">fehlt</span></td>';
            return '<td' + lab + '><div class="gl-terms" lang="' + l + '" dir="' + H.dirOf(l) + '"><span>' + esc(t.term) + '</span>' + (t.forbidden || []).map(function (f) { return '<span class="forb">' + esc(f) + '</span>'; }).join('') + '</div></td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }

  function renderFindings() {
    var el = $('#gl-findings'); if (!el) return;
    if (!S.findings.length) {
      el.innerHTML = '<p class="empty">Noch keine Fälle. Im Leitstand die Prüf-Demo ausprobieren: gesperrte Übersetzungen landen hier.</p>';
      return;
    }
    el.innerHTML = S.findings.slice(0, 12).map(function (f, i) {
      return '<div class="feed-item"><time>' + H.hhmm(f.ts) + '</time><div><div><span class="lang-badge">' + esc(f.lang.toUpperCase()) + '</span> ' + esc(f.source) + '</div>' +
        '<div class="small" lang="' + esc(f.lang) + '" dir="' + H.dirOf(f.lang) + '">' + esc(f.translation) + '</div>' +
        '<div class="small muted">Rückübersetzung: ' + esc(f.back) + '</div>' +
        '<div class="row" style="margin-top:4px">' + f.problems.map(function (p) { return '<span class="finding block">' + esc(p) + '</span>'; }).join('') + '</div></div>' +
        '<div>' + (f.state === 'erledigt' ? H.statusPill('green', 'erledigt') : '<button class="btn sm" data-action="finding-done" data-i="' + i + '">' + esc(f.state === 'offen' ? 'Geprüft' : f.state) + '</button>') + '</div></div>';
    }).join('');
  }

  Object.assign(SB.ACTIONS, {
    'gl-cat': function (el) { S.glFilter.cat = el.dataset.cat; SB.render(); },
    'gl-approve': function (el) {
      var g = S.glossary.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!g) return;
      g.status = 'freigegeben'; g.approvedBy = 'Sifa (Demo)'; g.approvedAt = H.today();
      H.persist(); SB.render();
    },
    'gl-export': function (el) { copy(JSON.stringify(S.glossary, null, 2), el); },
    'finding-done': function (el) { var f = S.findings[Number(el.dataset.i)]; if (f) { f.state = 'erledigt'; H.persist(); renderFindings(); } },
    'gl-new': function () {
      var el = $('#gl-form'); if (!el) return;
      var langs = S.langs.length ? S.langs : ['pl', 'ro', 'tr'];
      el.innerHTML = '<section class="card" style="margin-bottom:14px"><h3 style="margin-bottom:10px">Neuer Begriff (Entwurf, Freigabe durch die Sifa)</h3>' +
        '<div class="kpis"><label class="field"><span class="label">Deutsch</span><input id="gn-de" type="text" placeholder="z. B. Lastaufnahmemittel"></label>' +
        '<label class="field"><span class="label">Kategorie</span><input id="gn-cat" type="text" value="Maschinen"></label>' +
        '<label class="field"><span class="label">Hinweis</span><input id="gn-note" type="text" placeholder="Bedeutung, typische Fehler"></label></div>' +
        '<label style="display:flex;gap:8px;align-items:center;margin:10px 0"><input id="gn-crit" type="checkbox"> Sicherheitskritisch (Verstoß sperrt die Ausgabe)</label>' +
        '<div class="kpis">' + langs.map(function (l) {
          return '<div class="field"><span class="label">' + l.toUpperCase() + ' · ' + esc(H.lname(l)) + '</span><input id="gn-t-' + l + '" type="text" placeholder="Freigegebener Begriff" lang="' + l + '" dir="' + H.dirOf(l) + '">' +
            '<input id="gn-f-' + l + '" type="text" placeholder="Unzulässig (mit Komma trennen)" lang="' + l + '" dir="' + H.dirOf(l) + '"></div>';
        }).join('') + '</div>' +
        '<div class="row" style="margin-top:10px"><button class="btn primary" data-action="gl-save">Als Entwurf speichern</button><button class="btn ghost" data-action="gl-cancel">Abbrechen</button></div></section>';
      var inp = $('#gn-de'); if (inp) inp.focus();
    },
    'gl-cancel': function () { var el = $('#gl-form'); if (el) el.innerHTML = ''; },
    'gl-save': function () {
      var de = ($('#gn-de') || {}).value; de = de ? de.trim() : '';
      if (!de) { var i = $('#gn-de'); if (i) i.focus(); return; }
      var langs = S.langs.length ? S.langs : ['pl', 'ro', 'tr'];
      var t = {};
      langs.forEach(function (l) {
        var term = ($('#gn-t-' + l) || {}).value || '';
        var forb = ($('#gn-f-' + l) || {}).value || '';
        if (term.trim()) t[l] = { term: term.trim(), match: [term.trim()], forbidden: forb.split(',').map(function (s) { return s.trim(); }).filter(Boolean) };
      });
      S.glossary.push({ id: 'g' + Date.now().toString(36), de: de, cat: (($('#gn-cat') || {}).value || 'Allgemein').trim(), critical: !!($('#gn-crit') || {}).checked,
        picto: 'achtung', status: 'entwurf', approvedBy: '', approvedAt: '', note: (($('#gn-note') || {}).value || '').trim(), match: [G.normDE(de)], t: t });
      H.persist(); SB.render();
    }
  });

  // ------------------------------------------------------------------
  // Nachweise
  // ------------------------------------------------------------------
  views.nachweise = function (root) {
    var list = S.sessions.slice().reverse();
    if (!S.nachweisSel && list[0]) S.nachweisSel = list[0].id;
    root.innerHTML =
      '<div class="card-head"><div><span class="label">Dokumentation</span><h2 style="font-size:1.8rem">Unterweisungsnachweise</h2></div><span class="small muted">Teilnahme und Ergebnisse werden getrennt gespeichert</span></div>' +
      '<div class="two-col"><div class="stack" id="nw-list"></div><div id="nw-doc" style="min-width:0"></div></div>';
    $('#nw-list').innerHTML = list.map(function (s) {
      var pc = s.quiz && s.quiz.total ? Math.round(s.quiz.correct / s.quiz.total * 100) + ' %' : '–';
      return '<button class="card" data-action="nw-sel" data-id="' + esc(s.id) + '" style="text-align:start;cursor:pointer;' + (s.id === S.nachweisSel ? 'border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)' : '') + '">' +
        '<div class="row"><span class="mono small">' + H.deDate(s.date) + ' · ' + esc(s.start) + '</span><span class="grow"></span>' + (s.live ? H.statusPill('blue', 'neu') : H.statusPill('grey', 'Beispiel')) + '</div>' +
        '<b style="display:block;margin-top:4px">' + esc(s.topic) + '</b>' +
        '<div class="small muted">' + s.participants + ' Personen · ' + s.langs.map(function (l) { return l.toUpperCase(); }).join(' ') + ' · Verständnis ' + pc + '</div></button>';
    }).join('') || '<p class="empty">Noch keine Nachweise.</p>';
    renderDoc();
  };

  function docText(s) {
    var lines = ['UNTERWEISUNGSNACHWEIS', D.site.werk + ' · ' + D.site.halle, 'Datum: ' + H.deDate(s.date) + ', ' + s.start + '–' + s.end + ' Uhr', 'Thema: ' + s.topic, 'Unterweisende Person: ' + s.leader,
      'Sprachfassungen: ' + ['de'].concat(s.langs).map(H.lname).join(', ')];
    if (s.messages) { lines.push('Inhalte:'); s.messages.forEach(function (m, i) { lines.push((i + 1) + '. ' + m.de + (m.held && m.held.length ? ' [zurückgehalten: ' + m.held.join(', ') + ']' : '')); }); }
    if (s.quiz) lines.push('Verständniskontrolle (anonym): ' + s.quiz.correct + ' von ' + s.quiz.total + ' Antworten richtig');
    lines.push('Teilnehmende: ' + s.participants);
    (s.named || []).forEach(function (p) { lines.push('- ' + p.name + (p.firma ? ' (' + p.firma + ')' : '') + ', ' + H.lname(p.lang)); });
    return lines.join('\n');
  }

  function renderDoc() {
    var el = $('#nw-doc'); if (!el) return;
    var s = S.sessions.filter(function (x) { return x.id === S.nachweisSel; })[0];
    if (!s) { el.innerHTML = ''; return; }
    var named = s.named || [];
    var blanks = Math.max(0, Math.min(10, (s.participants || 0) - named.length));
    var pc = s.quiz && s.quiz.total ? Math.round(s.quiz.correct / s.quiz.total * 100) : null;
    el.innerHTML =
      '<div class="row no-print" style="margin-bottom:10px">' + (!H.framed ? '<button class="btn" data-action="nw-print">' + icon('doc') + 'Drucken / als PDF</button>' : '') +
        '<button class="btn" data-action="nw-copy">Als Text kopieren</button></div>' +
      '<article class="doc">' +
        '<div class="row"><span class="label" style="color:#4A5868">' + esc(D.site.werk) + ' · ' + esc(D.site.halle) + '</span><span class="grow"></span><span class="mono small">' + esc(s.id) + '</span></div>' +
        '<h2>' + (s.type === 'fremdfirma' ? 'Nachweis Fremdfirmen-Einweisung' : 'Unterweisungsnachweis') + '</h2>' +
        '<p class="small" style="color:#4A5868">Dokumentation nach § 4 Abs. 1 DGUV Vorschrift 1 und § 12 Abs. 1 BetrSichV (Datum, Namen der Unterwiesenen)' + (s.type === 'fremdfirma' ? '; Anweisungen nach § 8 Abs. 2 ArbSchG' : '') + '</p>' +
        '<div class="meta-grid">' +
          '<div><span>Datum, Uhrzeit</span>' + H.deDate(s.date) + ', ' + esc(s.start) + '–' + esc(s.end) + ' Uhr</div>' +
          '<div><span>Unterweisende Person</span>' + esc(s.leader) + '</div>' +
          '<div><span>Thema</span>' + esc(s.topic) + '</div>' +
          '<div><span>Sprachfassungen</span>' + ['de'].concat(s.langs).map(function (l) { return esc(H.lname(l)); }).join(', ') + '</div>' +
        '</div>' +
        '<h3>Inhalte</h3>' +
        (s.messages && s.messages.length ? '<ol>' + s.messages.map(function (m) {
          return '<li>' + esc(m.de) + (m.kernsatz ? ' <span style="color:#1B7A4B">(geprüfter Kernsatz)</span>' : '') + (m.held && m.held.length ? ' <span style="color:#8E5B00">– zurückgehalten: ' + m.held.map(H.lname).join(', ') + ', mündlich nachholen</span>' : '') + '</li>';
        }).join('') + '</ol>' : '<p class="small" style="color:#4A5868">Beispieldatensatz – Inhalte nicht hinterlegt.</p>') +
        '<h3 style="margin-top:12px">Methode und Qualitätssicherung</h3>' +
        '<p>Live-Übersetzung mit Rückübersetzung und automatischem Sinnvergleich; Freigabe je Sprache durch die unterweisende Person; Notfallhinweise ausschließlich als vorab geprüfte Kernsätze; Fachbegriffe nach freigegebenem Werks-Glossar. ' +
          'Freigegeben: ' + (s.released || 0) + ' Anweisungen, gesperrte Übersetzungen: ' + (s.blocked || 0) + ', nach Prüfung bestätigt: ' + (s.confirmed || 0) + '.</p>' +
        '<p class="small" style="color:#4A5868;margin-top:4px">Übersetzungen wurden mit KI erstellt und als solche gekennzeichnet (Art. 50 KI-VO).</p>' +
        '<h3 style="margin-top:12px">Verständniskontrolle</h3>' +
        '<p>' + (s.quiz ? s.quiz.correct + ' von ' + s.quiz.total + ' Antworten richtig (' + pc + ' %). Anonym erhoben, keine personenbezogene Auswertung.' : 'Keine Verständnisfrage gestellt – mündlich prüfen und vermerken.') + '</p>' +
        '<h3 style="margin-top:12px">Teilnehmende (' + (s.participants || 0) + ')</h3>' +
        '<table><thead><tr><th>Name</th><th>Firma</th><th>Sprache</th><th>Unterschrift</th></tr></thead><tbody>' +
          named.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.firma || '') + '</td><td>' + esc(H.lname(p.lang)) + '</td><td>digital bestätigt</td></tr>'; }).join('') +
          new Array(blanks + 1).join('<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>') +
        '</tbody></table>' +
        (s.simulated ? '<p class="small" style="color:#4A5868;margin-top:4px">Davon ' + s.simulated + ' simulierte Geräte (Demo).</p>' : '') +
        '<div class="sig"><div>Ort, Datum</div><div>Unterschrift unterweisende Person</div></div>' +
        '<div class="foot">Teilnahme- und Ergebnisdaten werden getrennt gespeichert (Mitbestimmung nach § 87 Abs. 1 Nr. 6 und 7 BetrVG). Die mündliche, arbeitsplatzbezogene Unterweisung bleibt Aufgabe der Führungskraft (DGUV Information 211-005).</div>' +
      '</article>';
  }

  Object.assign(SB.ACTIONS, {
    'nw-sel': function (el) { S.nachweisSel = el.dataset.id; SB.render(); },
    'nw-print': function () { try { window.print(); } catch (e) { /* nicht verfügbar */ } },
    'nw-copy': function (el) { var s = S.sessions.filter(function (x) { return x.id === S.nachweisSel; })[0]; if (s) copy(docText(s), el); }
  });

  // ------------------------------------------------------------------
  // Cockpit
  // ------------------------------------------------------------------
  views.cockpit = function (root) {
    var br = S.sessions.filter(function (s) { return s.type === 'briefing'; });
    var qc = 0, qt = 0, blocked = 0, released = 0;
    S.sessions.forEach(function (s) { if (s.quiz) { qc += s.quiz.correct; qt += s.quiz.total; } blocked += s.blocked || 0; released += s.released || 0; });
    var langCount = {};
    S.sessions.forEach(function (s) { s.langs.forEach(function (l) { langCount[l] = (langCount[l] || 0) + 1; }); });
    var ff = { green: 0, yellow: 0, red: 0 };
    S.contractors.forEach(function (c) { ff[contractorStatus(c).st]++; });
    var last = S.sessions.slice(-8);
    var maxLang = Math.max.apply(null, Object.keys(langCount).map(function (k) { return langCount[k]; }).concat([1]));
    root.innerHTML =
      '<div class="card-head"><div><span class="label">Wirksamkeit</span><h2 style="font-size:1.8rem">Cockpit für Sifa und Werksleitung</h2></div><span class="pill grey">Beispieldaten und Sitzungen dieses Geräts</span></div>' +
      '<div class="kpis">' +
        '<div class="kpi"><b>' + br.length + '</b><span>Schichtbriefings dokumentiert</span></div>' +
        '<div class="kpi"><b>' + (qt ? Math.round(qc / qt * 100) : 0) + ' %</b><span>Verständnisfragen richtig (anonym)</span></div>' +
        '<div class="kpi"><b>' + released + '</b><span>Anweisungen freigegeben</span></div>' +
        '<div class="kpi"><b style="color:var(--bad)">' + blocked + '</b><span>Fehlübersetzungen gesperrt, bevor sie jemand sah</span></div>' +
        '<div class="kpi"><b>' + Object.keys(langCount).length + '</b><span>Sprachen im Einsatz</span></div>' +
        '<div class="kpi"><b>' + ff.green + ' / ' + S.contractors.length + '</b><span>Fremdfirmen-Einweisungen gültig</span></div>' +
      '</div>' +
      '<div class="two-col wide-left" style="margin-top:16px">' +
        '<section class="card chart"><h3>Verständnis je Unterweisung</h3>' +
          '<div class="vbars">' + last.map(function (s) {
            var p = s.quiz && s.quiz.total ? s.quiz.correct / s.quiz.total : 0;
            return '<div class="vbar"><span class="n">' + Math.round(p * 100) + '</span><span class="v ok" style="height:' + Math.round(p * 100) + '%"></span></div>';
          }).join('') + '</div><div class="vlabels">' + last.map(function (s) { return '<span>' + H.deDate(s.date).slice(0, 5) + '</span>'; }).join('') + '</div>' +
          '<p class="small muted">Anteil richtiger Antworten in Prozent. Ziel im Pilot: Vorher-Nachher-Vergleich je Bereich.</p></section>' +
        '<section class="card chart"><h3>Freigaben und Sperren je Unterweisung</h3><div class="bars">' + last.map(function (s) {
            var tot = (s.released || 0) + (s.blocked || 0) || 1;
            return '<div class="bar"><span class="mono">' + H.deDate(s.date).slice(0, 5) + '</span><span class="track"><span class="fill ok" style="width:' + ((s.released || 0) / tot * 100) + '%"></span><span class="fill bad" style="width:' + ((s.blocked || 0) / tot * 100) + '%"></span></span><span class="num">' + (s.released || 0) + ' / ' + (s.blocked || 0) + '</span></div>';
          }).join('') + '</div><p class="small muted">Grün: freigegeben, Rot: vom Sinnvergleich gesperrt.</p></section>' +
        '<section class="card chart"><h3>Sprachen der Belegschaft</h3><div class="bars">' + Object.keys(langCount).sort(function (a, b) { return langCount[b] - langCount[a]; }).map(function (l) {
            return '<div class="bar"><span>' + esc(H.lname(l)) + '</span><span class="track"><span class="fill" style="width:' + (langCount[l] / maxLang * 100) + '%"></span></span><span class="num">' + langCount[l] + '</span></div>';
          }).join('') + '</div><p class="small muted">Anzahl Unterweisungen mit dieser Sprachfassung.</p></section>' +
        '<section class="card"><h3>Was das Cockpit bewusst nicht zeigt</h3><ul class="checklist" style="margin-top:10px">' +
          '<li><span>Keine Auswertung einzelner Personen: Quiz-Antworten sind anonym und nur als Summe sichtbar.</span></li>' +
          '<li><span>Keine Sprachaufnahmen: Audio wird nur im Arbeitsspeicher verarbeitet und nicht gespeichert.</span></li>' +
          '<li><span>Keine Leistungs- oder Verhaltenskontrolle – das hält das System außerhalb der Hochrisiko-Kategorie der KI-Verordnung.</span></li>' +
        '</ul></section>' +
      '</div>';
  };

  // ------------------------------------------------------------------
  // Vorbereitete Unterweisungen (Inhalt für den Start-Modus)
  // ------------------------------------------------------------------
  function allItems() {
    return D.fremdfirmen.rules.map(function (r) { return { id: r.id, label: 'Fremdfirmen · ' + r.title.de + ': ' + r.text.de }; })
      .concat(D.kernsaetze.map(function (k) { return { id: k.id, label: k.cat + ' · ' + k.de }; }));
  }
  function itemLabel(id) { var it = allItems().filter(function (x) { return x.id === id; })[0]; return it ? it.label : id; }
  function pgById(id) { return S.programs.filter(function (p) { return p.id === id; })[0]; }

  views.unterweisungen = function (root) {
    var quizzes = D.quiz.concat(D.fremdfirmen.quiz);
    root.innerHTML =
      '<div class="card-head"><div><span class="label">Verwaltung</span><h2 style="font-size:1.8rem">Vorbereitete Unterweisungen</h2>' +
      '<p class="small muted">Was hier steht, erscheint im Start-Modus als Kachel. Inhalte sind geprüfte Kernsätze und Fremdfirmen-Regeln – sie werden ohne Live-Übersetzung gesendet.</p></div>' +
      '<div class="row"><button class="btn" data-action="pg-reset">Standard wiederherstellen</button><button class="btn primary" data-action="pg-new">Neue Unterweisung</button></div></div>' +
      '<div class="stack">' + S.programs.map(function (p) {
        var rest = allItems().filter(function (x) { return p.items.indexOf(x.id) < 0; });
        return '<section class="card"><div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">' +
          '<label class="field"><span class="label">Titel</span><input type="text" data-pg="' + esc(p.id) + '" data-field="title" value="' + esc(p.title) + '"></label>' +
          '<label class="field"><span class="label">Untertitel</span><input type="text" data-pg="' + esc(p.id) + '" data-field="sub" value="' + esc(p.sub || '') + '"></label>' +
          '<label class="field"><span class="label">Art</span><select data-pg="' + esc(p.id) + '" data-field="type"><option value="briefing"' + (p.type !== 'fremdfirma' ? ' selected' : '') + '>Unterweisung / Briefing</option><option value="fremdfirma"' + (p.type === 'fremdfirma' ? ' selected' : '') + '>Fremdfirmen (mit Einweisungs-Pass)</option></select></label>' +
          '<label class="field"><span class="label">Verständnisfrage</span><select data-pg="' + esc(p.id) + '" data-field="quiz"><option value="">keine</option>' + quizzes.map(function (q) { return '<option value="' + q.id + '"' + (p.quiz === q.id ? ' selected' : '') + '>' + esc(q.q.de) + '</option>'; }).join('') + '</select></label>' +
          '</div><h3 style="margin:14px 0 6px">Ablauf</h3>' +
          (p.items.length ? '<ol class="pg-items">' + p.items.map(function (id, i) {
            return '<li><span class="grow">' + esc(itemLabel(id)) + '</span><span class="row" style="flex-wrap:nowrap">' +
              '<button class="btn sm" data-action="pg-move" data-pg="' + esc(p.id) + '" data-i="' + i + '" data-dir="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Nach oben">↑</button>' +
              '<button class="btn sm" data-action="pg-move" data-pg="' + esc(p.id) + '" data-i="' + i + '" data-dir="1"' + (i === p.items.length - 1 ? ' disabled' : '') + ' aria-label="Nach unten">↓</button>' +
              '<button class="btn sm danger" data-action="pg-remove" data-pg="' + esc(p.id) + '" data-i="' + i + '">Entfernen</button></span></li>';
          }).join('') + '</ol>' : '<p class="empty">Keine vorbereiteten Punkte – im Start-Modus wird frei gesprochen.</p>') +
          '<div class="row" style="margin-top:8px"><label class="sr-only" for="pg-add-' + esc(p.id) + '">Punkt hinzufügen</label><select id="pg-add-' + esc(p.id) + '" class="grow" style="width:auto;min-width:0">' +
            rest.map(function (x) { return '<option value="' + x.id + '">' + esc(x.label) + '</option>'; }).join('') + '</select>' +
            '<button class="btn" data-action="pg-add" data-pg="' + esc(p.id) + '"' + (rest.length ? '' : ' disabled') + '>Hinzufügen</button>' +
            (S.programs.length > 1 ? '<button class="btn ghost danger" data-action="pg-delete" data-pg="' + esc(p.id) + '">Unterweisung löschen</button>' : '') + '</div>' +
          '</section>';
      }).join('') + '</div>' +
      '<p class="small muted" style="margin-top:12px">Neue Kernsätze kommen über das Werks-Glossar und die fachliche Freigabe hinzu (im Prototyp fest hinterlegt).</p>';
  };

  Object.assign(SB.ACTIONS, {
    'pg-move': function (el) {
      var p = pgById(el.dataset.pg); if (!p) return;
      var i = Number(el.dataset.i), j = i + Number(el.dataset.dir);
      if (j < 0 || j >= p.items.length) return;
      var t = p.items[i]; p.items[i] = p.items[j]; p.items[j] = t;
      H.persist(); SB.render();
    },
    'pg-remove': function (el) { var p = pgById(el.dataset.pg); if (!p) return; p.items.splice(Number(el.dataset.i), 1); H.persist(); SB.render(); },
    'pg-add': function (el) {
      var p = pgById(el.dataset.pg); var sel = $('#pg-add-' + el.dataset.pg);
      if (!p || !sel || !sel.value) return;
      p.items.push(sel.value); H.persist(); SB.render();
    },
    'pg-new': function () {
      S.programs.push({ id: 'p' + Date.now().toString(36), type: 'briefing', picto: 'achtung', title: 'Neue Unterweisung', sub: '', items: [], quiz: null });
      H.persist(); SB.render();
    },
    'pg-delete': function (el) {
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Wirklich löschen?'; return; }
      S.programs = S.programs.filter(function (p) { return p.id !== el.dataset.pg; });
      H.persist(); SB.render();
    },
    'pg-reset': function (el) {
      if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Wirklich zurücksetzen?'; return; }
      S.programs = JSON.parse(JSON.stringify(D.programs)); H.persist(); SB.render();
    }
  });

  function onProgramChange(el) {
    var p = pgById(el.dataset.pg); if (!p) return false;
    var f = el.dataset.field;
    if (f === 'title' || f === 'sub') p[f] = el.value.slice(0, 80);
    else if (f === 'type') { p.type = el.value === 'fremdfirma' ? 'fremdfirma' : 'briefing'; p.picto = p.type === 'fremdfirma' ? 'erlaubnis' : p.picto; }
    else if (f === 'quiz') p.quiz = el.value || null;
    H.persist();
    return true;
  }

  // ------------------------------------------------------------------
  // System & Datenschutz
  // ------------------------------------------------------------------
  views.system = function (root) {
    var st = E.state, h = st.edge.health;
    var current = st.edge.available ? 'edge' : (st.claude.sample ? 'online' : 'browser');
    function relRow(id, name, desc) {
      return '<label class="toggle"><input type="radio" name="release" value="' + id + '"' + (S.settings.release === id ? ' checked' : '') + '><span><b>' + esc(name) + '</b><br><span class="small muted">' + esc(desc) + '</span></span></label>';
    }
    function engRow(id, name, desc, ok, detail) {
      return '<label class="toggle"><input type="radio" name="engine" value="' + id + '"' + (S.settings.engine === id ? ' checked' : '') + (ok || id === 'auto' ? '' : ' disabled') + '>' +
        '<span><b>' + esc(name) + '</b> ' + (id === 'auto' ? '' : H.statusPill(ok ? 'green' : 'grey', ok ? 'verfügbar' : 'nicht verfügbar')) + '<br><span class="small muted">' + esc(desc) + (detail ? ' · ' + esc(detail) : '') + '</span></span></label>';
    }
    root.innerHTML =
      '<div class="card-head"><div><span class="label">System und Datenschutz</span><h2 style="font-size:1.8rem">Lokal im Werk. Prüfbar für Betriebsrat und Datenschutz.</h2></div></div>' +
      '<div class="modes">' +
        '<div class="mode' + (current === 'edge' ? ' current' : '') + '"><span class="label">Empfohlen für den Pilot</span><h3>Edge-Server im Werk</h3><p class="small">Laptop oder Industrie-PC in der Halle, eigenes WLAN. Spracherkennung, Übersetzung und Prüfung laufen lokal, ohne Internet. Keine Daten verlassen das Werksgelände.</p></div>' +
        '<div class="mode"><span class="label">Alternative</span><h3>EU-Cloud mit Glossar</h3><p class="small">Schneller Start mit einem europäischen Anbieter. Braucht AV-Vertrag, Prüfung der Unterauftragnehmer und Freigabe durch die Informationssicherheit.</p></div>' +
        '<div class="mode' + (current !== 'edge' ? ' current' : '') + '"><span class="label">Jetzt aktiv</span><h3>' + (current === 'online' ? 'Online-Demo' : 'Demo im Browser') + '</h3><p class="small">' +
          (current === 'online' ? 'Zum Vorführen: freie Sätze werden über Claude übersetzt (Cloud). Nicht für echte Betriebsdaten.' : 'Geprüfte Kernsätze und Prüf-Demo laufen vollständig im Browser, ohne Server.') + '</p></div>' +
      '</div>' +
      '<div class="two-col wide-left" style="margin-top:16px">' +
        '<section class="card"><h3 style="margin-bottom:6px">Übersetzungs-Engine für freie Sätze</h3>' +
          engRow('auto', 'Automatisch', 'Edge-Server vor Browser vor Online-Demo', true) +
          engRow('edge', 'Edge-Server im Werk', 'LibreTranslate, lokales Sprachmodell (z. B. über Ollama) oder EU-Anbieter – Einstellung am Server', E.available('edge'),
            h ? 'Engine: ' + h.engine.name + (h.backEngine ? ', Rückübersetzung: ' + h.backEngine.name : '') + (h.stt && h.stt.configured ? ', Spracherkennung lokal' : '') : 'nicht verbunden') +
          engRow('browser', 'Übersetzer im Browser', 'On-device-Übersetzung des Browsers, z. B. Chrome', E.available('browser'), st.browser.checked ? '' : 'wird geprüft') +
          engRow('claude', 'Online-Demo-Engine', 'Claude über claude.ai – nur zum Vorführen, Cloud', E.available('claude'), '') +
          '<p class="small muted" style="margin-top:8px">Geprüfte Kernsätze und die Prüf-Demo funktionieren immer, auch ohne Engine.</p></section>' +
        '<section class="card"><h3 style="margin-bottom:6px">Freigaberegeln</h3>' +
          '<p class="small" style="margin:4px 0 2px"><b>Nach dem Sprechen</b> – wie wird eine Ansage freigegeben?</p>' +
          relRow('confirm', 'Rückübersetzung prüfen, dann „Senden“ antippen', 'Standard. Die Führungskraft sieht und hört, wie der Satz zurückkommt, und gibt ihn frei – wie das Readback in der Luftfahrt.') +
          relRow('readback', 'Hände frei: vorlesen, dann automatisch senden', 'Nur bei Grün. Nach dem Vorlesen bleiben fünf Sekunden zum Stoppen. Gelb braucht immer einen Tipp, Rot bleibt gesperrt.') +
          relRow('auto', 'Grün sofort senden', 'Ohne Rückfrage. Nur mit erprobter Engine und erfahrener Führungskraft.') +
          '<label class="toggle"><input type="checkbox" id="set-readback"' + (S.settings.readBack ? ' checked' : '') + '><span><b>Rückübersetzung auf Deutsch vorlesen</b><br><span class="small muted">Die Führungskraft hört, was ankommt, ohne auf den Bildschirm zu schauen. Nutzt die deutsche Stimme des Geräts.</span></span></label>' +
          '<label class="toggle"><span style="width:18px"></span><span class="grow"><b>Notfallbegriffe in freien Sätzen</b><br><select id="set-emerg" style="width:auto;margin-top:4px"><option value="warn"' + (S.settings.emergencyPolicy === 'warn' ? ' selected' : '') + '>Gelb: Bestätigung nötig</option><option value="block"' + (S.settings.emergencyPolicy === 'block' ? ' selected' : '') + '>Rot: sperren, nur Kernsätze</option></select></span></label>' +
          '<label class="toggle"><span style="width:18px"></span><span class="grow"><b>Mindest-Übereinstimmung der Rückübersetzung: <span id="sim-val">' + Math.round(S.settings.minSimilarity * 100) + ' %</span></b><br><input id="set-sim" type="range" min="0.15" max="0.6" step="0.05" value="' + S.settings.minSimilarity + '" style="width:100%"></span></label>' +
          '<label class="toggle"><input type="checkbox" id="set-simdev"' + (S.settings.sim ? ' checked' : '') + '><span><b>Simulierte Belegschaft</b><br><span class="small muted">Für Vorführungen: simulierte Geräte bestätigen und beantworten Fragen. Im Nachweis gekennzeichnet.</span></span></label>' +
        '</section>' +
      '</div>' +
      '<section class="card" style="margin-top:16px"><h3 style="margin-bottom:10px">So läuft eine Ansage</h3><div class="arch">' +
        '<div class="node"><b>Führungskraft</b>Headset mit Nahbesprechungs-Mikrofon oder Tablet</div><span class="arrow">→</span>' +
        '<div class="node edge"><b>Edge-Server</b>1 Spracherkennung (lokal)<br>2 Übersetzung mit Werks-Glossar<br>3 Rückübersetzung (zweite Engine)<br>4 Sinnvergleich: Verneinung, Gegenteil, Zahlen, Fachbegriffe</div><span class="arrow">→</span>' +
        '<div class="node"><b>Freigabe (Readback)</b>Führungskraft sieht und hört die Rückübersetzung<br>Grün: senden · Gelb: bestätigen · Rot: gesperrt</div><span class="arrow">→</span>' +
        '<div class="node"><b>Ausgabe</b>Hallen-Display · Handy per QR · Smart-Brille · Ton in den Gehörschutz</div><span class="arrow">→</span>' +
        '<div class="node"><b>Nachweis</b>Verständnisfrage anonym · Teilnahme · Dokument</div>' +
      '</div></section>' +
      '<section class="card" style="margin-top:16px"><div class="card-head"><h3>Steckbrief für Betriebsrat und Datenschutz</h3><span class="pill grey">Entwurf</span></div><div class="table-wrap"><table class="rtable">' +
        '<thead><tr><th>Daten</th><th>Zweck</th><th>Ort</th><th>Speicherdauer</th></tr></thead><tbody>' +
        '<tr><td>Sprache der Führungskraft (Audio)</td><td data-label="Zweck">Spracherkennung</td><td data-label="Ort">Arbeitsspeicher Edge-Server</td><td data-label="Speicherdauer">keine Speicherung, nur während der Erkennung</td></tr>' +
        '<tr><td>Ansagen und Übersetzungen (Text)</td><td data-label="Zweck">Anzeige, Nachweis der Inhalte</td><td data-label="Ort">Edge-Server, Nachweis-Dokument</td><td data-label="Speicherdauer">wie Unterweisungsnachweise (betrieblich festlegen)</td></tr>' +
        '<tr><td>Teilnahme (Name, Firma, Sprache, Datum)</td><td data-label="Zweck">Nachweis nach § 12 BetrSichV, § 4 DGUV Vorschrift 1</td><td data-label="Ort">Nachweis-Dokument</td><td data-label="Speicherdauer">betriebliche Aufbewahrungsfrist</td></tr>' +
        '<tr><td>Antworten auf Verständnisfragen</td><td data-label="Zweck">Wirksamkeit der Unterweisung</td><td data-label="Ort">nur als Summe</td><td data-label="Speicherdauer">keine Einzelwerte gespeichert</td></tr>' +
        '<tr><td>Rückmeldungen „nicht verstanden“</td><td data-label="Zweck">Unterweisung verbessern</td><td data-label="Ort">Leitstand, anonym</td><td data-label="Speicherdauer">Ende der Sitzung</td></tr>' +
        '</tbody></table></div>' +
        '<ul class="checklist" style="margin-top:12px">' +
          '<li><span>Keine Leistungs- oder Verhaltenskontrolle, keine Sprechererkennung, keine Stimmprofile.<span class="src">§ 87 Abs. 1 Nr. 6 BetrVG – Betriebsvereinbarung trotzdem empfohlen</span></span></li>' +
          '<li><span>KI-Übersetzungen sind auf allen Geräten gekennzeichnet; synthetische Stimmen ebenso.<span class="src">Art. 50 KI-VO</span></span></li>' +
          '<li><span>Lokaler Betrieb ohne Zugriff des Anbieters: in der Regel keine Auftragsverarbeitung; bei Cloud: AV-Vertrag und Prüfung der Unterauftragnehmer.<span class="src">Art. 28 DSGVO, DSK-Kurzpapier Nr. 13</span></span></li>' +
          '<li><span>Die Verantwortung für die Unterweisung bleibt bei der Führungskraft; das System unterstützt, ersetzt sie nicht.<span class="src">§ 12 ArbSchG, DGUV Information 211-005</span></span></li>' +
        '</ul><p class="small muted" style="margin-top:8px">Keine Rechtsberatung. Vor dem Pilot mit Datenschutz, Informationssicherheit und Betriebsrat abstimmen.</p></section>' +
      '<section class="card" style="margin-top:16px"><div class="row"><div class="grow"><h3>Demo zurücksetzen</h3><p class="small muted">Löscht Glossar-Änderungen, neue Nachweise und Fremdfirmen auf diesem Gerät.</p></div><button class="btn danger" data-action="reset-demo">Zurücksetzen</button></div></section>';
  };

  SB.onChange = function (el) {
    if (el.dataset && el.dataset.pg && onProgramChange(el)) return;
    if (el.name === 'engine') { S.settings.engine = el.value; H.persist(); SB.renderModeChip(); return; }
    if (el.name === 'release') S.settings.release = el.value;
    else if (el.id === 'set-readback') S.settings.readBack = el.checked;
    else if (el.id === 'set-emerg') S.settings.emergencyPolicy = el.value;
    else if (el.id === 'set-sim') S.settings.minSimilarity = Number(el.value);
    else if (el.id === 'set-simdev') S.settings.sim = el.checked;
    else return;
    H.persist();
  };
  document.addEventListener('input', function (e) {
    if (e.target.id === 'set-sim') { var v = $('#sim-val'); if (v) v.textContent = Math.round(Number(e.target.value) * 100) + ' %'; }
    if (e.target.id === 'gl-q') { S.glFilter.q = e.target.value; renderGlossaryTable(); }
  });

  SB.ACTIONS['reset-demo'] = function (el) {
    if (el.dataset.confirm !== '1') { el.dataset.confirm = '1'; el.textContent = 'Wirklich zurücksetzen?'; return; }
    try { localStorage.removeItem('safebriefing.v1'); } catch (e) { /* ignorieren */ }
    S.glossary = JSON.parse(JSON.stringify(D.glossary));
    S.contractors = JSON.parse(JSON.stringify(D.demo.contractors));
    S.sessions = JSON.parse(JSON.stringify(D.demo.sessions));
    S.findings = [];
    S.programs = JSON.parse(JSON.stringify(D.programs));
    S.settings = { engine: 'auto', release: 'confirm', readBack: true, emergencyPolicy: 'warn', minSimilarity: 0.3, sim: true };
    SB.render();
  };

  SB.refreshAdmin = function (what) {
    if (S.route === 'fremdfirmen' && what === 'all') renderContractors();
  };
})();

/*
 * SafeBriefing – Sinnvergleich ("Guardrail")
 *
 * Prüft je Zielsprache die Übersetzung und ihre Rückübersetzung gegen den
 * deutschen Ausgangssatz. Läuft vollständig lokal (Browser oder Node), ohne
 * Netz und ohne KI-Modell: Die Regeln sind deterministisch und damit für
 * Sifa und Betriebsrat nachvollziehbar.
 *
 * Ergebnis je Sprache:  green  = Sinn geprüft, freigabefähig
 *                       yellow = Führungskraft muss Rückübersetzung bestätigen
 *                       red    = gesperrt (Sinnverkehrung, Zahl falsch, unzulässiger Begriff)
 *
 * Die Prüfung senkt das Risiko, schließt Fehler aber nicht aus. Notfall- und
 * Warnhinweise gehören deshalb als vorab geprüfte Kernsätze ins System.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SBGuardrail = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Normalisierung
  // ---------------------------------------------------------------------

  var ARABIC_DIGITS = /[٠-٩۰-۹]/g;

  function westernDigits(s) {
    return String(s).replace(ARABIC_DIGITS, function (d) {
      var c = d.charCodeAt(0);
      return String(c >= 0x06F0 ? c - 0x06F0 : c - 0x0660);
    });
  }

  // Mehrwort-Wendungen vor dem Zerlegen zusammenziehen, damit sie als ein
  // Begriff geprüft werden ("stehen bleiben", "unter Spannung").
  var PHRASES = [
    [/\bunter\s+spannung\s+setz/g, 'unterspannungsetz'],
    [/\bunter\s+spannung/g, 'unterspannung'],
    [/\bstehen\s+bleib/g, 'stehenbleib'],
    [/\bbleib(?:en|t|e)?\s+(?:sie\s+|du\s+)?stehen\b/g, 'stehenbleiben'],
    [/\bin\s+betrieb\s+nehm/g, 'inbetriebnehm'],
    [/\bin\s+betrieb\s+genommen/g, 'inbetriebgenommen'],
    [/\bin\s+betrieb\s+setz/g, 'inbetriebnehm'],
    [/\bweiter\s+(geh|fahr|lauf|arbeit)/g, 'weiter$1'],
    // Vergleiche sind keine Verneinung: "nicht mehr als 6 km/h" = "höchstens 6 km/h"
    [/\bnicht\s+(?:mehr|schneller|länger|höher|weiter|größer|über)\s+als\b/g, 'höchstens'],
    [/\bnicht\s+(?:mehr|schneller|länger|höher|größer)\s+(?=\d)/g, 'höchstens '],
    [/\bnicht\s+(?:weniger|kürzer|langsamer|niedriger)\s+als\b/g, 'mindestens']
  ];

  function normDE(text) {
    var s = westernDigits(String(text || '')).toLowerCase();
    s = s.replace(/[‐-―\-]/g, '');          // Not-Halt -> nothalt
    for (var i = 0; i < PHRASES.length; i++) s = s.replace(PHRASES[i][0], PHRASES[i][1]);
    return s.replace(/\s+/g, ' ').trim();
  }

  // Fasst Sprachen zusammen, deren Rückübersetzung (normalisiert) gleich ist – für die Freigabe-Ansicht
  // und das Vorlesen: gleiche Rückübersetzung nur einmal zeigen bzw. sprechen.
  function groupBacks(source, results, langs) {
    var src = normDE(source), groups = [];
    (langs || Object.keys(results || {})).forEach(function (l) {
      var r = results && results[l] ? results[l] : {};
      var back = String(r.back || '').trim();
      var key = normDE(back);
      var g = null;
      for (var i = 0; i < groups.length; i++) if (groups[i].key === key) { g = groups[i]; break; }
      if (!g) { g = { key: key, back: back, langs: [], same: !!key && key === src }; groups.push(g); }
      g.langs.push(l);
    });
    return groups;
  }

  function tokens(norm) {
    return norm.match(/[\p{L}\p{N}]+/gu) || [];
  }

  function normTarget(text, lang) {
    var s = westernDigits(String(text || ''));
    s = lang === 'tr' ? s.toLocaleLowerCase('tr') : s.toLowerCase();
    s = s.normalize('NFD').replace(/\p{M}/gu, '');     // Diakritika (ş/ș, ą, й ...) angleichen
    if (lang === 'ar') {
      s = s.replace(/[ً-ْٰـ]/g, '')  // Taschkil, Tatweel
           .replace(/[آأإ]/g, 'ا')    // Alif-Formen
           .replace(/ة/g, 'ه')
           .replace(/ى/g, 'ي');
    }
    s = s.replace(/[‐-―\-]/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }

  // ---------------------------------------------------------------------
  // Bausteine der Prüfung
  // ---------------------------------------------------------------------

  // Verneinungen und Verbote. Gezählt wird die Parität: "nicht ohne Brille"
  // (2) ist dieselbe Aussage wie "nur mit Brille" (0).
  var NEGATIONS = {
    nicht: 1, kein: 1, keine: 1, keinen: 1, keinem: 1, keiner: 1, keines: 1,
    nie: 1, niemals: 1, nirgends: 1, nirgendwo: 1, nichts: 1, weder: 1,
    verboten: 1, untersagt: 1, unzulässig: 1, ohne: 1, verbot: 1
  };

  function negationCount(toks) {
    var n = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (NEGATIONS[t] || (t.length > 6 && /verbot$/.test(t))) n++;
    }
    return n;
  }

  // Gegensatzpaare: Taucht im Ausgangssatz nur Seite A auf und in der
  // Rückübersetzung nur Seite B, ist der Sinn verkehrt.
  var OPPOSITES = [
    { id: 'schalten', critical: true,
      a: { label: 'ausschalten / freischalten', pre: ['ausschalt', 'ausgeschalt', 'abschalt', 'abgeschalt', 'freischalt', 'freigeschalt', 'stillsetz', 'stillgesetzt', 'spannungsfrei', 'stromlos', 'trenn', 'getrennt', 'abklemm', 'deaktivier'] },
      b: { label: 'einschalten', pre: ['einschalt', 'eingeschalt', 'anschalt', 'angeschalt', 'inbetriebnehm', 'inbetriebgenomm', 'zuschalt', 'zugeschalt', 'unterspannungsetz', 'anfahr', 'angefahr', 'aktivier'] } },
    { id: 'bewegung', critical: true,
      a: { label: 'anhalten / stehen bleiben', pre: ['anhalt', 'angehalt', 'stehenbleib', 'stillsteh', 'stopp'] },
      b: { label: 'weitergehen / weiterfahren', pre: ['weitergeh', 'weitergegang', 'weiterfahr', 'weitergefahr', 'weiterlauf', 'weiterarbeit', 'losfahr', 'losgeh'] } },
    { id: 'tempo',
      a: { label: 'langsam', pre: ['langsam', 'schrittgeschwindigkeit', 'schritttempo', 'schrittempo'] },
      b: { label: 'schnell', pre: ['schnell', 'zügig', 'eilig', 'rasch'] } },
    { id: 'oeffnen',
      a: { label: 'öffnen', pre: ['öffn', 'geöffn', 'offen', 'aufmach', 'aufgemacht'] },
      b: { label: 'schließen', pre: ['schließ', 'schliess', 'geschloss', 'verschließ', 'verschloss', 'zumach', 'zugemacht'] } },
    { id: 'heben',
      a: { label: 'anheben', pre: ['anheb', 'angehob', 'hochheb', 'hochgehob', 'heben', 'hebt', 'gehoben'] },
      b: { label: 'absenken', pre: ['absenk', 'abgesenkt', 'senken', 'senkt', 'gesenkt', 'herablass', 'ablass', 'abgelass'] } },
    { id: 'seite',
      a: { label: 'links', exact: ['links', 'linke', 'linken', 'linker', 'linkes'] },
      b: { label: 'rechts', exact: ['rechts', 'rechte', 'rechten', 'rechter', 'rechtes'] } },
    { id: 'hoehe',
      a: { label: 'oben', exact: ['oben', 'obere', 'oberen', 'oberer', 'oberes'] },
      b: { label: 'unten', exact: ['unten', 'untere', 'unteren', 'unterer', 'unteres'] } },
    { id: 'zutritt', critical: true,
      a: { label: 'betreten', pre: ['betret', 'betrit', 'eintret', 'eingetret', 'hineingeh', 'reingeh', 'einsteig', 'eingestieg'] },
      b: { label: 'verlassen', pre: ['verlass', 'verließ', 'hinausgeh', 'rausgeh', 'austret', 'ausgetret', 'aussteig', 'ausgestieg'] } },
    { id: 'sperre', critical: true,
      a: { label: 'sperren / verriegeln', pre: ['verriegel', 'sperr', 'gesperrt', 'absperr', 'abgesperrt', 'blockier'] },
      b: { label: 'freigeben / entriegeln', pre: ['entriegel', 'freigeb', 'freigegeb', 'freigab', 'entsperr'] } },
    { id: 'spannung', critical: true,
      a: { label: 'spannungsfrei', pre: ['spannungsfrei', 'spannungslos', 'stromlos'] },
      b: { label: 'unter Spannung', pre: ['spannungsführ', 'unterspannung', 'stromführ'] } }
  ];

  function sideHit(toks, side) {
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (side.exact && side.exact.indexOf(t) >= 0) return t;
      if (side.pre) for (var j = 0; j < side.pre.length; j++) if (t.indexOf(side.pre[j]) === 0) return t;
    }
    return null;
  }

  function numbersIn(text) {
    var s = westernDigits(String(text || ''));
    var m = s.match(/\d+(?:[.,]\d+)?/g) || [];
    return m.map(function (x) { return x.replace(',', '.').replace(/\.0+$/, ''); });
  }

  var STOP = toSet(('der die das den dem des ein eine einen einem einer eines und oder aber auch als am an auf aus bei bis da dann dass mit nach noch nur ob so um von vor wie wo zu zum zur im in ist sind sein seid war wird werden wurde sie ihr wir ich er es man sich bitte heute hier dort alle allen jeder jede jedes immer sofort ganz sehr mehr diese dieser dieses diesem diesen über unter durch für gegen ohne beim vom mal schon kann können muss müssen darf dürfen soll sollen haben hat habe' ).split(' '));
  // "ohne", "nicht" & Co. bleiben trotzdem in der Verneinungsprüfung.

  function toSet(arr) { var o = Object.create(null); arr.forEach(function (w) { if (w) o[w] = 1; }); return o; }

  function stem(t) { return t.length > 6 ? t.slice(0, 6) : t; }

  function contentStems(text) {
    var toks = tokens(normDE(text));
    var out = Object.create(null);
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t.length < 3 || STOP[t] || /^\d+$/.test(t)) continue;
      out[stem(t)] = 1;
    }
    return Object.keys(out);
  }

  // Dice-Koeffizient auf Wortstämmen: 1 = gleiche Inhaltswörter, 0 = nichts gemeinsam.
  function similarity(a, b) {
    var A = contentStems(a), B = contentStems(b);
    if (!A.length && !B.length) return 1;
    if (!A.length || !B.length) return 0;
    var setB = toSet(B), common = 0;
    for (var i = 0; i < A.length; i++) if (setB[A[i]]) common++;
    return (2 * common) / (A.length + B.length);
  }

  var EMERGENCY = /(^|[^\p{L}])(feuer|brand|evakuier|räum|notfall|alarm|gasaustritt|explosion|sammelstelle|verletz)/u;

  var SCRIPT = { bg: /\p{Script=Cyrillic}/u, uk: /\p{Script=Cyrillic}/u, ru: /\p{Script=Cyrillic}/u, ar: /\p{Script=Arabic}/u, el: /\p{Script=Greek}/u };

  // ---------------------------------------------------------------------
  // Glossar
  // ---------------------------------------------------------------------

  // Ein Eintrag: { id, de, match:[...], exclude:[...], critical, t: { pl: { term, match:[...], forbidden:[...] } } }
  // match-Muster auf Deutsch greifen am Wortanfang (auch in Komposita: "Not-Halt-Taster").
  function glossaryHits(source, glossary) {
    var s = normDE(source);
    var hits = [];
    (glossary || []).forEach(function (g) {
      var pats = (g.match && g.match.length ? g.match : [g.de]).map(normDE);
      var excl = (g.exclude || []).map(normDE);   // z. B. "Notausgang" ist kein "Not-Aus"
      for (var i = 0; i < pats.length; i++) {
        var re = new RegExp('(^|[^\\p{L}])(' + escapeRe(pats[i]) + '[\\p{L}]*)', 'gu');
        var m;
        while ((m = re.exec(s))) {
          var word = m[2];
          if (!excl.some(function (e) { return word.indexOf(e) === 0; })) { hits.push(g); return; }
        }
      }
    });
    return hits;
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function containsAny(normText, patterns, lang) {
    for (var i = 0; i < (patterns || []).length; i++) {
      var p = normTarget(patterns[i], lang);
      if (p && normText.indexOf(p) >= 0) return patterns[i];
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Hauptprüfung
  // ---------------------------------------------------------------------

  var DEFAULTS = {
    minSimilarity: 0.3,          // darunter: Rückübersetzung weicht deutlich ab (gelb)
    infoSimilarity: 0.5,         // darunter: Hinweis
    lengthRatio: [0.4, 2.8],     // Übersetzung auffällig kurz/lang (gelb)
    emergencyPolicy: 'warn'      // Notfallbegriffe im Live-Text: 'warn' | 'block'
  };

  function analyze(input) {
    var source = String(input.source || '');
    var translation = String(input.translation || '');
    var back = String(input.back || '');
    var lang = input.lang;
    var origin = input.origin || 'live';
    var opt = Object.assign({}, DEFAULTS, input.options || {});
    var checks = [];

    function add(id, level, title, detail) { checks.push({ id: id, level: level, title: title, detail: detail || '' }); }

    if (origin === 'kernsatz') {
      add('kernsatz', 'ok', 'Vorab geprüfter Kernsatz', 'Übersetzung fachlich freigegeben und von Muttersprachlern geprüft – keine Live-Übersetzung.');
    }

    if (!translation.trim()) {
      add('leer', 'block', 'Keine Übersetzung', 'Die Engine hat für diese Sprache nichts geliefert.');
      return finish();
    }

    var srcNorm = normDE(source), backNorm = normDE(back);
    var srcTok = tokens(srcNorm), backTok = tokens(backNorm);
    var trNorm = normTarget(translation, lang);

    // 1. Nicht übersetzt
    if (lang !== 'de' && trNorm === normTarget(source, lang)) {
      add('unuebersetzt', 'block', 'Nicht übersetzt', 'Die Ausgabe ist identisch mit dem deutschen Text.');
    } else if (SCRIPT[lang]) {
      var letters = translation.match(/\p{L}/gu) || [];
      var inScript = letters.filter(function (c) { return SCRIPT[lang].test(c); }).length;
      if (letters.length && inScript / letters.length < 0.5) {
        add('schrift', 'warn', 'Falsche Schrift', 'Der Text ist überwiegend nicht in der Schrift der Zielsprache.');
      }
    }

    // 2. Verneinung (Parität)
    if (back.trim()) {
      var nSrc = negationCount(srcTok), nBack = negationCount(backTok);
      if (nSrc % 2 !== nBack % 2) {
        add('verneinung', 'block', 'Verneinung verändert',
          nSrc % 2 ? 'Der Ausgangssatz enthält ein Verbot oder eine Verneinung, die Rückübersetzung nicht.'
                   : 'Die Rückübersetzung enthält eine Verneinung, die im Ausgangssatz fehlt.');
      } else if (nSrc > 0) {
        add('verneinung', 'ok', 'Verneinung erhalten', '');
      }
    }

    // 3. Gegensatzpaare
    if (back.trim()) {
      OPPOSITES.forEach(function (p) {
        var sa = sideHit(srcTok, p.a), sb = sideHit(srcTok, p.b);
        var ba = sideHit(backTok, p.a), bb = sideHit(backTok, p.b);
        if (sa && !sb && bb && !ba) {
          add('gegenteil-' + p.id, 'block', 'Sinnverkehrung', '»' + sa + '« kommt rückübersetzt als »' + bb + '« zurück – das Gegenteil.');
        } else if (sb && !sa && ba && !bb) {
          add('gegenteil-' + p.id, 'block', 'Sinnverkehrung', '»' + sb + '« kommt rückübersetzt als »' + ba + '« zurück – das Gegenteil.');
        } else if (p.critical && ((sa && !sb && !ba && !bb) || (sb && !sa && !ba && !bb))) {
          add('handlung-' + p.id, 'warn', 'Handlung nicht wiedergefunden', '»' + (sa || sb) + '« taucht in der Rückübersetzung nicht auf.');
        }
      });
    }

    // 4. Zahlen und Werte
    var nums = numbersIn(source);
    if (nums.length) {
      var trNums = numbersIn(translation), backNums = numbersIn(back);
      var missingTr = nums.filter(function (n) { return trNums.indexOf(n) < 0; });
      var missingBack = nums.filter(function (n) { return backNums.indexOf(n) < 0; });
      if (missingTr.length) {
        add('zahlen', 'block', 'Zahl oder Wert abweichend',
          'Fehlt in der Übersetzung: ' + missingTr.join(', ') + (trNums.length ? ' (gefunden: ' + trNums.join(', ') + ')' : ''));
      } else if (back.trim() && missingBack.length) {
        add('zahlen', 'warn', 'Zahl in Rückübersetzung abweichend', 'Fehlt: ' + missingBack.join(', '));
      } else {
        add('zahlen', 'ok', 'Zahlen und Werte stimmen', nums.join(', '));
      }
    }

    // 5. Werks-Glossar
    glossaryHits(source, input.glossary).forEach(function (g) {
      var spec = g.t && g.t[lang];
      var label = '»' + g.de + '«';
      if (!spec) {
        add('glossar-' + g.id, g.critical ? 'warn' : 'info', 'Glossar: keine Freigabe für diese Sprache', label + ' hat noch keinen freigegebenen Zielbegriff.');
        return;
      }
      var good = containsAny(trNorm, (spec.match && spec.match.length) ? spec.match : [spec.term], lang);
      // Ein unzulässiger Begriff sperrt nur, wenn der freigegebene fehlt: "freischalten und
      // gegen Wiedereinschalten sichern" enthält zu Recht auch das Wort für "einschalten".
      var bad = good ? null : containsAny(trNorm, spec.forbidden, lang);
      if (bad) {
        add('glossar-' + g.id, 'block', 'Unzulässiger Fachbegriff', label + ' wurde mit »' + bad + '« übersetzt. Freigegeben ist »' + spec.term + '«.');
        return;
      }
      if (good) {
        add('glossar-' + g.id, 'ok', 'Fachbegriff laut Glossar', label + ' → »' + spec.term + '«');
      } else {
        add('glossar-' + g.id, 'warn', 'Fachbegriff nicht wie freigegeben', label + ' sollte »' + spec.term + '« lauten.');
      }
    });

    // 6. Inhaltliche Nähe Ausgangssatz ↔ Rückübersetzung
    var sim = back.trim() ? similarity(source, back) : null;
    if (sim !== null) {
      var pct = Math.round(sim * 100) + ' %';
      if (sim < opt.minSimilarity) add('aehnlichkeit', 'warn', 'Rückübersetzung weicht deutlich ab', 'Übereinstimmung der Inhaltswörter: ' + pct);
      else if (sim < opt.infoSimilarity) add('aehnlichkeit', 'info', 'Rückübersetzung teilweise umformuliert', 'Übereinstimmung der Inhaltswörter: ' + pct);
      else add('aehnlichkeit', 'ok', 'Rückübersetzung inhaltlich nah', 'Übereinstimmung der Inhaltswörter: ' + pct);
    } else if (origin !== 'kernsatz') {
      add('aehnlichkeit', 'warn', 'Keine Rückübersetzung', 'Ohne Rückübersetzung ist keine Sinnprüfung möglich.');
    }

    // 7. Länge
    if (source.length > 12) {
      var ratio = translation.length / source.length;
      if (ratio < opt.lengthRatio[0] || ratio > opt.lengthRatio[1]) {
        add('laenge', 'warn', 'Auffällige Länge', 'Die Übersetzung ist ' + (ratio < 1 ? 'deutlich kürzer' : 'deutlich länger') + ' als der Ausgangssatz.');
      }
    }

    // 8. Notfall- und Warnhinweise nie live
    if (origin !== 'kernsatz' && EMERGENCY.test(srcNorm)) {
      add('notfall', opt.emergencyPolicy === 'block' ? 'block' : 'warn', 'Notfall- oder Warnhinweis live übersetzt', 'Für Notfälle bitte den geprüften Kernsatz verwenden.');
    }

    return finish();

    function finish() {
      var status = 'green';
      checks.forEach(function (c) {
        if (c.level === 'block') status = 'red';
        else if (c.level === 'warn' && status !== 'red') status = 'yellow';
      });
      return { lang: lang, status: status, similarity: sim === undefined ? null : sim, checks: checks };
    }
  }

  function analyzeAll(input) {
    var perLang = {}, counts = { green: 0, yellow: 0, red: 0 };
    Object.keys(input.results || {}).forEach(function (lang) {
      var r = input.results[lang] || {};
      var res = analyze({
        source: input.source, translation: r.text, back: r.back, lang: lang,
        glossary: input.glossary, origin: r.origin || input.origin, options: input.options
      });
      perLang[lang] = res;
      counts[res.status]++;
    });
    var status = counts.red ? 'red' : counts.yellow ? 'yellow' : 'green';
    return { status: status, perLang: perLang, counts: counts };
  }

  // Ähnlichster Kernsatz (für "Meinten Sie …?" und exakte Treffer).
  function matchKernsatz(text, kernsaetze) {
    var key = normKey(text);
    var best = null;
    (kernsaetze || []).forEach(function (k) {
      if (normKey(k.de) === key) { best = { item: k, score: 1, exact: true }; return; }
      if (best && best.exact) return;
      var sc = similarity(text, k.de);
      if (!best || sc > best.score) best = { item: k, score: sc, exact: false };
    });
    return best;
  }

  function normKey(s) { return tokens(normDE(s)).join(' '); }

  return {
    analyze: analyze,
    analyzeAll: analyzeAll,
    glossaryHits: glossaryHits,
    matchKernsatz: matchKernsatz,
    similarity: similarity,
    numbersIn: numbersIn,
    normDE: normDE,
    groupBacks: groupBacks,
    normTarget: normTarget,
    normKey: normKey,
    OPPOSITES: OPPOSITES,
    DEFAULTS: DEFAULTS
  };
});

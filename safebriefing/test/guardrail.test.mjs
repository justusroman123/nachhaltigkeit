// Tests für den Sinnvergleich (Guardrail) und die Demo-Datenbasis
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const G = require('../app/js/guardrail.js');
const D = require('../app/js/data.js');
const LANGS = ['en', 'pl', 'ro', 'tr', 'ar', 'uk', 'el', 'bg', 'ru'];

const check = (source, translation, back, lang, extra = {}) =>
  G.analyze({ source, translation, back, lang, glossary: D.glossary, ...extra });
const levels = (r) => r.checks.filter((c) => c.level === 'block' || c.level === 'warn').map((c) => c.id);

describe('Sinnverkehrung', () => {
  test('freischalten → einschalten wird gesperrt', () => {
    const r = check('Vor Wartungsarbeiten die Anlage freischalten.', 'Przed pracami konserwacyjnymi włącz instalację.', 'Vor Wartungsarbeiten die Anlage einschalten.', 'pl');
    assert.equal(r.status, 'red');
    assert.ok(levels(r).includes('gegenteil-schalten'));
    assert.ok(levels(r).includes('glossar-freischalten'));
  });

  test('„gegen Wiedereinschalten sichern“ ist kein Gegenteil', () => {
    const r = check('Vor Wartungsarbeiten die Anlage freischalten und gegen Wiedereinschalten sichern.',
      'Przed pracami konserwacyjnymi odłącz instalację od zasilania i zabezpiecz ją przed ponownym włączeniem.',
      'Vor Wartungsarbeiten die Anlage von der Stromversorgung trennen und gegen erneutes Einschalten sichern.', 'pl');
    assert.equal(r.status, 'green', JSON.stringify(r.checks));
  });

  test('links/rechts vertauscht wird gesperrt', () => {
    const r = check('Den linken Ausgang benutzen.', 'Use the right exit.', 'Den rechten Ausgang benutzen.', 'en');
    assert.equal(r.status, 'red');
  });

  test('stehen bleiben → weitergehen wird gesperrt', () => {
    const r = check('Wenn der Stapler kommt: stehen bleiben.', 'When the forklift comes: keep walking.', 'Wenn der Stapler kommt: weitergehen.', 'en');
    assert.equal(r.status, 'red');
  });
});

describe('Verneinung', () => {
  test('verlorenes Verbot wird gesperrt', () => {
    const r = check('Den Bereich hinter der Absperrung nicht betreten.', 'Bariyerin arkasındaki alana girin.', 'Betreten Sie den Bereich hinter der Absperrung.', 'tr');
    assert.equal(r.status, 'red');
    assert.ok(levels(r).includes('verneinung'));
  });

  test('„verboten“ und „nicht“ sind gleichwertig', () => {
    const r = check('Betreten verboten.', 'Do not enter.', 'Nicht betreten.', 'en');
    assert.notEqual(r.status, 'red');
  });

  test('„nicht mehr als“ ist ein Vergleich, keine Verneinung', () => {
    const r = check('Im Werk gilt höchstens 6 km/h.', 'On site: no more than 6 km/h.', 'Im Werk gilt nicht mehr als 6 km/h.', 'en');
    assert.ok(!levels(r).includes('verneinung'));
  });

  test('doppelte Verneinung bleibt positiv', () => {
    const r = check('Nur mit Schutzbrille arbeiten.', 'Never work without safety glasses.', 'Nie ohne Schutzbrille arbeiten.', 'en');
    assert.ok(!levels(r).includes('verneinung'));
  });
});

describe('Zahlen', () => {
  test('6 → 60 wird gesperrt', () => {
    const r = check('Höchstens 6 km/h fahren.', 'Conduceți cu maximum 60 km/h.', 'Maximal 60 km/h fahren.', 'ro');
    assert.equal(r.status, 'red');
    assert.ok(levels(r).includes('zahlen'));
  });

  test('arabisch-indische Ziffern werden erkannt', () => {
    assert.deepEqual(G.numbersIn('السرعة ٦ كم/ساعة'), ['6']);
  });

  test('Dezimalkomma und -punkt sind gleich', () => {
    assert.deepEqual(G.numbersIn('2,5 m'), G.numbersIn('2.5 m'));
  });
});

describe('Werks-Glossar', () => {
  test('falscher Fachbegriff ergibt Gelb', () => {
    const r = check('Achtung: Der Gabelstapler fährt rückwärts aus der Halle.', 'انتبه: المركبة الأرضية تخرج من الصالة إلى الخلف.', 'Achtung: Das Bodenfahrzeug fährt rückwärts aus der Halle.', 'ar');
    assert.equal(r.status, 'yellow');
    assert.ok(levels(r).includes('glossar-stapler'));
  });

  test('Not-Halt im Kompositum wird gefunden', () => {
    const hits = G.glossaryHits('Den Not-Halt-Taster drücken.', D.glossary).map((g) => g.id);
    assert.ok(hits.includes('nothalt'));
  });

  test('„Notausgang“ ist kein Not-Halt', () => {
    const hits = G.glossaryHits('Den Notausgang freihalten.', D.glossary).map((g) => g.id);
    assert.ok(!hits.includes('nothalt'));
  });

  test('Diakritika werden angeglichen (ș/ş)', () => {
    assert.equal(G.normTarget('Protecție', 'ro'), G.normTarget('Protecţie', 'ro'));
  });
});

describe('Weitere Regeln', () => {
  test('Notfallbegriffe im Live-Text brauchen Bestätigung', () => {
    const r = check('Bei Feueralarm sofort zur Sammelstelle gehen.', 'W razie alarmu pożarowego natychmiast idź do miejsca zbiórki.', 'Bei Feueralarm sofort zum Sammelpunkt gehen.', 'pl');
    assert.equal(r.status, 'yellow');
    assert.ok(levels(r).includes('notfall'));
  });

  test('Notfall-Regel kann auf Sperren gestellt werden', () => {
    const r = check('Bei Feueralarm sofort zur Sammelstelle gehen.', 'W razie alarmu pożarowego natychmiast idź do miejsca zbiórki.', 'Bei Feueralarm sofort zum Sammelpunkt gehen.', 'pl', { options: { emergencyPolicy: 'block' } });
    assert.equal(r.status, 'red');
  });

  test('nicht übersetzter Text wird gesperrt', () => {
    const r = check('Schutzbrille tragen.', 'Schutzbrille tragen.', 'Schutzbrille tragen.', 'pl');
    assert.equal(r.status, 'red');
  });

  test('falsche Schrift wird erkannt', () => {
    const r = check('Schutzbrille tragen.', 'Schutzbrille tragen bitte', 'Schutzbrille tragen.', 'ru');
    assert.ok(levels(r).includes('schrift'));
  });

  test('fehlende Rückübersetzung ergibt Gelb', () => {
    const r = check('Schutzbrille in der ganzen Halle tragen.', 'W całej hali noś okulary ochronne.', '', 'pl');
    assert.equal(r.status, 'yellow');
  });

  test('analyzeAll fasst zusammen', () => {
    const s = D.scenarios.find((x) => x.id === 's-zahl');
    const results = Object.fromEntries(LANGS.map((l) => [l, { text: s.r[l][0], back: s.r[l][1] }]));
    const a = G.analyzeAll({ source: s.de, results, glossary: D.glossary });
    assert.equal(a.status, 'red');
    assert.equal(a.counts.red, 1);
    assert.equal(a.perLang.ro.status, 'red');
  });

  test('matchKernsatz findet exakte und ähnliche Sätze', () => {
    const k = D.kernsaetze.find((x) => x.id === 'k-nothalt');
    assert.equal(G.matchKernsatz(k.de.toUpperCase(), D.kernsaetze).exact, true);
    const near = G.matchKernsatz('Vor dem Eingreifen den Not-Halt drücken', D.kernsaetze);
    assert.equal(near.item.id, 'k-nothalt');
    assert.ok(near.score >= 0.45);
  });
});

describe('Demo-Datenbasis', () => {
  test('alle Kernsätze sind in allen Sprachen grün', () => {
    for (const k of D.kernsaetze) {
      for (const l of LANGS) {
        assert.ok(k.t[l], `${k.id} fehlt in ${l}`);
        const r = check(k.de, k.t[l], k.de, l, { origin: 'kernsatz' });
        assert.equal(r.status, 'green', `${k.id}/${l}: ${JSON.stringify(levels(r))}`);
      }
    }
  });

  test('Prüf-Demo-Szenarien zeigen genau den eingebauten Fehler', () => {
    const expected = { 's-sinn': ['red', 'pl'], 's-neg': ['red', 'tr'], 's-zahl': ['red', 'ro'], 's-glossar': ['yellow', 'ar'] };
    for (const s of D.scenarios) {
      const results = Object.fromEntries(LANGS.map((l) => [l, { text: s.r[l][0], back: s.r[l][1] }]));
      const a = G.analyzeAll({ source: s.de, results, glossary: D.glossary });
      const [status, lang] = expected[s.id];
      assert.equal(a.status, status, s.id);
      for (const l of LANGS) assert.equal(a.perLang[l].status, l === lang ? status : 'green', `${s.id}/${l}`);
    }
  });

  test('vorbereitete Unterweisungen verweisen nur auf vorhandene, vollständig übersetzte Inhalte', () => {
    const quizIds = [...D.quiz, ...D.fremdfirmen.quiz].map((q) => q.id);
    for (const p of D.programs) {
      if (p.quiz) assert.ok(quizIds.includes(p.quiz), `${p.id}: Quiz ${p.quiz}`);
      for (const id of p.items) {
        const k = D.kernsaetze.find((x) => x.id === id);
        const r = D.fremdfirmen.rules.find((x) => x.id === id);
        assert.ok(k || r, `${p.id}: Inhalt ${id}`);
        for (const l of LANGS) assert.ok(k ? k.t[l] : (r.text[l] && r.title[l]), `${p.id}/${id}/${l}`);
      }
    }
  });

  test('Griechisch: Fachbegriffe greifen, „Notausgang“-Fehler wird gesperrt', () => {
    const ok = check('Vor dem Eingreifen in die Linie den Not-Halt drücken.', 'Πριν επέμβετε στη γραμμή, πατήστε τον διακόπτη έκτακτης ανάγκης.', 'Vor dem Eingreifen in die Linie den Not-Halt drücken.', 'el');
    assert.equal(ok.status, 'green');
    const bad = check('Vor dem Eingreifen in die Linie den Not-Halt drücken.', 'Πριν επέμβετε στη γραμμή, πατήστε την έξοδο κινδύνου.', 'Vor dem Eingreifen in die Linie den Notausgang drücken.', 'el');
    assert.equal(bad.status, 'red');
  });

  test('Texte für Beschäftigte, Quiz und Fremdfirmen sind vollständig', () => {
    const all = ['de', ...LANGS];
    for (const l of all) for (const key of Object.keys(D.ui.de)) assert.ok(D.ui[l][key], `ui.${l}.${key}`);
    for (const q of [...D.quiz, ...D.fremdfirmen.quiz]) for (const l of all) {
      assert.ok(q.q[l], `${q.id}.q.${l}`);
      q.a.forEach((a, i) => assert.ok(a[l], `${q.id}.a${i}.${l}`));
    }
    for (const r of D.fremdfirmen.rules) for (const l of all) assert.ok(r.title[l] && r.text[l], `${r.id}.${l}`);
    for (const r of D.quickReplies) for (const l of all) assert.ok(r.t[l], `${r.id}.${l}`);
  });
});

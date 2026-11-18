// Geraete-Matrix: faehrt die Browser-Tests nacheinander mit vielen Geraeteprofilen (Telefone, Tablets, Chromebook, Desktop).
// Nur Chromium-Emulation, KEINE echte Safari-/Firefox-Engine, KEIN echtes Geraet, KEIN echter Ton (siehe docs/testberichte/testbericht-geraete-2026-11-18.md).
//   BASE=http://127.0.0.1:8123 OPERATOR_KEY=... [OUT=/pfad/ergebnis] [NUR="iPhone SE,Pixel 7"] node geraete_matrix.js
// Der Testserver (Attrappen) muss laufen: siehe README. Dauer: etwa 20 bis 30 Minuten fuer alle Profile. Exit-Code 1, wenn ein Lauf fehlschlaegt.
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(process.cwd(), 'geraete-ergebnis');
const NUR = process.env.NUR ? process.env.NUR.split(',').map((x) => x.trim()) : null;

// Gast-Geraete (jeweils mit einem passenden Bedienplatz-Profil gepaart); die Namen sind Playwright-Geraeteprofile oder Profile aus _geraet.js
const GAESTE = [
  ['iPhone SE', 'Chromebook 100%'],
  ['iPhone 13', 'Chromebook 125%'],
  ['iPhone 15 Pro Max', 'Chromebook 150%'],
  ['Pixel 7', 'Chromebook klein'],
  ['Galaxy S9+', 'Chromebook 125%'],
  ['iPad (gen 7)', 'Chromebook 100%'],
  ['iPad (gen 7) landscape', 'Chromebook 125%'],
  ['iPad Pro 11', 'iPad Pro 11 landscape'],
  ['Galaxy Tab S4', 'Chromebook 150%'],
  ['Galaxy Tab S4 landscape', 'Chromebook klein'],
  ['Desktop Chrome', 'Chromebook 125%'],
];
const OPS = ['Chromebook 100%', 'Chromebook 125%', 'Chromebook 150%', 'Chromebook klein', 'iPad Pro 11 landscape'];
const GAST_SKRIPTE = ['gast_ohne_server.js', 'gespraech.js'];               // je Gast-Geraet (Auswahl, Dauer)
const GAST_SKRIPT_PROFILE = ['iPhone SE', 'iPhone 13', 'Pixel 7', 'iPad (gen 7)', 'Galaxy Tab S4 landscape', 'Desktop Chrome'];
const OP_SKRIPTE = ['operator_ohne_server.js', 'browser_smoke.js'];          // je Bedienplatz-Profil

function lauf(script, env) {
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(__dirname, script)], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 420000, maxBuffer: 50 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  return { script, ...env, exit: r.status, ok: (out.match(/^OK /gm) || []).length, fail: (out.match(/^FAIL /gm) || []).length,
    sekunden: Math.round((Date.now() - t0) / 1000), fehler: out.split('\n').filter((l) => /^FAIL|ABBRUCH/.test(l)).slice(0, 8), roh: out };
}

fs.mkdirSync(OUT, { recursive: true });
const ergebnisse = [];
const zeige = (e) => console.log(`${e.exit === 0 ? 'OK  ' : 'FEHLER'} ${e.script.padEnd(26)} Gast=${(e.GERAET || '-').padEnd(24)} Bedienplatz=${(e.OP_GERAET || '-').padEnd(22)} ${String(e.ok).padStart(3)} ok ${e.fail} fehl ${e.sekunden}s`);
const merke = (e) => { ergebnisse.push(e); zeige(e); fs.writeFileSync(path.join(OUT, e.script.replace('.js', '') + '--' + (e.GERAET || 'x').replace(/[^A-Za-z0-9]+/g, '_') + '--' + (e.OP_GERAET || 'x').replace(/[^A-Za-z0-9]+/g, '_') + '.log'), e.roh); e.fehler.forEach((f) => console.log('      ' + f.slice(0, 220))); };

console.log('=== Teil 1: Layout, Sprachen, Verlauf, Netzabbruch, Drehen, "Alle trennen", Gespraech-Leiste');
for (const [g, o] of GAESTE) if (!NUR || NUR.includes(g)) merke(lauf('geraete_layout.js', { GERAET: g, OP_GERAET: o, LANG_START: String(GAESTE.findIndex((x) => x[0] === g)) }));
console.log('=== Teil 2: Gast-Zustandsautomat und Gespraech mit Geraeteprofil');
for (const g of GAST_SKRIPT_PROFILE) if (!NUR || NUR.includes(g)) for (const s of GAST_SKRIPTE) merke(lauf(s, { GERAET: g, OP_GERAET: 'Chromebook 125%' }));
console.log('=== Teil 3: Bedienplatz mit Geraeteprofil');
for (const o of OPS) if (!NUR) for (const s of OP_SKRIPTE) merke(lauf(s, { OP_GERAET: o, GERAET: 'iPhone 13' }));
console.log('=== Teil 4: Mikrofon-Abtastrate (unabhaengig vom Profil; Chromium mit nachgestelltem Verhalten anderer Browser)');
if (!NUR) merke(lauf('audio_abtastrate.js', {}));

const bad = ergebnisse.filter((e) => e.exit !== 0);
const md = ['| Skript | Gast-Geraet | Bedienplatz | ok | Fehler | Sekunden |', '| --- | --- | --- | --- | --- | --- |']
  .concat(ergebnisse.map((e) => `| ${e.script} | ${e.GERAET || '-'} | ${e.OP_GERAET || '-'} | ${e.ok} | ${e.fail}${e.exit !== 0 && e.fail === 0 ? ' (Abbruch)' : ''} | ${e.sekunden} |`));
fs.writeFileSync(path.join(OUT, 'ergebnis.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify(ergebnisse.map(({ roh, ...x }) => x), null, 2));
console.log(`\nGESAMT: ${ergebnisse.length} Laeufe, ${ergebnisse.reduce((a, e) => a + e.ok, 0)} Pruefungen bestanden, ${bad.length} Laeufe mit Fehlern`);
process.exit(bad.length ? 1 : 0);

// Tests für den SafeBriefing Edge-Server (nur Node-Bordmittel).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createApp, resolveStaticPath, lanUrls, SECURITY_HEADERS, AUDIO_LIMIT, JSON_LIMIT,
} from '../server/server.mjs';
import { buildConfig, loadConfig, parseEnvFile, VERSION } from '../server/config.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

async function startApp(options = {}) {
  const lines = [];
  const server = createApp({ log: (line) => lines.push(line), ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, lines, base: `http://127.0.0.1:${server.address().port}`, close: () => server.shutdown() };
}

/** Fake-Upstream-Server, der Requests mitschneidet. */
async function startFake(handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const entry = { method: req.method, url: req.url, headers: req.headers, raw: Buffer.concat(chunks) };
    requests.push(entry);
    await handler(entry, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    requests,
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}

/** HTTP-Request mit unverändertem Pfad (fetch würde "../" bereits clientseitig auflösen). */
function rawRequest(base, rawPath, { method = 'GET', headers = {}, body } = {}) {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    let gotResponse = false;
    const req = http.request({ hostname, port, path: rawPath, method, headers }, (res) => {
      gotResponse = true;
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    // Schließt der Server nach einer frühen Antwort, ist ein Schreibfehler hier egal.
    req.on('error', (err) => { if (!gotResponse) reject(err); });
    req.end(body);
  });
}

async function postJson(base, p, payload, headers = {}) {
  const res = await fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, headers: res.headers, body };
}

/** Minimaler SSE-Client auf Basis von http.get. */
function openEvents(base) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${base}/api/events`, (res) => {
      const client = {
        status: res.statusCode,
        headers: res.headers,
        events: [],
        comments: [],
        watchers: new Set(),
        close() { req.destroy(); },
        until(check, timeoutMs = 3000) {
          return new Promise((done, fail) => {
            const probe = () => {
              const result = check(client);
              if (!result) return;
              clearTimeout(timer);
              client.watchers.delete(probe);
              done(result);
            };
            const timer = setTimeout(() => {
              client.watchers.delete(probe);
              fail(new Error('Zeitüberschreitung beim Warten auf SSE-Ereignis'));
            }, timeoutMs);
            client.watchers.add(probe);
            probe();
          });
        },
        waitFor(event, predicate = () => true, timeoutMs) {
          return client.until((c) => c.events.find((e) => e.event === event && predicate(e.data)), timeoutMs);
        },
      };
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let event = 'message';
          const data = [];
          for (const line of block.split('\n')) {
            if (line.startsWith(':')) client.comments.push(line);
            else if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) data.push(line.slice(6));
          }
          if (data.length) client.events.push({ event, data: JSON.parse(data.join('\n')) });
        }
        for (const watcher of [...client.watchers]) watcher();
      });
      resolve(client);
    });
    req.on('error', reject);
  });
}

function assertSecurityHeaders(headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    const actual = typeof headers.get === 'function' ? headers.get(name) : headers[name.toLowerCase()];
    assert.equal(actual, value, `Header ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Health, Sicherheit, Routing
// ---------------------------------------------------------------------------

describe('Health und Routing', () => {
  let app;
  before(async () => {
    app = await startApp({
      translateEngine: 'openai',
      backEngine: 'mock',
      openaiBaseUrl: 'http://user:geheimes-passwort@127.0.0.1:9/v1',
      openaiModel: 'test-model',
      openaiApiKey: 'sk-geheim-123',
      sttUrl: 'http://127.0.0.1:9/v1/audio/transcriptions',
      sttApiKey: 'stt-geheim-456',
    });
  });
  after(() => app.close());

  it('GET /api/health liefert die erwartete Struktur ohne Geheimnisse', async () => {
    const res = await fetch(`${app.base}/api/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^application\/json/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assertSecurityHeaders(res.headers);
    const text = await res.text();
    const body = JSON.parse(text);
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'edge');
    assert.equal(body.version, '0.1.0');
    assert.deepEqual(body.engine, { name: 'openai', configured: true });
    assert.deepEqual(body.backEngine, { name: 'mock', configured: true });
    assert.deepEqual(body.stt, { name: 'openai-compatible', configured: true });
    assert.equal(body.clients, 0);
    assert.ok(Array.isArray(body.lanUrls));
    assert.equal(body.ramOnly, true);
    for (const secret of ['geheimes-passwort', 'sk-geheim-123', 'stt-geheim-456', '127.0.0.1:9']) {
      assert.ok(!text.includes(secret), `Health darf "${secret}" nicht enthalten`);
    }
  });

  it('Version passt zu package.json', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(TEST_DIR, '..', 'package.json'), 'utf8'));
    assert.equal(VERSION, pkg.version);
    assert.equal(pkg.type, undefined, 'package.json darf kein "type" setzen (App-Dateien bleiben CommonJS)');
  });

  it('unbekannte API-Route → 404 not_found, falsche Methode → 405', async () => {
    const missing = await fetch(`${app.base}/api/gibtsnicht`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'not_found' });
    assertSecurityHeaders(missing.headers);

    const wrong = await fetch(`${app.base}/api/health`, { method: 'POST' });
    assert.equal(wrong.status, 405);
    assert.equal(wrong.headers.get('allow'), 'GET');
    assert.deepEqual(await wrong.json(), { error: 'method_not_allowed' });
  });

  it('POST von fremder Origin wird abgelehnt (CSRF-Schutz), gleiche Origin erlaubt', async () => {
    const foreign = await postJson(app.base, '/api/publish', { type: 'note', data: 1 }, { Origin: 'http://evil.example' });
    assert.equal(foreign.status, 403);
    assert.deepEqual(foreign.body, { error: 'forbidden_origin' });

    const crossSite = await postJson(app.base, '/api/reset', {}, { 'Sec-Fetch-Site': 'cross-site' });
    assert.equal(crossSite.status, 403);

    const same = await postJson(app.base, '/api/publish', { type: 'note', data: 1 }, { Origin: app.base });
    assert.equal(same.status, 200);
  });

  it('Log enthält nur Methode, Pfad ohne Query, Status und Dauer', async () => {
    await fetch(`${app.base}/api/health?token=sehr-geheim`);
    await postJson(app.base, '/api/publish', { type: 'note', data: { text: 'Vertraulicher Inhalt' } });
    // Logzeilen entstehen beim Schließen der Antwort.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const requestLines = app.lines.filter((line) => line.includes('/api/'));
    assert.ok(requestLines.some((line) => / GET \/api\/health 200 \d+ms$/.test(line)));
    assert.ok(requestLines.some((line) => / POST \/api\/publish 200 \d+ms$/.test(line)));
    for (const line of app.lines) {
      assert.match(line, /^\S+ [A-Z]+ \S+ \d{3} \d+ms$/);
      assert.ok(!line.includes('sehr-geheim'));
      assert.ok(!line.includes('Vertraulich'));
      assert.ok(!line.includes('127.0.0.1'));
    }
  });
});

describe('lanUrls', () => {
  const interfaces = {
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    docker0: [{ address: '172.17.0.1', family: 'IPv4', internal: false }],
    wlan0: [
      { address: '192.168.1.20', family: 'IPv4', internal: false },
      { address: 'fe80::1', family: 'IPv6', internal: false },
    ],
    eth0: [{ address: '10.0.0.5', family: 4, internal: false }],
  };

  it('listet alle externen IPv4-Adressen mit Port, virtuelle Adapter zuletzt', () => {
    assert.deepEqual(lanUrls({ address: '0.0.0.0', port: 8080 }, interfaces), [
      'http://192.168.1.20:8080/',
      'http://10.0.0.5:8080/',
      'http://172.17.0.1:8080/',
    ]);
  });

  it('bei Bindung an eine Adresse nur diese, bei localhost keine', () => {
    assert.deepEqual(lanUrls({ address: '10.0.0.5', port: 81 }, interfaces), ['http://10.0.0.5:81/']);
    assert.deepEqual(lanUrls({ address: '127.0.0.1', port: 81 }, interfaces), []);
    assert.deepEqual(lanUrls(null, interfaces), []);
  });
});

// ---------------------------------------------------------------------------
// Statische Dateien
// ---------------------------------------------------------------------------

describe('Statische Dateien', () => {
  let tmp;
  let root;
  let app;

  before(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'safebriefing-static-'));
    root = path.join(tmp, 'app');
    await fs.mkdir(path.join(root, 'sub'), { recursive: true });
    await fs.writeFile(path.join(root, 'index.html'), '<!doctype html><title>SB-Startseite</title>');
    await fs.writeFile(path.join(root, 'app.js'), 'console.log("app");');
    await fs.writeFile(path.join(root, 'style.css'), 'body{}');
    await fs.writeFile(path.join(root, 'data.json'), '{}');
    await fs.writeFile(path.join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await fs.writeFile(path.join(root, 'manifest.webmanifest'), '{}');
    await fs.writeFile(path.join(root, 'sub', 'index.html'), '<p>Unterseite</p>');
    await fs.writeFile(path.join(root, '.env'), 'GEHEIM=1');
    await fs.writeFile(path.join(tmp, 'package.json'), '{"secret":"AUSSERHALB"}');
    try {
      await fs.symlink(path.join(tmp, 'package.json'), path.join(root, 'link.json'));
    } catch {
      // Symlinks nicht erlaubt (z. B. Windows ohne Rechte) – Test unten prüft dann nur 404.
    }
    app = await startApp({ staticRoot: root });
  });

  after(async () => {
    await app.close();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('/ liefert index.html ohne Cache und mit Sicherheits-Headern', async () => {
    const res = await fetch(`${app.base}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assertSecurityHeaders(res.headers);
    assert.match(res.headers.get('permissions-policy'), /microphone=\(self\)/);
    assert.match(await res.text(), /SB-Startseite/);
  });

  it('liefert korrekte MIME-Typen und kurzen Cache für Assets', async () => {
    const expected = {
      '/app.js': 'text/javascript; charset=utf-8',
      '/style.css': 'text/css; charset=utf-8',
      '/data.json': 'application/json; charset=utf-8',
      '/icon.svg': 'image/svg+xml',
      '/manifest.webmanifest': 'application/manifest+json; charset=utf-8',
    };
    for (const [p, type] of Object.entries(expected)) {
      const res = await fetch(app.base + p);
      assert.equal(res.status, 200, p);
      assert.equal(res.headers.get('content-type'), type, p);
      assert.match(res.headers.get('cache-control'), /max-age=\d+/, p);
      await res.arrayBuffer();
    }
  });

  it('ETag-Revalidierung liefert 304', async () => {
    const first = await fetch(`${app.base}/app.js`);
    await first.arrayBuffer();
    const etag = first.headers.get('etag');
    assert.ok(etag);
    const second = await fetch(`${app.base}/app.js`, { headers: { 'If-None-Match': etag } });
    assert.equal(second.status, 304);
  });

  it('HEAD liefert Header ohne Body', async () => {
    const res = await rawRequest(app.base, '/app.js', { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-length'], String('console.log("app");'.length));
    assert.equal(res.body, '');
  });

  it('Verzeichnis ohne Schrägstrich wird weitergeleitet, mit Schrägstrich index.html', async () => {
    const redirect = await rawRequest(app.base, '/sub');
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.location, '/sub/');
    const page = await rawRequest(app.base, '/sub/');
    assert.equal(page.status, 200);
    assert.match(page.body, /Unterseite/);
  });

  it('blockiert Path-Traversal (auch kodiert), NUL-Bytes, versteckte Dateien und Symlinks nach außen', async () => {
    const attempts = [
      '/../package.json',
      '/%2e%2e/package.json',
      '/..%2fpackage.json',
      '/%2e%2e%2fpackage.json',
      '/sub/../../package.json',
      '/..%5cpackage.json',
      '/%252e%252e/package.json',
      '/index.html%00.js',
      '/%c0%ae%c0%ae/package.json',
      '/.env',
      '/link.json',
      '/gibt-es-nicht.js',
    ];
    for (const attempt of attempts) {
      const res = await rawRequest(app.base, attempt);
      assert.equal(res.status, 404, attempt);
      assert.ok(!res.body.includes('AUSSERHALB'), attempt);
      assert.ok(!res.body.includes('GEHEIM'), attempt);
      assertSecurityHeaders(res.headers);
    }
  });

  it('POST auf statische Pfade → 405', async () => {
    const res = await rawRequest(app.base, '/index.html', { method: 'POST' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.allow, 'GET, HEAD');
  });

  it('fehlendes App-Verzeichnis führt zu 404 statt Absturz', async () => {
    const empty = await startApp({ staticRoot: path.join(tmp, 'gibt-es-nicht') });
    try {
      const res = await fetch(`${empty.base}/`);
      assert.equal(res.status, 404);
      await res.arrayBuffer();
    } finally {
      await empty.close();
    }
  });

  it('resolveStaticPath bleibt im Wurzelverzeichnis', () => {
    assert.equal(resolveStaticPath(root, '/app.js').filePath, path.join(root, 'app.js'));
    assert.equal(resolveStaticPath(root, '/').filePath, path.resolve(root));
    assert.equal(resolveStaticPath(root, '/../x'), null);
    assert.equal(resolveStaticPath(root, '/%2e%2e/x'), null);
    assert.equal(resolveStaticPath(root, '/a%2fb'), null);
    assert.equal(resolveStaticPath(root, '/a\\..\\b'), null);
    assert.equal(resolveStaticPath(root, '/C:/Windows'), null);
    assert.equal(resolveStaticPath(root, '/%E0%A4%A'), null);
    assert.equal(resolveStaticPath(root, 'relativ'), null);
  });
});

// ---------------------------------------------------------------------------
// Server-Sent Events
// ---------------------------------------------------------------------------

describe('Server-Sent Events', () => {
  let app;
  before(async () => {
    app = await startApp({ heartbeatMs: 50 });
  });
  after(() => app.close());

  it('hello, publish → msg, Replay für späte Clients, presence, reset', async () => {
    const a = await openEvents(app.base);
    try {
      assert.equal(a.status, 200);
      assert.equal(a.headers['content-type'], 'text/event-stream');
      assert.equal(a.headers['cache-control'], 'no-store');
      assert.equal(a.headers.connection, 'keep-alive');
      assert.equal(a.headers['x-accel-buffering'], 'no');
      assertSecurityHeaders(a.headers);

      const hello = await a.waitFor('hello');
      assert.deepEqual(hello.data, { clients: 1 });
      await a.waitFor('presence', (d) => d.clients === 1);

      const health = await (await fetch(`${app.base}/api/health`)).json();
      assert.equal(health.clients, 1);

      const published = await postJson(app.base, '/api/publish', { type: 'briefing.start', data: { step: 1 } });
      assert.equal(published.status, 200);
      assert.equal(published.body.ok, true);
      assert.equal(published.body.delivered, 1);
      assert.match(published.body.id, /^[0-9a-f-]{36}$/);

      const msg = await a.waitFor('msg', (d) => d.id === published.body.id);
      assert.equal(msg.data.type, 'briefing.start');
      assert.deepEqual(msg.data.data, { step: 1 });
      assert.equal(typeof msg.data.ts, 'number');

      const second = await postJson(app.base, '/api/publish', { type: 'ack', data: null });

      // Später Client bekommt den Ringpuffer in Reihenfolge.
      const b = await openEvents(app.base);
      try {
        assert.deepEqual((await b.waitFor('hello')).data, { clients: 2 });
        await b.waitFor('presence', (d) => d.clients === 2);
        const replayed = b.events.filter((e) => e.event === 'msg').map((e) => e.data.id);
        assert.deepEqual(replayed, [published.body.id, second.body.id]);
        await a.waitFor('presence', (d) => d.clients === 2);
      } finally {
        b.close();
      }
      await a.until((c) => c.events.filter((e) => e.event === 'presence').at(-1).data.clients === 1);

      // Heartbeat-Kommentar
      await a.until((c) => c.comments.includes(': ping'));

      // Reset leert den Puffer
      const reset = await postJson(app.base, '/api/reset', {});
      assert.deepEqual(reset.body, { ok: true });
      await a.waitFor('reset');
      const c = await openEvents(app.base);
      try {
        await c.waitFor('presence');
        assert.equal(c.events.filter((e) => e.event === 'msg').length, 0);
      } finally {
        c.close();
      }
    } finally {
      a.close();
    }
  });

  it('ungültiger type → 400 bad_type, kaputtes JSON → 400 bad_json, zu groß → 413', async () => {
    for (const type of ['Briefing', '', '1abc', 'a'.repeat(49), 'mit leerzeichen', 42, undefined]) {
      const res = await postJson(app.base, '/api/publish', { type, data: 'x' });
      assert.equal(res.status, 400, String(type));
      assert.deepEqual(res.body, { error: 'bad_type' });
    }
    const ok = await postJson(app.base, '/api/publish', { type: 'a'.repeat(48) });
    assert.equal(ok.status, 200);

    const badJson = await postJson(app.base, '/api/publish', '{"type":');
    assert.equal(badJson.status, 400);
    assert.deepEqual(badJson.body, { error: 'bad_json' });

    const tooLarge = await postJson(app.base, '/api/publish', { type: 'note', data: 'x'.repeat(JSON_LIMIT) });
    assert.equal(tooLarge.status, 413);
    assert.deepEqual(tooLarge.body, { error: 'too_large' });
  });

  it('Ringpuffer hält die letzten 100 Nachrichten', async () => {
    const ring = await startApp();
    try {
      for (let n = 0; n < 105; n += 1) {
        const res = await postJson(ring.base, '/api/publish', { type: 'seq', data: { n } });
        assert.equal(res.status, 200);
      }
      const late = await openEvents(ring.base);
      try {
        await late.waitFor('presence');
        const numbers = late.events.filter((e) => e.event === 'msg').map((e) => e.data.data.n);
        assert.equal(numbers.length, 100);
        assert.equal(numbers[0], 5);
        assert.equal(numbers.at(-1), 104);
      } finally {
        late.close();
      }
    } finally {
      await ring.close();
    }
  });

  it('begrenzt die Zahl gleichzeitiger SSE-Clients', async () => {
    const limited = await startApp({ maxSseClients: 1 });
    const first = await openEvents(limited.base);
    try {
      await first.waitFor('hello');
      const res = await fetch(`${limited.base}/api/events`);
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: 'too_many_clients' });
    } finally {
      first.close();
      await limited.close();
    }
  });

  it('shutdown beendet offene SSE-Verbindungen', async () => {
    const temp = await startApp();
    const client = await openEvents(temp.base);
    await client.waitFor('hello');
    await temp.close();
    assert.equal(temp.server.listening, false);
    client.close();
  });
});

// ---------------------------------------------------------------------------
// Übersetzung (Mock-Engine, Validierung)
// ---------------------------------------------------------------------------

describe('POST /api/translate', () => {
  let app;
  before(async () => {
    app = await startApp({ translateEngine: 'mock' });
  });
  after(() => app.close());

  it('übersetzt parallel in mehrere Sprachen mit Rückübersetzung', async () => {
    const text = 'Schutzbrille tragen! Nicht unter die schwebende Last treten.';
    const res = await postJson(app.base, '/api/translate', {
      text,
      targets: ['en', 'uk'],
      glossary: [{ de: 'Schutzbrille', targets: { en: 'safety goggles' } }],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.engine, 'mock');
    assert.equal(res.body.backEngine, 'mock');
    assert.equal(typeof res.body.ms, 'number');
    assert.deepEqual(Object.keys(res.body.results).sort(), ['en', 'uk']);
    assert.equal(res.body.results.en.text, `[EN] ${text}`);
    assert.equal(res.body.results.uk.text, `[UK] ${text}`);
    for (const lang of ['en', 'uk']) {
      assert.equal(res.body.results[lang].back, text);
      assert.equal(typeof res.body.results[lang].ms, 'number');
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(app.lines.every((line) => !line.includes('Schutzbrille')), 'Texte dürfen nie im Log landen');
  });

  it('Zielsprache = Ausgangssprache wird ohne Engine übernommen', async () => {
    const res = await postJson(app.base, '/api/translate', { text: 'Helm auf.', source: 'de', targets: ['de', 'pl'] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.results.de, { text: 'Helm auf.', back: 'Helm auf.', ms: 0 });
    assert.equal(res.body.results.pl.text, '[PL] Helm auf.');
  });

  it('validiert Text, Sprachen und Glossar', async () => {
    const cases = [
      [{ text: '', targets: ['en'] }, 'bad_text'],
      [{ text: '   ', targets: ['en'] }, 'bad_text'],
      [{ text: 42, targets: ['en'] }, 'bad_text'],
      [{ targets: ['en'] }, 'bad_text'],
      [{ text: 'x'.repeat(2001), targets: ['en'] }, 'text_too_long'],
      [{ text: 'Hallo', targets: [] }, 'bad_targets'],
      [{ text: 'Hallo', targets: 'en' }, 'bad_targets'],
      [{ text: 'Hallo', targets: ['english'] }, 'bad_targets'],
      [{ text: 'Hallo', targets: ['EN'] }, 'bad_targets'],
      [{ text: 'Hallo', targets: ['en-gb'] }, 'bad_targets'],
      [{ text: 'Hallo', targets: ['en', 7] }, 'bad_targets'],
      [{ text: 'Hallo', targets: Array.from({ length: 13 }, (_, i) => `a${String.fromCharCode(97 + i)}`) }, 'bad_targets'],
      [{ text: 'Hallo', source: 'deutsch', targets: ['en'] }, 'bad_source'],
      [{ text: 'Hallo', targets: ['en'], glossary: 'x' }, 'bad_glossary'],
      [{ text: 'Hallo', targets: ['en'], glossary: [{ targets: { en: 'x' } }] }, 'bad_glossary'],
      [{ text: 'Hallo', targets: ['en'], glossary: [{ de: 'x', targets: [] }] }, 'bad_glossary'],
      [{ text: 'Hallo', targets: ['en'], glossary: Array.from({ length: 201 }, (_, i) => ({ de: `w${i}`, targets: {} })) }, 'bad_glossary'],
    ];
    for (const [payload, error] of cases) {
      const res = await postJson(app.base, '/api/translate', payload);
      assert.equal(res.status, 400, JSON.stringify(payload).slice(0, 80));
      assert.deepEqual(res.body, { error });
    }

    const maxText = await postJson(app.base, '/api/translate', { text: 'x'.repeat(2000), targets: ['en-GB'] });
    assert.equal(maxText.status, 200);
    const twelve = Array.from({ length: 12 }, (_, i) => `a${String.fromCharCode(97 + i)}`);
    const maxTargets = await postJson(app.base, '/api/translate', { text: 'Hallo', targets: twelve });
    assert.equal(maxTargets.status, 200);
    assert.equal(Object.keys(maxTargets.body.results).length, 12);
  });

  it('kaputtes JSON → 400, zu großer Body → 413', async () => {
    const bad = await postJson(app.base, '/api/translate', 'kein json');
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body, { error: 'bad_json' });
    const big = await postJson(app.base, '/api/translate', { text: 'x', targets: ['en'], pad: 'y'.repeat(JSON_LIMIT) });
    assert.equal(big.status, 413);
    assert.deepEqual(big.body, { error: 'too_large' });
  });

  it('ohne Engine → 503 no_engine', async () => {
    const none = await startApp();
    try {
      const res = await postJson(none.base, '/api/translate', { text: 'Hallo', targets: ['en'] });
      assert.equal(res.status, 503);
      assert.deepEqual(res.body, { error: 'no_engine' });
      const health = await (await fetch(`${none.base}/api/health`)).json();
      assert.deepEqual(health.engine, { name: 'none', configured: false });
    } finally {
      await none.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Spracherkennung
// ---------------------------------------------------------------------------

describe('POST /api/stt', () => {
  let fake;
  let app;
  let mode = 'ok';

  before(async () => {
    fake = await startFake(async (entry, res) => {
      if (mode === 'fail') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `bad key ${entry.headers.authorization}` }));
        return;
      }
      if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 400));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: ' Bitte Helm tragen. ' }));
    });
    app = await startApp({
      sttUrl: `${fake.base}/v1/audio/transcriptions`,
      sttApiKey: 'stt-key',
      sttTimeoutMs: 150,
    });
  });
  after(async () => {
    await app.close();
    await fake.close();
  });

  async function parseForm(entry) {
    return new Response(entry.raw, { headers: { 'Content-Type': entry.headers['content-type'] } }).formData();
  }

  it('leitet Audio als multipart/form-data weiter und liefert {text}', async () => {
    mode = 'ok';
    const audio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5]);
    const res = await fetch(`${app.base}/api/stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/webm;codecs=opus' },
      body: audio,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { text: 'Bitte Helm tragen.' });

    const entry = fake.requests.at(-1);
    assert.equal(entry.method, 'POST');
    assert.equal(entry.url, '/v1/audio/transcriptions');
    assert.match(entry.headers['content-type'], /^multipart\/form-data; boundary=/);
    assert.equal(entry.headers.authorization, 'Bearer stt-key');
    const form = await parseForm(entry);
    assert.equal(form.get('language'), 'de');
    assert.equal(form.get('model'), 'Systran/faster-whisper-small');
    assert.equal(form.get('response_format'), 'json');
    const file = form.get('file');
    assert.equal(typeof file, 'object');
    assert.equal(file.name, 'audio.webm');
    assert.match(file.type, /^audio\/webm/);
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), audio);
  });

  it('wählt den Dateinamen nach Content-Type (wav)', async () => {
    mode = 'ok';
    const res = await fetch(`${app.base}/api/stt`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: Buffer.from('RIFF') });
    assert.equal(res.status, 200);
    await res.arrayBuffer();
    const form = await parseForm(fake.requests.at(-1));
    assert.equal(form.get('file').name, 'audio.wav');
  });

  it('zu großes Audio → 413 ohne Weiterleitung', async () => {
    const before = fake.requests.length;
    const res = await rawRequest(app.base, '/api/stt', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/webm', 'Content-Length': AUDIO_LIMIT + 1 },
      body: Buffer.alloc(AUDIO_LIMIT + 1),
    });
    assert.equal(res.status, 413);
    assert.deepEqual(JSON.parse(res.body), { error: 'too_large' });
    assert.equal(fake.requests.length, before);
  });

  it('falscher Content-Type → 415, leerer Body → 400', async () => {
    const wrongType = await fetch(`${app.base}/api/stt`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hallo' });
    assert.equal(wrongType.status, 415);
    assert.deepEqual(await wrongType.json(), { error: 'bad_content_type' });
    const empty = await fetch(`${app.base}/api/stt`, { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: Buffer.alloc(0) });
    assert.equal(empty.status, 400);
    assert.deepEqual(await empty.json(), { error: 'empty_audio' });
  });

  it('Fehler der Gegenstelle → 502 ohne Details, Zeitüberschreitung → 504', async () => {
    mode = 'fail';
    const failed = await fetch(`${app.base}/api/stt`, { method: 'POST', headers: { 'Content-Type': 'audio/ogg' }, body: Buffer.from('OggS') });
    assert.equal(failed.status, 502);
    const text = await failed.text();
    assert.deepEqual(JSON.parse(text), { error: 'stt_failed' });
    assert.ok(!text.includes('stt-key'));

    mode = 'slow';
    const slow = await fetch(`${app.base}/api/stt`, { method: 'POST', headers: { 'Content-Type': 'audio/ogg' }, body: Buffer.from('OggS') });
    assert.equal(slow.status, 504);
    assert.deepEqual(await slow.json(), { error: 'stt_timeout' });
    mode = 'ok';
  });

  it('ohne STT_URL → 503 no_stt', async () => {
    const none = await startApp();
    try {
      const res = await fetch(`${none.base}/api/stt`, { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: Buffer.from('x') });
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: 'no_stt' });
    } finally {
      await none.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

describe('Konfiguration', () => {
  let tmp;
  before(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'safebriefing-config-'));
  });
  after(() => fs.rm(tmp, { recursive: true, force: true }));

  it('parseEnvFile versteht Kommentare, Leerzeilen, Anführungszeichen und export', () => {
    const vars = parseEnvFile([
      '\uFEFF# Kommentar',
      '',
      'PORT=9000',
      '  HOST = 127.0.0.1  ',
      'OPENAI_MODEL="qwen2.5:7b-instruct"',
      "OPENAI_API_KEY='sk-#nicht-kommentar'",
      'export STT_LANGUAGE=en',
      'TRANSLATE_ENGINE=mock   # Inline-Kommentar',
      'DEEPL_GLOSSARY_IDS={"en":"g-1"}',
      'LIBRETRANSLATE_URL=http://lt.local:5000/?a=b',
      'kaputte zeile',
      'LEER=',
    ].join('\r\n'));
    assert.deepEqual(vars, {
      PORT: '9000',
      HOST: '127.0.0.1',
      OPENAI_MODEL: 'qwen2.5:7b-instruct',
      OPENAI_API_KEY: 'sk-#nicht-kommentar',
      STT_LANGUAGE: 'en',
      TRANSLATE_ENGINE: 'mock',
      DEEPL_GLOSSARY_IDS: '{"en":"g-1"}',
      LIBRETRANSLATE_URL: 'http://lt.local:5000/?a=b',
      LEER: '',
    });
  });

  it('config.env überschreibt keine echten Umgebungsvariablen und ändert process.env nicht', async () => {
    const file = path.join(tmp, 'config.env');
    await fs.writeFile(file, [
      'PORT=1234',
      'TRANSLATE_ENGINE=mock',
      'STT_LANGUAGE=fr',
      'SAFEBRIEFING_TEST_ONLY_IN_FILE=1',
    ].join('\n'));
    const env = { PORT: '9999', STT_LANGUAGE: 'pl' };
    const config = loadConfig({ env, envFile: file });
    assert.equal(config.port, 9999);
    assert.equal(config.sttLanguage, 'pl');
    assert.equal(config.translateEngine, 'mock');
    assert.equal(config.backEngine, 'mock');
    assert.deepEqual(env, { PORT: '9999', STT_LANGUAGE: 'pl' });
    assert.equal(process.env.SAFEBRIEFING_TEST_ONLY_IN_FILE, undefined);
  });

  it('Standardwerte ohne Datei', () => {
    const config = loadConfig({ env: {}, envFile: path.join(tmp, 'fehlt.env') });
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.port, 8080);
    assert.equal(config.translateEngine, 'none');
    assert.equal(config.backEngine, 'none');
    assert.equal(config.translateTimeoutMs, 15000);
    assert.equal(config.sttModel, 'Systran/faster-whisper-small');
    assert.equal(config.sttLanguage, 'de');
    assert.equal(config.sttTimeoutMs, 30000);
    assert.equal(config.staticRoot, path.resolve(TEST_DIR, '..', 'app'));
  });

  it('BACK_ENGINE, STATIC_ROOT und DeepL-Glossare werden übernommen', () => {
    const config = buildConfig({
      TRANSLATE_ENGINE: 'LibreTranslate',
      BACK_ENGINE: 'openai',
      STATIC_ROOT: tmp,
      DEEPL_GLOSSARY_IDS: '{"en":"g-en"}',
    });
    assert.equal(config.translateEngine, 'libretranslate');
    assert.equal(config.backEngine, 'openai');
    assert.equal(config.staticRoot, path.resolve(tmp));
    assert.deepEqual(config.deeplGlossaryIds, { en: 'g-en' });
  });

  it('config.example.env ist gültig, vollständig und enthält keine Schlüssel', async () => {
    const example = path.join(TEST_DIR, '..', 'server', 'config.example.env');
    const vars = parseEnvFile(await fs.readFile(example, 'utf8'));
    const expected = [
      'PORT', 'HOST', 'TRANSLATE_ENGINE', 'BACK_ENGINE', 'LIBRETRANSLATE_URL', 'LIBRETRANSLATE_API_KEY',
      'OPENAI_BASE_URL', 'OPENAI_MODEL', 'OPENAI_API_KEY', 'DEEPL_API_URL', 'DEEPL_API_KEY',
      'DEEPL_GLOSSARY_IDS', 'TRANSLATE_TIMEOUT_MS', 'STT_URL', 'STT_MODEL', 'STT_LANGUAGE', 'STT_API_KEY',
      'STT_TIMEOUT_MS', 'STATIC_ROOT',
    ];
    assert.deepEqual(Object.keys(vars).sort(), [...expected].sort());
    for (const key of Object.keys(vars).filter((k) => k.endsWith('_API_KEY'))) assert.equal(vars[key], '', key);
    const config = loadConfig({ env: {}, envFile: example });
    assert.equal(config.translateEngine, 'none', 'sicherer Standard: keine Engine');
    assert.equal(config.sttUrl, '', 'Spracheingabe standardmäßig aus');
  });

  it('ungültige Werte führen zu verständlichen Fehlern ohne Geheimnisse', () => {
    assert.throws(() => buildConfig({ TRANSLATE_ENGINE: 'google' }), /TRANSLATE_ENGINE/);
    assert.throws(() => buildConfig({ BACK_ENGINE: 'x' }), /BACK_ENGINE/);
    assert.throws(() => buildConfig({ PORT: 'achtzig' }), /PORT/);
    assert.throws(() => buildConfig({ PORT: '70000' }), /PORT/);
    assert.throws(() => buildConfig({ DEEPL_GLOSSARY_IDS: '[1]' }), /DEEPL_GLOSSARY_IDS/);
    assert.throws(() => buildConfig({ DEEPL_GLOSSARY_IDS: '{kaputt' }), /DEEPL_GLOSSARY_IDS/);
    assert.throws(
      () => buildConfig({ OPENAI_BASE_URL: 'ftp://user:pw-geheim@host' }),
      (err) => /OPENAI_BASE_URL/.test(err.message) && !err.message.includes('pw-geheim'),
    );
    assert.throws(
      () => buildConfig({ STT_URL: 'kein url pw-geheim' }),
      (err) => /STT_URL/.test(err.message) && !err.message.includes('pw-geheim'),
    );
  });
});

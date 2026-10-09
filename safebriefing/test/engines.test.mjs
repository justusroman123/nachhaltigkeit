// Tests der Übersetzungs-Adapter gegen lokale Fake-Server (keine echten Dienste).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  createEngine, createStt, cleanLlmOutput, deeplTargetLang, audioFilename, buildEndpoint, EngineError,
} from '../server/engines.mjs';
import { createApp } from '../server/server.mjs';

/** Fake-Upstream: schneidet Requests mit, `handler(entry)` liefert {status, json, delayMs}. */
async function startFake(handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    let body;
    try { body = JSON.parse(raw); } catch { body = raw; }
    const entry = { method: req.method, url: req.url, headers: req.headers, body };
    requests.push(entry);
    const { status = 200, json = {}, delayMs = 0 } = (await handler(entry)) || {};
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (res.destroyed) return;
    const payload = JSON.stringify(json);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
    res.end(payload);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    requests,
    base: `http://127.0.0.1:${server.address().port}`,
    last: () => requests.at(-1),
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}

/** Port, auf dem garantiert niemand lauscht. */
async function closedPort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function postJson(base, p, payload) {
  const res = await fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------

describe('mock und none', () => {
  it('mock ist deterministisch und entfernt das Präfix bei Übersetzung ins Deutsche', async () => {
    const engine = createEngine('mock', {});
    assert.equal(engine.name, 'mock');
    assert.equal(engine.configured, true);
    assert.equal(await engine.translate('Helm tragen', 'de', 'en'), '[EN] Helm tragen');
    assert.equal(await engine.translate('Helm tragen', 'de', 'pt-BR'), '[PT-BR] Helm tragen');
    assert.equal(await engine.translate('[EN] Helm tragen', 'en', 'de'), 'Helm tragen');
    assert.equal(await engine.translate('[PT-BR] Helm tragen', 'pt-BR', 'de'), 'Helm tragen');
  });

  it('none ist nicht konfiguriert und wirft beim Übersetzen', async () => {
    const engine = createEngine('none', {});
    assert.equal(engine.configured, false);
    await assert.rejects(engine.translate('x', 'de', 'en'), EngineError);
    assert.equal(createEngine(undefined, {}).name, 'none');
  });

  it('unbekannte Engine wirft', () => {
    assert.throws(() => createEngine('google', {}), /Unbekannte/);
  });

  it('configured nur mit den nötigen Einstellungen', () => {
    assert.equal(createEngine('libretranslate', {}).configured, false);
    assert.equal(createEngine('libretranslate', { libretranslateUrl: 'kein-url' }).configured, false);
    assert.equal(createEngine('libretranslate', { libretranslateUrl: 'http://localhost:5000' }).configured, true);
    assert.equal(createEngine('openai', { openaiBaseUrl: 'http://localhost:11434/v1' }).configured, false);
    assert.equal(createEngine('openai', { openaiModel: 'm' }).configured, false);
    assert.equal(createEngine('openai', { openaiBaseUrl: 'http://localhost:11434/v1', openaiModel: 'm' }).configured, true);
    assert.equal(createEngine('deepl', {}).configured, false);
    assert.equal(createEngine('deepl', { deeplApiKey: 'k:fx' }).configured, true);
    assert.equal(createStt({}).configured, false);
    assert.equal(createStt({}).name, 'none');
    assert.equal(createStt({ sttUrl: 'http://localhost:8000/v1/audio/transcriptions' }).configured, true);
  });
});

describe('Hilfsfunktionen', () => {
  it('cleanLlmOutput entfernt Denk-Blöcke und umschließende Anführungszeichen', () => {
    assert.equal(cleanLlmOutput('  "Wear goggles."  '), 'Wear goggles.');
    assert.equal(cleanLlmOutput('„Helm tragen.“'), 'Helm tragen.');
    assert.equal(cleanLlmOutput('«Port casque»'), 'Port casque');
    assert.equal(cleanLlmOutput('<think>hmm</think>\nWear a helmet.'), 'Wear a helmet.');
    assert.equal(cleanLlmOutput('Say "stop" now'), 'Say "stop" now');
  });

  it('deeplTargetLang bildet Sprachcodes ab', () => {
    assert.equal(deeplTargetLang('en'), 'EN-GB');
    assert.equal(deeplTargetLang('pt'), 'PT-PT');
    assert.equal(deeplTargetLang('de'), 'DE');
    assert.equal(deeplTargetLang('uk'), 'UK');
    assert.equal(deeplTargetLang('ar'), 'AR');
    assert.equal(deeplTargetLang('en-US'), 'EN-US');
    assert.equal(deeplTargetLang('pt-BR'), 'PT-BR');
  });

  it('audioFilename nach Content-Type', () => {
    assert.equal(audioFilename('audio/webm;codecs=opus'), 'audio.webm');
    assert.equal(audioFilename('audio/wav'), 'audio.wav');
    assert.equal(audioFilename('audio/x-wav'), 'audio.wav');
    assert.equal(audioFilename('audio/ogg'), 'audio.ogg');
    assert.equal(audioFilename('audio/mp4'), 'audio.mp4');
    assert.equal(audioFilename('audio/mpeg'), 'audio.mp3');
  });

  it('buildEndpoint verschiebt Zugangsdaten aus der URL in einen Header', () => {
    const ep = buildEndpoint('http://nutzer:p%40ss@host:1234/v1/', '/chat/completions');
    assert.equal(ep.url, 'http://host:1234/v1/chat/completions');
    assert.equal(ep.headers.Authorization, `Basic ${Buffer.from('nutzer:p@ss').toString('base64')}`);
    assert.equal(buildEndpoint('', '/x'), null);
    assert.equal(buildEndpoint('http://a%zz:b@host/'), null);
    assert.equal(buildEndpoint('file:///etc/passwd'), null);
  });
});

// ---------------------------------------------------------------------------

describe('libretranslate', () => {
  let fake;
  before(async () => {
    fake = await startFake((entry) => ({ json: { translatedText: `<${entry.body.target}> ${entry.body.q}` } }));
  });
  after(() => fake.close());

  it('sendet {q, source, target, format, api_key} an /translate', async () => {
    const engine = createEngine('libretranslate', { libretranslateUrl: `${fake.base}/`, libretranslateApiKey: 'lt-key' });
    const out = await engine.translate('Helm tragen', 'de', 'en-GB', [{ de: 'Helm', target: 'helmet' }]);
    assert.equal(out, '<en> Helm tragen');
    const req = fake.last();
    assert.equal(req.method, 'POST');
    assert.equal(req.url, '/translate');
    assert.match(req.headers['content-type'], /^application\/json/);
    assert.deepEqual(req.body, { q: 'Helm tragen', source: 'de', target: 'en', format: 'text', api_key: 'lt-key' });
  });

  it('ohne API-Schlüssel kein api_key, Pfad-Präfix bleibt erhalten', async () => {
    const engine = createEngine('libretranslate', { libretranslateUrl: `${fake.base}/lt` });
    await engine.translate('Hallo', 'de', 'pl');
    assert.equal(fake.last().url, '/lt/translate');
    assert.deepEqual(fake.last().body, { q: 'Hallo', source: 'de', target: 'pl', format: 'text' });
  });
});

// ---------------------------------------------------------------------------

describe('openai (OpenAI-kompatible Chat-API)', () => {
  let fake;
  before(async () => {
    fake = await startFake(() => ({ json: { choices: [{ message: { role: 'assistant', content: ' "Wear safety goggles." ' } }] } }));
  });
  after(() => fake.close());

  it('sendet Modell, temperature 0 und Glossar im System-Prompt, ohne Schlüssel kein Authorization-Header', async () => {
    const engine = createEngine('openai', { openaiBaseUrl: `${fake.base}/v1`, openaiModel: 'qwen2.5:7b-instruct' });
    const out = await engine.translate('Schutzbrille tragen.', 'de', 'en', [{ de: 'Schutzbrille', target: 'safety goggles' }]);
    assert.equal(out, 'Wear safety goggles.');
    const req = fake.last();
    assert.equal(req.url, '/v1/chat/completions');
    assert.equal(req.headers.authorization, undefined);
    assert.equal(req.body.model, 'qwen2.5:7b-instruct');
    assert.equal(req.body.temperature, 0);
    assert.equal(req.body.messages.length, 2);
    assert.equal(req.body.messages[0].role, 'system');
    assert.equal(req.body.messages[1].role, 'user');
    assert.equal(req.body.messages[1].content, 'Schutzbrille tragen.');
    const system = req.body.messages[0].content;
    assert.ok(system.includes('"Schutzbrille" → "safety goggles"'), system);
    assert.match(system, /from German to English/);
    assert.match(system, /numbers/);
    assert.match(system, /negation/);
    assert.match(system, /ONLY the translation/);
  });

  it('mit Schlüssel: Authorization: Bearer', async () => {
    const engine = createEngine('openai', { openaiBaseUrl: `${fake.base}/v1/`, openaiModel: 'm', openaiApiKey: 'sk-test' });
    await engine.translate('Hallo', 'de', 'uk', []);
    assert.equal(fake.last().headers.authorization, 'Bearer sk-test');
    assert.match(fake.last().body.messages[0].content, /to Ukrainian/);
  });

  it('Rückübersetzung ins Deutsche ohne Glossar nutzt den wörtlichen Prompt', async () => {
    const engine = createEngine('openai', { openaiBaseUrl: `${fake.base}/v1`, openaiModel: 'm' });
    await engine.translate('Wear safety goggles.', 'en', 'de', []);
    const system = fake.last().body.messages[0].content;
    assert.match(system, /LITERALLY/);
    assert.match(system, /into German/);
    assert.ok(!system.includes('→'));

    await engine.translate('Носіть окуляри.', 'uk', 'en', [], { literal: true });
    assert.match(fake.last().body.messages[0].content, /LITERALLY/);
  });

  it('Zugangsdaten in der Basis-URL werden zu Basic-Auth', async () => {
    const url = new URL(`${fake.base}/v1`);
    url.username = 'proxy';
    url.password = 'pw';
    const engine = createEngine('openai', { openaiBaseUrl: url.href, openaiModel: 'm' });
    await engine.translate('Hallo', 'de', 'en', []);
    assert.equal(fake.last().headers.authorization, `Basic ${Buffer.from('proxy:pw').toString('base64')}`);
  });
});

// ---------------------------------------------------------------------------

describe('deepl', () => {
  let fake;
  before(async () => {
    fake = await startFake((entry) => ({ json: { translations: [{ detected_source_language: 'DE', text: `${entry.body.target_lang}:${entry.body.text[0]}` }] } }));
  });
  after(() => fake.close());

  function engine(extra = {}) {
    return createEngine('deepl', { deeplApiUrl: fake.base, deeplApiKey: 'abc-123:fx', ...extra });
  }

  it('sendet DeepL-Auth-Key und bildet target_lang ab', async () => {
    const e = engine();
    assert.equal(await e.translate('Helm tragen', 'de', 'en'), 'EN-GB:Helm tragen');
    let req = fake.last();
    assert.equal(req.url, '/v2/translate');
    assert.equal(req.headers.authorization, 'DeepL-Auth-Key abc-123:fx');
    assert.deepEqual(req.body, { text: ['Helm tragen'], source_lang: 'DE', target_lang: 'EN-GB' });

    for (const [target, expected] of [['uk', 'UK'], ['ar', 'AR'], ['pt', 'PT-PT'], ['tr', 'TR']]) {
      await e.translate('Helm tragen', 'de', target);
      assert.equal(fake.last().body.target_lang, expected);
    }

    await e.translate('Wear a helmet', 'en', 'de');
    req = fake.last();
    assert.equal(req.body.source_lang, 'EN');
    assert.equal(req.body.target_lang, 'DE');
  });

  it('nutzt glossary_id aus DEEPL_GLOSSARY_IDS nur bei Ausgangssprache Deutsch', async () => {
    const e = engine({ deeplGlossaryIds: { en: 'glossar-en', pl: 'glossar-pl' } });
    await e.translate('Helm tragen', 'de', 'en');
    assert.equal(fake.last().body.glossary_id, 'glossar-en');
    await e.translate('Helm tragen', 'de', 'pl');
    assert.equal(fake.last().body.glossary_id, 'glossar-pl');
    await e.translate('Helm tragen', 'de', 'uk');
    assert.equal(fake.last().body.glossary_id, undefined);
    await e.translate('Wear a helmet', 'en', 'de');
    assert.equal(fake.last().body.glossary_id, undefined);
  });
});

// ---------------------------------------------------------------------------

describe('Fehlerbehandlung der Adapter', () => {
  let fake;
  before(async () => {
    fake = await startFake((entry) => {
      if (entry.url.startsWith('/slow')) return { delayMs: 300, json: { translatedText: 'zu spät' } };
      if (entry.url.startsWith('/empty')) return { json: { foo: 1 } };
      return { status: 403, json: { message: `Ungültiger Schlüssel ${entry.headers.authorization}` } };
    });
  });
  after(() => fake.close());

  it('HTTP-Fehler ergeben kurze Codes ohne Schlüssel und URL', async () => {
    const e = createEngine('deepl', { deeplApiUrl: fake.base, deeplApiKey: 'super-geheim:fx' });
    await assert.rejects(e.translate('Text', 'de', 'en'), (err) => {
      assert.ok(err instanceof EngineError);
      assert.equal(err.message, 'deepl: http_403');
      assert.equal(err.code, 'http_403');
      assert.ok(!String(err.stack).includes('super-geheim'));
      assert.ok(!err.message.includes('127.0.0.1'));
      return true;
    });
  });

  it('nicht erreichbar → unreachable, ohne Zugangsdaten in der Meldung', async () => {
    const port = await closedPort();
    const e = createEngine('libretranslate', { libretranslateUrl: `http://nutzer:pw-geheim@127.0.0.1:${port}` });
    await assert.rejects(e.translate('Text', 'de', 'en'), (err) => {
      assert.equal(err.message, 'libretranslate: unreachable');
      assert.ok(!err.message.includes('pw-geheim'));
      return true;
    });
  });

  it('Zeitüberschreitung → timeout', async () => {
    const e = createEngine('libretranslate', { libretranslateUrl: `${fake.base}/slow`, translateTimeoutMs: 80 });
    await assert.rejects(e.translate('Text', 'de', 'en'), { message: 'libretranslate: timeout' });
  });

  it('unerwartete Antwort → bad_response', async () => {
    const e = createEngine('openai', { openaiBaseUrl: `${fake.base}/empty`, openaiModel: 'm' });
    await assert.rejects(e.translate('Text', 'de', 'en'), { message: 'openai: bad_response' });
  });
});

// ---------------------------------------------------------------------------

describe('POST /api/translate mit Fake-Engines', () => {
  let lt;
  let llm;
  let app;
  let lines;

  before(async () => {
    // LibreTranslate-Fake: "fr" schlägt fehl; Übersetzung ins Deutsche entfernt das Präfix.
    lt = await startFake((entry) => {
      const { q, target } = entry.body;
      if (target === 'fr') return { status: 500, json: { error: `kaputt: ${q}` } };
      return { json: { translatedText: target === 'de' ? q.replace(/^<\w+> /, '') : `<${target}> ${q}` } };
    });
    llm = await startFake((entry) => {
      const user = entry.body.messages[1].content;
      return { json: { choices: [{ message: { content: user.replace(/^<\w+> /, '') } }] } };
    });
    lines = [];
    app = createApp({
      translateEngine: 'libretranslate',
      libretranslateUrl: lt.base,
      log: (line) => lines.push(line),
    });
    await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    await app.shutdown();
    await lt.close();
    await llm.close();
  });

  const base = () => `http://127.0.0.1:${app.address().port}`;

  it('Teilausfall: fehlerhafte Sprache bekommt engine_failed, andere sind ok (HTTP 200)', async () => {
    const text = 'Vor Arbeitsbeginn Not-Aus prüfen.';
    const res = await postJson(base(), '/api/translate', { text, targets: ['en', 'fr', 'pl'] });
    assert.equal(res.status, 200);
    assert.equal(res.body.engine, 'libretranslate');
    assert.equal(res.body.backEngine, 'libretranslate');
    assert.deepEqual(res.body.results.fr, { error: 'engine_failed' });
    assert.equal(res.body.results.en.text, `<en> ${text}`);
    assert.equal(res.body.results.en.back, text);
    assert.equal(res.body.results.pl.text, `<pl> ${text}`);
    assert.equal(res.body.results.pl.back, text);

    // Rückübersetzung läuft ziel → de
    const backCall = lt.requests.find((r) => r.body.target === 'de' && r.body.q === `<en> ${text}`);
    assert.equal(backCall.body.source, 'en');

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(lines.some((line) => line.includes('fr') && line.includes('libretranslate: http_500')));
    for (const line of lines) {
      assert.ok(!line.includes('Not-Aus'), 'kein Inhalt im Log');
      assert.ok(!line.includes(lt.base), 'keine Upstream-URL im Log');
    }
  });

  it('alle Sprachen fehlgeschlagen → 502 engine_failed', async () => {
    const res = await postJson(base(), '/api/translate', { text: 'Hallo', targets: ['fr'] });
    assert.equal(res.status, 502);
    assert.deepEqual(res.body, { error: 'engine_failed' });
  });

  it('getrennte Rückübersetzungs-Engine erhält die Übersetzung ohne Glossar', async () => {
    const mixed = createApp({
      translateEngine: 'libretranslate',
      backEngine: 'openai',
      libretranslateUrl: lt.base,
      openaiBaseUrl: `${llm.base}/v1`,
      openaiModel: 'check-model',
      log: () => {},
    });
    await new Promise((resolve) => mixed.listen(0, '127.0.0.1', resolve));
    try {
      const res = await postJson(`http://127.0.0.1:${mixed.address().port}`, '/api/translate', {
        text: 'Schutzbrille tragen.',
        targets: ['en'],
        glossary: [{ de: 'Schutzbrille', targets: { en: 'safety goggles' } }],
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.engine, 'libretranslate');
      assert.equal(res.body.backEngine, 'openai');
      assert.equal(res.body.results.en.back, 'Schutzbrille tragen.');
      const call = llm.last();
      assert.equal(call.body.messages[1].content, '<en> Schutzbrille tragen.');
      assert.match(call.body.messages[0].content, /LITERALLY/);
      assert.ok(!call.body.messages[0].content.includes('safety goggles'));
    } finally {
      await mixed.shutdown();
    }
  });

  it('Glossar wird je Zielsprache an die openai-Engine weitergereicht', async () => {
    const glossaryApp = createApp({
      translateEngine: 'openai',
      openaiBaseUrl: `${llm.base}/v1`,
      openaiModel: 'm',
      log: () => {},
    });
    await new Promise((resolve) => glossaryApp.listen(0, '127.0.0.1', resolve));
    try {
      const before = llm.requests.length;
      const res = await postJson(`http://127.0.0.1:${glossaryApp.address().port}`, '/api/translate', {
        text: 'Schutzbrille tragen.',
        targets: ['en', 'pl'],
        glossary: [{ de: 'Schutzbrille', targets: { en: 'safety goggles', pl: 'okulary ochronne' } }],
      });
      assert.equal(res.status, 200);
      const prompts = llm.requests.slice(before).map((r) => r.body.messages[0].content);
      assert.ok(prompts.some((p) => p.includes('"Schutzbrille" → "safety goggles"') && p.includes('to English')));
      assert.ok(prompts.some((p) => p.includes('"Schutzbrille" → "okulary ochronne"') && p.includes('to Polish')));
      assert.equal(prompts.filter((p) => p.includes('LITERALLY')).length, 2);
    } finally {
      await glossaryApp.shutdown();
    }
  });
});

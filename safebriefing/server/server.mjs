#!/usr/bin/env node
// SafeBriefing Edge-Server
//
// Läuft lokal im Werk (Laptop/Industrie-PC), auch ohne Internet. Liefert die
// Browser-App aus, verteilt Briefings per Server-Sent Events an die Geräte der
// Beschäftigten und vermittelt Übersetzung, Rückübersetzung und Spracherkennung.
//
// Datenschutz: Briefings, Übersetzungen und Audio liegen ausschließlich im
// Arbeitsspeicher. Nichts wird auf die Festplatte geschrieben, Inhalte werden nie
// protokolliert. Nach Beenden des Servers sind alle Daten weg.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { buildConfig, loadConfig, VERSION } from './config.mjs';
import { createEngine, createStt, EngineError } from './engines.mjs';

export const JSON_LIMIT = 64 * 1024;
export const AUDIO_LIMIT = 10 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_TARGETS = 12;
export const MAX_GLOSSARY = 200;
const MAX_TERM_LENGTH = 200;
// Clients, die so viel ungelesene SSE-Daten anstauen, werden getrennt (Schutz des RAM).
const SSE_MAX_BUFFER = 1024 * 1024;
const TYPE_RE = /^[a-z][a-z0-9_.-]{0,47}$/;
const LANG_RE = /^[a-z]{2}(-[A-Z]{2})?$/;

export const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
});

export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'SAMEORIGIN',
  // Mikrofon bleibt für die eigene Seite erlaubt (Spracheingabe der Führungskraft).
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
  ].join('; '),
});

class HttpError extends Error {
  constructor(status, code, headers) {
    super(code);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

// ---------------------------------------------------------------------------
// Antworten und Request-Bodies
// ---------------------------------------------------------------------------

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text),
    ...headers,
  });
  res.end(text);
}

/** Liest den Body vollständig in den Arbeitsspeicher, höchstens `limit` Bytes. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      // Kleine Überschreitungen liest Node nach der Antwort aus (Keep-Alive bleibt
      // sauber); bei extremen Angaben wird die Verbindung geschlossen.
      reject(new HttpError(413, 'too_large', declared > limit * 4 ? { Connection: 'close' } : undefined));
      return;
    }
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (settled) {
        if (size > limit * 4) req.destroy();
        return;
      }
      if (size > limit) {
        settled = true;
        chunks.length = 0;
        reject(new HttpError(413, 'too_large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, size));
    });
    req.on('close', () => {
      if (settled) return;
      settled = true;
      reject(new HttpError(400, 'aborted'));
    });
  });
}

async function readJson(req) {
  const body = await readBody(req, JSON_LIMIT);
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

/**
 * Schutz gegen Cross-Site-Requests: Eine fremde Webseite, die ein Beschäftigter
 * im Werks-WLAN öffnet, darf keine Briefings einschleusen oder löschen.
 * Clients ohne Origin-Header (curl, Skripte) sind erlaubt.
 */
function isCrossOrigin(req) {
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return true;
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}

/** Fehlerbezeichnung ohne Inhalte, URLs oder Schlüssel – nur für das Betriebslog. */
function safeErrorCode(err) {
  if (err instanceof EngineError) return err.message;
  return (err && err.name) || 'Error';
}

// ---------------------------------------------------------------------------
// Netzwerk-Adressen (für Banner und QR-Code der Browser-App)
// ---------------------------------------------------------------------------

// Virtuelle Adapter (Docker, VMs, VPN) ans Ende sortieren, damit der QR-Code
// möglichst die WLAN-/LAN-Adresse zeigt.
const VIRTUAL_IFACE_RE = /^(docker|br-|veth|virbr|vmnet|vboxnet|lxc|lxd|cni|flannel|cali|tun|tap|utun|wg|zt|tailscale)|vethernet|virtualbox|vmware|hyper-v|wsl/i;

/**
 * Liefert http-URLs aller externen IPv4-Adressen, unter denen der Server
 * erreichbar ist. `address` ist das Ergebnis von server.address().
 */
export function lanUrls(address, interfaces = os.networkInterfaces()) {
  if (!address || typeof address !== 'object') return [];
  const wildcard = address.address === '0.0.0.0' || address.address === '::' || address.address === '';
  const found = [];
  for (const [name, list] of Object.entries(interfaces || {})) {
    for (const info of list || []) {
      const ipv4 = info.family === 'IPv4' || info.family === 4;
      if (!ipv4 || info.internal) continue;
      if (!wildcard && info.address !== address.address) continue;
      const rank = (VIRTUAL_IFACE_RE.test(name) ? 2 : 0) + (info.address.startsWith('169.254.') ? 1 : 0);
      found.push({ url: `http://${info.address}:${address.port}/`, rank });
    }
  }
  found.sort((a, b) => a.rank - b.rank);
  return [...new Set(found.map((entry) => entry.url))];
}

// ---------------------------------------------------------------------------
// Server-Sent Events: Verteilung der Briefings, Ringpuffer im RAM
// ---------------------------------------------------------------------------

function sseFrame(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function createHub({ heartbeatMs, ringSize, maxClients }) {
  const clients = new Set();
  const ring = [];
  let heartbeat = null;

  function send(res, chunk) {
    if (res.destroyed || res.writableEnded) return false;
    if (res.writableLength > SSE_MAX_BUFFER) {
      res.destroy();
      return false;
    }
    res.write(chunk);
    return true;
  }

  function broadcast(event, data) {
    const chunk = sseFrame(event, data);
    let delivered = 0;
    for (const res of clients) if (send(res, chunk)) delivered += 1;
    return delivered;
  }

  function startHeartbeat() {
    if (heartbeat || !(heartbeatMs > 0)) return;
    heartbeat = setInterval(() => {
      for (const res of clients) send(res, ': ping\n\n');
    }, heartbeatMs);
    heartbeat.unref();
  }

  function stopHeartbeat() {
    clearInterval(heartbeat);
    heartbeat = null;
  }

  return {
    get size() {
      return clients.size;
    },

    accept(req, res) {
      if (clients.size >= maxClients) throw new HttpError(503, 'too_many_clients');
      req.socket.setTimeout(0);
      req.socket.setNoDelay(true);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      clients.add(res);
      res.write('retry: 3000\n\n');
      send(res, sseFrame('hello', { clients: clients.size }));
      for (const msg of ring) send(res, sseFrame('msg', msg));
      broadcast('presence', { clients: clients.size });
      startHeartbeat();
      res.on('close', () => {
        if (!clients.delete(res)) return;
        broadcast('presence', { clients: clients.size });
        if (clients.size === 0) stopHeartbeat();
      });
    },

    publish(type, data) {
      const msg = { id: randomUUID(), type, data: data === undefined ? null : data, ts: Date.now() };
      ring.push(msg);
      while (ring.length > ringSize) ring.shift();
      return { id: msg.id, delivered: broadcast('msg', msg) };
    },

    reset() {
      ring.length = 0;
      broadcast('reset', { ts: Date.now() });
    },

    close() {
      stopHeartbeat();
      const open = [...clients];
      clients.clear();
      for (const res of open) res.end();
    },
  };
}

// ---------------------------------------------------------------------------
// Übersetzung: Validierung und Glossar
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidGlossaryEntry(entry) {
  if (!isPlainObject(entry)) return false;
  if (typeof entry.de !== 'string' || !entry.de.trim() || entry.de.length > MAX_TERM_LENGTH) return false;
  if (entry.targets === undefined) return true;
  if (!isPlainObject(entry.targets)) return false;
  return Object.values(entry.targets).every((v) => typeof v !== 'string' || v.length <= MAX_TERM_LENGTH);
}

/** Prüft den Body von POST /api/translate; wirft HttpError(400) bei Fehlern. */
export function validateTranslateRequest(body) {
  const input = isPlainObject(body) ? body : {};
  const { text } = input;
  if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, 'bad_text');
  if (text.length > MAX_TEXT_LENGTH) throw new HttpError(400, 'text_too_long');

  const source = input.source === undefined || input.source === null ? 'de' : input.source;
  if (typeof source !== 'string' || !LANG_RE.test(source)) throw new HttpError(400, 'bad_source');

  const { targets } = input;
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > MAX_TARGETS
    || !targets.every((t) => typeof t === 'string' && LANG_RE.test(t))) {
    throw new HttpError(400, 'bad_targets');
  }

  const glossary = input.glossary === undefined || input.glossary === null ? [] : input.glossary;
  if (!Array.isArray(glossary) || glossary.length > MAX_GLOSSARY || !glossary.every(isValidGlossaryEntry)) {
    throw new HttpError(400, 'bad_glossary');
  }
  return { text, source, targets: [...new Set(targets)], glossary };
}

/** Glossar-Paare {de, target} für eine Zielsprache (Fallback: Basissprache, z. B. pt für pt-BR). */
export function glossaryFor(glossary, target) {
  const base = target.split('-')[0];
  const pairs = [];
  for (const entry of glossary) {
    const terms = isPlainObject(entry.targets) ? entry.targets : {};
    const candidate = [terms[target], terms[base]].find((v) => typeof v === 'string' && v.trim());
    if (candidate) pairs.push({ de: entry.de.trim(), target: candidate.trim() });
  }
  return pairs;
}

function elapsedMs(started) {
  return Math.round(performance.now() - started);
}

// ---------------------------------------------------------------------------
// Statische Dateien (Browser-App)
// ---------------------------------------------------------------------------

/**
 * Bildet einen URL-Pfad sicher auf eine Datei unterhalb von `root` ab.
 * Gibt null zurück bei Traversal-Versuchen ("..", auch kodiert), kodierten
 * Pfadtrennern, NUL-Bytes, Backslashes, Laufwerksangaben und versteckten Dateien.
 */
export function resolveStaticPath(root, rawPathname) {
  if (typeof rawPathname !== 'string' || !rawPathname.startsWith('/')) return null;
  if (/%(2f|5c|00)/i.test(rawPathname)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }
  if (/[\0\\:]/.test(decoded)) return null;
  const segments = decoded.split('/').filter(Boolean);
  // ".", ".." und versteckte Dateien wie .env oder .git
  if (segments.some((segment) => segment.startsWith('.'))) return null;
  const absRoot = path.resolve(root);
  const filePath = path.resolve(absRoot, ...segments);
  if (filePath !== absRoot && !filePath.startsWith(absRoot + path.sep)) return null;
  return { filePath, segments, directoryRequest: decoded.endsWith('/') };
}

function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Löst Symlinks auf und stellt sicher, dass das Ziel im Wurzelverzeichnis bleibt. */
async function statInsideRoot(root, filePath) {
  try {
    const [rootReal, real] = await Promise.all([fsp.realpath(root), fsp.realpath(filePath)]);
    if (!isInside(rootReal, real)) return null;
    return { real, stat: await fsp.stat(real) };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

/**
 * Erzeugt den HTTP-Server (noch nicht lauschend).
 * `options` sind Konfigurationswerte wie von loadConfig(); fehlende Werte
 * kommen aus den Standardwerten. Zusätzlich: `log` (Funktion für Logzeilen).
 * Rückgabe: http.Server mit `shutdown()` und `app` (Konfiguration, Engines).
 */
export function createApp(options = {}) {
  const config = buildConfig({});
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) config[key] = value;
  }
  if (options.backEngine === undefined && options.translateEngine !== undefined) {
    config.backEngine = options.translateEngine;
  }

  // Bewusst minimales Logging (Betriebsrat/DSGVO): pro Request nur Methode,
  // Pfad ohne Query-String, Status und Dauer. Niemals Request-/Response-Bodies,
  // Texte, Übersetzungen, Audio, IP-Adressen oder Geräte-Kennungen – so ist
  // keine Leistungs- oder Verhaltenskontrolle der Beschäftigten möglich.
  const log = typeof config.log === 'function' ? config.log : (line) => console.log(line);

  const engine = createEngine(config.translateEngine, config);
  const backEngine = createEngine(config.backEngine || config.translateEngine, config);
  const stt = createStt(config);
  const hub = createHub({
    heartbeatMs: Number(config.heartbeatMs),
    ringSize: Math.max(1, Number(config.ringSize) || 100),
    maxClients: Math.max(1, Number(config.maxSseClients) || 500),
  });

  const server = http.createServer({ requestTimeout: 120000, headersTimeout: 30000 });

  // --- API-Routen --------------------------------------------------------

  function health(req, res) {
    sendJson(res, 200, {
      ok: true,
      mode: 'edge',
      version: VERSION,
      engine: { name: engine.name, configured: engine.configured },
      backEngine: { name: backEngine.name, configured: backEngine.configured },
      stt: { name: stt.name, configured: stt.configured },
      clients: hub.size,
      lanUrls: lanUrls(server.address()),
      ramOnly: true,
    });
  }

  function events(req, res) {
    hub.accept(req, res);
  }

  async function publish(req, res) {
    const body = await readJson(req);
    const { type, data } = isPlainObject(body) ? body : {};
    if (typeof type !== 'string' || !TYPE_RE.test(type)) throw new HttpError(400, 'bad_type');
    const { id, delivered } = hub.publish(type, data);
    sendJson(res, 200, { ok: true, id, delivered });
  }

  async function reset(req, res) {
    hub.reset();
    sendJson(res, 200, { ok: true });
  }

  async function translateOne(input, target) {
    const started = performance.now();
    if (target === input.source) return [target, { text: input.text, back: input.text, ms: 0 }];
    try {
      const pairs = glossaryFor(input.glossary, target);
      const text = await engine.translate(input.text, input.source, target, pairs, { literal: false });
      // Rückübersetzung bewusst OHNE Glossar, damit Fehler sichtbar bleiben.
      const back = await backEngine.translate(text, target, input.source, [], { literal: true });
      return [target, { text, back, ms: elapsedMs(started) }];
    } catch (err) {
      log(`Übersetzung nach ${target} fehlgeschlagen (${safeErrorCode(err)})`);
      return [target, { error: 'engine_failed' }];
    }
  }

  async function translate(req, res) {
    const input = validateTranslateRequest(await readJson(req));
    if (!engine.configured || !backEngine.configured) throw new HttpError(503, 'no_engine');
    const started = performance.now();
    const entries = await Promise.all(input.targets.map((target) => translateOne(input, target)));
    if (entries.every(([, result]) => result.error)) throw new HttpError(502, 'engine_failed');
    sendJson(res, 200, {
      engine: engine.name,
      backEngine: backEngine.name,
      results: Object.fromEntries(entries),
      ms: elapsedMs(started),
    });
  }

  async function transcribe(req, res) {
    if (!stt.configured) throw new HttpError(503, 'no_stt');
    const contentType = String(req.headers['content-type'] || '').trim();
    if (!/^audio\/[a-z0-9.+-]+/i.test(contentType)) throw new HttpError(415, 'bad_content_type');
    // Audio bleibt ausschließlich im Arbeitsspeicher und wird nur weitergereicht.
    const audio = await readBody(req, AUDIO_LIMIT);
    if (audio.length === 0) throw new HttpError(400, 'empty_audio');
    let text;
    try {
      text = await stt.transcribe(audio, contentType);
    } catch (err) {
      log(`Spracherkennung fehlgeschlagen (${safeErrorCode(err)})`);
      if (err instanceof EngineError && err.code === 'timeout') throw new HttpError(504, 'stt_timeout');
      throw new HttpError(502, 'stt_failed');
    }
    sendJson(res, 200, { text });
  }

  const routes = new Map([
    ['/api/health', { GET: health }],
    ['/api/events', { GET: events }],
    ['/api/publish', { POST: publish }],
    ['/api/reset', { POST: reset }],
    ['/api/translate', { POST: translate }],
    ['/api/stt', { POST: transcribe }],
  ]);

  async function handleApi(req, res, pathname) {
    const route = routes.get(pathname);
    if (!route) throw new HttpError(404, 'not_found');
    const handler = route[req.method];
    if (!handler) throw new HttpError(405, 'method_not_allowed', { Allow: Object.keys(route).join(', ') });
    if (req.method !== 'GET' && isCrossOrigin(req)) throw new HttpError(403, 'forbidden_origin');
    await handler(req, res);
  }

  // --- Statische Dateien -------------------------------------------------

  async function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(res, 405, 'Methode nicht erlaubt', { Allow: 'GET, HEAD' });
      return;
    }
    const resolved = resolveStaticPath(config.staticRoot, pathname);
    let found = resolved && await statInsideRoot(config.staticRoot, resolved.filePath);
    let logicalPath = resolved ? resolved.filePath : '';
    if (found && found.stat.isDirectory()) {
      if (!resolved.directoryRequest) {
        // Neu aufgebaut aus geprüften Segmenten: verhindert offene Weiterleitungen ("//evil.example").
        const location = `/${resolved.segments.map(encodeURIComponent).join('/')}/`;
        sendText(res, 301, 'Weiterleitung', { Location: location });
        return;
      }
      logicalPath = path.join(resolved.filePath, 'index.html');
      found = await statInsideRoot(config.staticRoot, logicalPath);
    }
    if (!found || !found.stat.isFile()) {
      sendText(res, 404, 'Nicht gefunden');
      return;
    }

    let handle;
    try {
      handle = await fsp.open(found.real, 'r');
    } catch {
      sendText(res, 404, 'Nicht gefunden');
      return;
    }
    const ext = path.extname(logicalPath).toLowerCase();
    const isHtml = ext === '.html' || ext === '.htm';
    const { stat } = found;
    const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const cacheControl = isHtml ? 'no-store' : 'public, max-age=300';
    if (!isHtml && req.headers['if-none-match'] === etag) {
      await handle.close();
      res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl });
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': cacheControl,
      'Last-Modified': stat.mtime.toUTCString(),
      ETag: etag,
    });
    if (req.method === 'HEAD') {
      await handle.close();
      res.end();
      return;
    }
    await pipeline(handle.createReadStream(), res).catch(() => {});
  }

  // --- Request-Verarbeitung ---------------------------------------------

  function sendError(res, err) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.code }, err.headers);
      return;
    }
    log(`Interner Fehler (${safeErrorCode(err)})`);
    sendJson(res, 500, { error: 'internal' });
  }

  server.on('request', (req, res) => {
    const started = process.hrtime.bigint();
    const pathname = (req.url || '/').split('?')[0];
    res.once('close', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const clean = (value) => String(value).replace(/[^\x21-\x7e]/g, '?').slice(0, 200);
      log(`${new Date().toISOString()} ${clean(req.method)} ${clean(pathname)} ${res.statusCode} ${Math.round(ms)}ms`);
    });
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);

    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    const work = isApi ? handleApi(req, res, pathname) : serveStatic(req, res, pathname);
    work.catch((err) => sendError(res, err));
  });

  server.on('close', () => hub.close());

  /** Beendet SSE-Verbindungen und schließt den Server. */
  server.shutdown = () => new Promise((resolve) => {
    hub.close();
    if (!server.listening) {
      resolve();
      return;
    }
    server.close(() => resolve());
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
  });

  server.app = { config, engine, backEngine, stt };
  return server;
}

// ---------------------------------------------------------------------------
// Start als eigenständiger Prozess
// ---------------------------------------------------------------------------

function isLocalHostname(hostname) {
  const h = String(hostname).replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || /\.(localhost|local|lan|internal|home\.arpa)$/.test(h)) return true;
  if (!h.includes('.') && !h.includes(':')) return true; // Einzelname im LAN, z. B. "ollama"
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || h.startsWith('fe80:');
}

function hostnameOf(urlString) {
  try {
    return new URL(urlString).hostname;
  } catch {
    return '';
  }
}

function engineHost(name, config) {
  if (name === 'libretranslate') return hostnameOf(config.libretranslateUrl);
  if (name === 'openai') return hostnameOf(config.openaiBaseUrl);
  if (name === 'deepl') return hostnameOf(config.deeplApiUrl || 'https://api-free.deepl.com');
  return '';
}

function describeEngine(engine) {
  if (engine.name === 'none') return 'keine';
  return engine.configured ? engine.name : `${engine.name} (NICHT konfiguriert – Einstellungen fehlen)`;
}

function printBanner(server) {
  const { config, engine, backEngine, stt } = server.app;
  const address = server.address();
  const wildcard = address.address === '0.0.0.0' || address.address === '::';
  const localHost = wildcard ? 'localhost' : (address.address.includes(':') ? `[${address.address}]` : address.address);
  const lan = lanUrls(address);
  const appFound = fs.existsSync(path.join(config.staticRoot, 'index.html'));

  const hints = [];
  if (engine.name === 'none') hints.push('Hinweis: Keine Übersetzungs-Engine aktiv – /api/translate antwortet mit 503.');
  if (engine.name === 'mock' || backEngine.name === 'mock') {
    hints.push('ACHTUNG: Mock-Engine aktiv – Schein-Übersetzungen nur für Demos, nicht für echte Unterweisungen!');
  }
  if (engine.configured && engine.name === backEngine.name && engine.name !== 'mock') {
    hints.push('Tipp: Für eine unabhängige Prüfung BACK_ENGINE auf eine andere Engine setzen.');
  }
  const external = [
    ...new Set([engine.name, backEngine.name].filter((n) => n !== 'none' && n !== 'mock')),
  ].map((name) => [name, engineHost(name, config)]);
  if (stt.configured) external.push(['Spracherkennung', hostnameOf(config.sttUrl)]);
  for (const [label, host] of external) {
    if (host && !isLocalHostname(host)) {
      hints.push(`Datenschutz: ${label} nutzt einen externen Dienst (${host}) – Inhalte verlassen das Werksnetz.`);
    }
  }

  const lines = [
    '',
    `  SafeBriefing Edge-Server ${VERSION}`,
    '  Alle Daten nur im Arbeitsspeicher · keine Inhalte im Log · kein Audio auf der Festplatte',
    '',
    `  Übersetzung:      ${describeEngine(engine)}`,
    `  Rückübersetzung:  ${describeEngine(backEngine)}`,
    `  Spracherkennung:  ${stt.configured ? 'aktiv (OpenAI-kompatibler Whisper-Server)' : 'nicht konfiguriert'}`,
    `  Browser-App:      ${config.staticRoot}${appFound ? '' : '  (index.html nicht gefunden!)'}`,
    '',
    `  Lokal:            http://${localHost}:${address.port}/`,
    ...lan.map((url, i) => `  ${i === 0 ? 'Im Netzwerk:     ' : '                 '} ${url}`),
    '',
    ...hints.map((hint) => `  ${hint}`),
    ...(hints.length ? [''] : []),
    '  Beenden mit Strg+C',
    '',
  ];
  console.log(lines.join('\n'));
}

function main() {
  let server;
  try {
    server = createApp(loadConfig());
  } catch (err) {
    console.error(`SafeBriefing: Konfigurationsfehler – ${err.message}`);
    process.exitCode = 1;
    return;
  }
  const { config } = server.app;

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`SafeBriefing: Port ${config.port} ist bereits belegt – bitte anderen PORT wählen.`);
    else if (err.code === 'EACCES') console.error(`SafeBriefing: Keine Berechtigung für Port ${config.port} – Port über 1024 wählen.`);
    else console.error(`SafeBriefing: Serverfehler (${err.code || err.name})`);
    process.exit(1);
  });

  server.listen(config.port, config.host, () => printBanner(server));

  let stopping = false;
  const stop = (signal) => {
    if (stopping) process.exit(1); // zweites Strg+C: sofort beenden
    stopping = true;
    console.log(`\n${signal} empfangen – Server wird beendet, alle Daten im Arbeitsspeicher werden verworfen.`);
    const force = setTimeout(() => {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      process.exit(0);
    }, 5000);
    force.unref();
    server.shutdown().then(() => process.exit(0));
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
}

const isMain = (() => {
  try {
    return Boolean(process.argv[1])
      && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
})();

if (isMain) main();

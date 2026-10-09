// SafeBriefing Edge-Server – Konfiguration.
//
// Quellen (absteigende Priorität):
//   1. echte Umgebungsvariablen
//   2. optionale Datei server/config.env (KEY=VALUE, siehe config.example.env)
//   3. eingebaute Standardwerte
// Die Datei überschreibt niemals eine gesetzte Umgebungsvariable.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_NAMES } from './engines.mjs';

// Muss zur Version in package.json passen (wird im Test geprüft).
export const VERSION = '0.1.0';
export const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ENV_FILE = path.join(SERVER_DIR, 'config.env');
export const DEFAULT_STATIC_ROOT = path.resolve(SERVER_DIR, '../app');

/**
 * Liest KEY=VALUE-Zeilen. Leerzeilen und #-Kommentare werden ignoriert,
 * ein optionales "export " am Zeilenanfang ebenso. Werte dürfen in "..." oder
 * '...' stehen; bei Werten ohne Anführungszeichen beginnt mit " #" ein Kommentar.
 */
export function parseEnvFile(text) {
  const vars = {};
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    const quote = value[0];
    const end = quote === '"' || quote === "'" ? value.indexOf(quote, 1) : -1;
    if (end > 0) value = value.slice(1, end);
    else value = value.replace(/\s+#.*$/, '').trim();
    vars[match[1]] = value;
  }
  return vars;
}

/** Liest eine config.env-Datei; fehlt sie, gibt es ein leeres Objekt. */
export function readEnvFile(filePath) {
  try {
    return parseEnvFile(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return {};
    throw new Error(`Konfigurationsdatei ${filePath} nicht lesbar (${err && err.code ? err.code : 'Fehler'})`);
  }
}

function text(vars, key, fallback = '') {
  const value = vars[key];
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  return trimmed === '' ? fallback : trimmed;
}

function integer(vars, key, fallback, min, max) {
  const raw = text(vars, key);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`Ungültiger Wert für ${key} (erwartet: ganze Zahl ${min}–${max})`);
  }
  return n;
}

function engineName(vars, key, fallback) {
  const name = text(vars, key, fallback).toLowerCase();
  if (!ENGINE_NAMES.includes(name)) {
    throw new Error(`Unbekannte Engine in ${key}: "${name}" (erlaubt: ${ENGINE_NAMES.join(', ')})`);
  }
  return name;
}

// URLs werden nur auf Gültigkeit geprüft; Fehlermeldungen nennen bewusst nicht
// den Wert, weil er Zugangsdaten enthalten kann.
function url(vars, key) {
  const value = text(vars, key);
  if (!value) return '';
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} ist keine gültige URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${key} muss mit http:// oder https:// beginnen`);
  }
  return value;
}

function glossaryIds(vars, key) {
  const raw = text(vars, key);
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${key} ist kein gültiges JSON (Beispiel: {"en":"<glossar-id>"})`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || Object.values(parsed).some((v) => typeof v !== 'string')) {
    throw new Error(`${key} muss ein JSON-Objekt Sprache → Glossar-ID sein`);
  }
  return parsed;
}

/** Baut das Konfigurationsobjekt aus einem KEY→VALUE-Objekt (z. B. process.env). */
export function buildConfig(vars = {}) {
  const translateEngine = engineName(vars, 'TRANSLATE_ENGINE', 'none');
  const staticRoot = text(vars, 'STATIC_ROOT');
  return {
    host: text(vars, 'HOST', '0.0.0.0'),
    port: integer(vars, 'PORT', 8080, 0, 65535),
    translateEngine,
    // Leer = gleiche Engine wie TRANSLATE_ENGINE.
    backEngine: engineName(vars, 'BACK_ENGINE', translateEngine),
    translateTimeoutMs: integer(vars, 'TRANSLATE_TIMEOUT_MS', 15000, 1, 600000),
    libretranslateUrl: url(vars, 'LIBRETRANSLATE_URL'),
    libretranslateApiKey: text(vars, 'LIBRETRANSLATE_API_KEY'),
    openaiBaseUrl: url(vars, 'OPENAI_BASE_URL'),
    openaiModel: text(vars, 'OPENAI_MODEL'),
    openaiApiKey: text(vars, 'OPENAI_API_KEY'),
    deeplApiUrl: url(vars, 'DEEPL_API_URL'),
    deeplApiKey: text(vars, 'DEEPL_API_KEY'),
    deeplGlossaryIds: glossaryIds(vars, 'DEEPL_GLOSSARY_IDS'),
    sttUrl: url(vars, 'STT_URL'),
    sttModel: text(vars, 'STT_MODEL', 'Systran/faster-whisper-small'),
    sttLanguage: text(vars, 'STT_LANGUAGE', 'de'),
    sttApiKey: text(vars, 'STT_API_KEY'),
    sttTimeoutMs: integer(vars, 'STT_TIMEOUT_MS', 30000, 1, 600000),
    staticRoot: staticRoot ? path.resolve(staticRoot) : DEFAULT_STATIC_ROOT,
    // Nicht per Umgebung einstellbar, aber für Tests überschreibbar:
    heartbeatMs: 20000,
    ringSize: 100,
    maxSseClients: 500,
  };
}

/**
 * Lädt die Konfiguration aus Umgebung und optionaler config.env.
 * process.env wird dabei nicht verändert.
 */
export function loadConfig({ env = process.env, envFile = DEFAULT_ENV_FILE } = {}) {
  const vars = envFile ? { ...readEnvFile(envFile) } : {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) vars[key] = value;
  }
  return buildConfig(vars);
}

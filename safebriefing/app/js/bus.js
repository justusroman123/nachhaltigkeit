/*
 * SafeBriefing – Synchronisation zwischen Leitstand und Geräten
 *
 * Drei Wege, je nachdem wo die App läuft:
 *   1. BroadcastChannel  – mehrere Fenster im selben Browser (Demo, Beamer am Laptop)
 *   2. Edge-Server (SSE) – Handys, Brillen und Displays im Werks-WLAN, ohne Internet
 *   3. Artifact-Room     – Online-Demo auf claude.ai (gleiches Konto auf Laptop und Handy)
 * Jede Nachricht trägt eine eindeutige mid; doppelte Zustellungen werden verworfen.
 */
(function (root) {
  'use strict';

  var TOPICS = ['briefing.msg', 'briefing.quiz', 'briefing.quizend', 'briefing.reset', 'briefing.session', 'briefing.end', 'worker.ack', 'worker.feedback', 'worker.answer', 'worker.join'];
  var tabId = rid();
  var seen = new Set();
  var handlers = Object.create(null);
  var bc = null, es = null, room = null, edge = false;
  var status = { channel: false, edge: false, room: false, edgeClients: 0, roomPeers: 0 };
  var statusListeners = [];

  function rid() {
    try { return crypto.randomUUID(); } catch (e) { return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  }

  try {
    bc = new BroadcastChannel('safebriefing-v1');
    bc.onmessage = function (e) { deliver(e.data); };
    status.channel = true;
  } catch (e) { bc = null; }

  function on(type, fn) {
    (handlers[type] = handlers[type] || []).push(fn);
    return function () { handlers[type] = (handlers[type] || []).filter(function (f) { return f !== fn; }); };
  }

  function deliver(msg) {
    if (!msg || typeof msg !== 'object' || !msg.mid || !msg.type || seen.has(msg.mid)) return;
    seen.add(msg.mid);
    if (seen.size > 2000) seen = new Set(Array.from(seen).slice(-1000));
    (handlers[msg.type] || []).forEach(function (fn) { try { fn(msg.data, msg); } catch (err) { console.error(err); } });
    (handlers['*'] || []).forEach(function (fn) { try { fn(msg.data, msg); } catch (err) { console.error(err); } });
  }

  function publish(type, data) {
    var msg = { mid: rid(), type: type, data: data, from: tabId, ts: Date.now() };
    deliver(msg);
    if (bc) { try { bc.postMessage(msg); } catch (e) { /* nicht serialisierbar */ } }
    if (edge) {
      fetch('api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: type, data: msg }) })
        .catch(function () {});
    }
    if (room) { room.emit(type, msg).catch(function () {}); }
    return msg;
  }

  function connectEdge() {
    if (es) return;
    try {
      es = new EventSource('api/events');
      es.addEventListener('msg', function (e) {
        try { var m = JSON.parse(e.data); deliver(m && m.data); } catch (err) { /* ignorieren */ }
      });
      es.addEventListener('presence', function (e) {
        try { status.edgeClients = JSON.parse(e.data).clients || 0; emitStatus(); } catch (err) { /* ignorieren */ }
      });
      es.addEventListener('hello', function (e) {
        try { status.edgeClients = JSON.parse(e.data).clients || 0; } catch (err) { /* ignorieren */ }
        edge = true; status.edge = true; emitStatus();
      });
      es.onerror = function () { status.edge = es && es.readyState === 1; emitStatus(); };
    } catch (e) { es = null; }
  }

  function connectRoom(r) {
    if (!r || room) return;
    room = r;
    status.room = true;
    TOPICS.forEach(function (t) {
      r.on(t, function (m) { if (!m.sameTab) deliver(m.data); }, function () { status.room = false; emitStatus(); });
    });
    try {
      r.onPeers(function (peers) {
        var list = Array.isArray(peers) ? peers : (peers && peers.peers) || [];
        status.roomPeers = list.length;
        emitStatus();
      });
    } catch (e) { /* optional */ }
    emitStatus();
  }

  function onStatus(fn) { statusListeners.push(fn); }
  function emitStatus() { statusListeners.forEach(function (fn) { try { fn(status); } catch (e) { /* ignorieren */ } }); }

  root.SB_BUS = { on: on, publish: publish, connectEdge: connectEdge, connectRoom: connectRoom, onStatus: onStatus, status: status, tabId: tabId, rid: rid, TOPICS: TOPICS };
})(typeof globalThis !== 'undefined' ? globalThis : this);

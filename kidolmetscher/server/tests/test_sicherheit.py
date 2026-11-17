"""Sicherheit und Datenschutz im Betrieb (Gutachten): Groessenlimits vor der Anmeldung, Muell-Eingaben, Fluten, Audio-Zufluss,
Adressen im Log, Start nur mit sicheren Voreinstellungen. Alles nur mit Attrappen und eigenen Test-Prozessen auf 127.0.0.1."""
import asyncio
import json
import logging
import os
import re
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
from starlette.websockets import WebSocketDisconnect

from app.rooms import MsgQueue
from conftest import KEY, app_client, chunk, hdr, make_settings
from test_gespraech_ws import client_for, conv_room, guest_open, is_turn, link, op_open

ROOT = Path(__file__).resolve().parents[2]
SERVER = ROOT / "server"


# ---------------------------------------------------------------- Groessenlimits vor der Anmeldung
def test_riesiger_http_koerper_wird_vor_dem_schluessel_abgewiesen(client):
    r = client.post("/api/qr", content=b"x" * 40_000, headers={"Content-Type": "application/json"})      # ohne Schluessel
    assert r.status_code == 413
    r = client.post("/api/qr", content=b"x" * 40_000, headers={**hdr(), "Content-Type": "application/json"})
    assert r.status_code == 413
    assert client.post("/api/qr", json={"url": "https://example.org/a"}, headers=hdr()).status_code == 200      # normale Anfragen gehen weiter


@pytest.mark.parametrize("pfad", ["/ws/operator", "/ws/listener"])
def test_zu_grosses_hello_wird_abgewiesen(client, pfad):
    with client.websocket_connect(pfad) as ws:
        ws.send_text(json.dumps({"type": "hello", "operator_key": "x" * 6000, "token": "y" * 6000, "room_id": "r"}))
        with pytest.raises(WebSocketDisconnect) as ei:
            ws.receive_json()
        assert ei.value.code == 4400


def test_audioframe_ueber_dem_limit_wird_gezaehlt_nicht_verarbeitet(client):
    rid = client.post("/api/rooms", headers=hdr(), json={"mode": "gespraech", "langs": ["uk"]}).json()["room_id"]
    ws = client.stack.enter_context(client.websocket_connect("/ws/operator"))
    ws.send_json({"type": "hello", "room_id": rid, "operator_key": KEY})
    assert ws.receive_json()["type"] == "ready"
    ws.send_bytes(b"\x00\x00" * 40_000)                                        # 80 000 Byte: groesser als ein erlaubter Block
    s = client.get(f"/api/rooms/{rid}/stats", headers=hdr()).json()
    assert s["counters"].get("bad_frames", 0) >= 1


# ---------------------------------------------------------------- Muell-Eingaben stuerzen nicht ab, zaehlen als Fehlversuch
def test_einzelnes_unicode_surrogat_im_schluessel_ist_nur_ein_falscher_schluessel():
    s = make_settings(auth_max_fails=3, auth_block_s=60)
    with app_client(s) as c:
        for _ in range(3):
            with c.websocket_connect("/ws/operator") as ws:
                ws.send_text('{"type":"hello","room_id":"x","operator_key":"\\ud800"}')       # gueltiges JSON, nicht als UTF-8 kodierbar
                with pytest.raises(WebSocketDisconnect) as ei:
                    ws.receive_json()
                assert ei.value.code in (4401, 4430)
        with c.websocket_connect("/ws/operator") as ws:                                         # nach drei Fehlversuchen gesperrt (wurde mitgezaehlt)
            ws.send_text(json.dumps({"type": "hello", "room_id": "x", "operator_key": KEY}))
            with pytest.raises(WebSocketDisconnect) as ei:
                ws.receive_json()
            assert ei.value.code == 4430


def test_einzelnes_surrogat_als_zuhoerer_token_stuerzt_nicht_ab(client):
    client.post("/api/rooms", headers=hdr(), json={})                                           # damit es einen Raum gibt (hasht erst dann)
    with client.websocket_connect("/ws/listener") as ws:
        ws.send_text('{"type":"hello","token":"\\ud800"}')
        assert ws.receive_json()["code"] == "token_invalid"
    assert client.get("/healthz").json() == {"status": "ok"}


# ---------------------------------------------------------------- Fluten
def test_steuernachrichten_flut_wird_begrenzt_und_der_bedienplatz_bleibt_bedienbar():
    with client_for(make_settings(max_guests=2)) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"))
        op.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "staff"))[0]
        for i in range(3000):                                                                    # Gast ueberflutet mit Wortmeldungen/Rueckmeldungen
            uk.send_json({"type": "want", "on": i % 2 == 0})
        time.sleep(0.5)
        s = c.get(f"/api/rooms/{rid}/stats", headers=hdr()).json()
        assert s["counters"].get("ctl_dropped", 0) > 0, "die Flut muss gezaehlt und verworfen werden"
        op.send_json({"type": "talk", "on": False})                                              # der Mitarbeiter kann weiter normal arbeiten
        assert oprd.until(lambda m: m["type"] == "turn" and m["state"] in ("uebersetzt", "wiedergabe", "frei"), timeout=5.0)[0]


def test_gast_audio_wird_auf_echtzeit_begrenzt_und_gemeldet():
    with client_for(make_settings(max_guests=2)) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"))
        uk.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "gast:"))[0]
        for _ in range(400):                                                                     # 200 s Audio in einem Rutsch (Blocks a 0,5 s)
            uk.send_bytes(b"\x00\x00" * 8000)
        time.sleep(0.5)
        n = c.get(f"/api/rooms/{rid}/stats", headers=hdr()).json()["counters"]
        assert n.get("guest_audio_chunks", 0) < 120, "mehr als der Vorrat von 30 s plus Nachschub darf nicht angenommen werden"
        assert n.get("guest_audio_throttled", 0) > 0
        assert oprd.until(lambda m: m["type"] == "problem" and m["what"] == "audio_verworfen", timeout=3.0)[0], "Verwerfen muss gemeldet werden"


def test_zu_viele_wartende_hello_verbindungen_werden_abgewiesen(client):
    """MAX_HELLO_PER_CLIENT = 8: die neunte stumme Verbindung desselben Absenders wird sofort beendet."""
    from contextlib import ExitStack
    with ExitStack() as st:
        for _ in range(8):
            st.enter_context(client.websocket_connect("/ws/listener"))
        with client.websocket_connect("/ws/listener") as ws:
            with pytest.raises(WebSocketDisconnect) as ei:
                ws.receive_json()
            assert ei.value.code == 4400


# ---------------------------------------------------------------- Warteschlange: nie still verlieren
def test_ueberlauf_verwirft_zuerst_zustandsmeldungen_dann_zaehlt_er_verlorene_inhalte():
    q = MsgQueue(5)
    q.put_nowait({"type": "guest_message", "seq": 1})
    for i in range(4):
        q.put_nowait({"type": "turn", "n": i})
    q.put_nowait({"type": "guest_message", "seq": 2})                      # voll: aeltester Zustand fliegt raus, die Inhalte bleiben
    assert q.dropped == 1 and q.take_lost() == 0
    items = [q.get_nowait() for _ in range(q.qsize())]
    assert [m.get("seq") for m in items if m["type"] == "guest_message"] == [1, 2]
    q = MsgQueue(2)
    for i in range(5):
        q.put_nowait({"type": "guest_message", "seq": i})                  # nur Inhalte: aeltere gehen verloren, und das wird gezaehlt
    assert q.dropped == 3 and q.take_lost() == 3 and q.take_lost() == 0


def test_rueckmeldung_wird_nur_bei_aenderung_weitergegeben():
    from app.rooms import Room
    s = make_settings()
    room = Room("r1", s, time.time, ("uk",), "gespraech")
    token, _ = room.create_listener_token("uk")
    l = room.attach_listener(token)
    room.publish("uk", {"seq": 7, "text": "x", "audio": None})
    room._operator_q._d.clear()
    for _ in range(50):
        room.ack(f"gast:{l.id}", 7, "shown")
    assert room._operator_q.qsize() == 1                                    # nur die erste Rueckmeldung ist neu


# ---------------------------------------------------------------- Bedienplatz weg: Gaeste erfahren es, niemand wird abgeschnitten
def test_bedienplatz_getrennt_gaeste_erfahren_es_und_ein_sprechender_gast_bleibt_dran():
    with client_for(make_settings(max_guests=3)) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        a, ard, _ = guest_open(c, link(c, rid, "uk"))
        b, brd, _ = guest_open(c, link(c, rid, "uk"))
        a.send_json({"type": "talk", "on": True})
        assert ard.until(is_turn("spricht", "gast:"))[0]
        b.send_json({"type": "want", "on": True})
        assert brd.until(lambda m: m["type"] == "turn" and m["waiting"])[0]
        op.close()                                                          # kurzer Netzwackler am Bedienplatz
        m, _ = ard.until(lambda m: m["type"] == "operator" and m["online"] is False, timeout=3.0)
        assert m, "Gaeste muessen erfahren, dass niemand am Bedienplatz ist"
        time.sleep(0.5)
        t = c.get(f"/api/rooms/{rid}/stats", headers=hdr()).json()["turn"]
        assert t["state"] == "spricht" and t["who"].startswith("gast:"), "Gast darf nicht abgeschnitten werden"
        assert t["waiting"], "Wortmeldungen bleiben stehen"


# ---------------------------------------------------------------- Log: keine Adressen, keine Inhalte
def test_piper_und_whisper_warnungen_laufen_nicht_ins_log():
    import app.main  # noqa: F401
    for name in ("piper", "faster_whisper"):
        assert logging.getLogger(name).level >= logging.ERROR


def _freier_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _server_starten(befehl: list, port: int) -> subprocess.Popen:
    env = {**os.environ, "OPERATOR_KEY": KEY, "PORT": str(port), "HOST": "127.0.0.1", "PYTHONPATH": str(SERVER),
           "WEB_DIR": str(ROOT / "web")}
    p = subprocess.Popen(befehl, cwd=SERVER, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    ende = time.time() + 30
    while time.time() < ende:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.3):
                return p
        except OSError:
            if p.poll() is not None:
                raise AssertionError("Server startet nicht: " + (p.stdout.read() if p.stdout else ""))
            time.sleep(0.2)
    p.kill()
    raise AssertionError("Server startet nicht rechtzeitig")


def _verbinden_und_beenden(p: subprocess.Popen, port: int, adresse: str) -> str:
    import websockets.sync.client as wsc
    try:
        for pfad in ("/ws/listener", "/ws/operator"):
            with wsc.connect(f"ws://127.0.0.1:{port}{pfad}", additional_headers={"X-Forwarded-For": adresse}) as ws:
                ws.send(json.dumps({"type": "hello", "token": "x", "operator_key": "falsch", "room_id": "r"}))
                try:
                    ws.recv(timeout=3)
                except Exception:
                    pass
        import urllib.request
        urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{port}/healthz", headers={"X-Forwarded-For": adresse}), timeout=3).read()
    finally:
        p.terminate()
        try:
            out, _ = p.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            p.kill()
            out, _ = p.communicate()
    return out or ""


@pytest.mark.parametrize("variante", ["python-m-app", "uvicorn-von-hand"])
def test_im_log_des_echten_servers_stehen_keine_adressen(variante):
    """Startet den Server wirklich (eigener Prozess) und prueft die Ausgabe: weder die Adresse aus X-Forwarded-For noch
    uvicorn-Verbindungszeilen ("WebSocket ... [accepted]") duerfen auftauchen. Gilt auch, wenn jemand uvicorn von Hand startet."""
    port = _freier_port()
    if variante == "python-m-app":
        befehl = [sys.executable, "-m", "app"]
    else:
        befehl = [sys.executable, "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "127.0.0.1", "--port", str(port), "--no-access-log"]
    p = _server_starten(befehl, port)
    out = _verbinden_und_beenden(p, port, "203.0.113.77")
    assert "203.0.113.77" not in out, out[-2000:]
    assert "[accepted]" not in out and "WebSocket /ws" not in out and "connection open" not in out, out[-2000:]
    assert not re.search(r"\d+\.\d+\.\d+\.\d+:\d+ - ", out), out[-2000:]            # Format der Verbindungszeilen: "<ip>:<port> - ..." (die Startzeile mit der eigenen Adresse ist erlaubt)


def test_alle_startwege_nutzen_die_sicheren_voreinstellungen():
    """Ein Startweg ohne die Optionen (kleine WebSocket-Frames, keine Adressen im Log) waere eine Luecke: alle Skripte starten `python -m app`."""
    dateien = {"start.sh": "-m app", "start.bat": "-m app", "docker/Dockerfile.gpu": '"-m", "app"',
               "scripts/server_ctl.sh": "-m app", "scripts/cloud-init-gpu.sh": "-m app"}
    for name, muster in dateien.items():
        text = (ROOT / name).read_text(encoding="utf-8")
        assert muster in text, f"{name}: startet nicht ueber 'python -m app'"
        assert "uvicorn app.main" not in text and "uvicorn.exe\" app.main" not in text, f"{name}: startet uvicorn direkt"
    main = (SERVER / "app" / "__main__.py").read_text(encoding="utf-8")
    for opt in ("access_log=False", "proxy_headers=False", "ws_max_size", "limit_concurrency", "ws_ping_interval"):
        assert opt in main, f"__main__.py: {opt} fehlt"
    assert "LimitNOFILE" in (ROOT / "scripts" / "cloud-init-gpu.sh").read_text(encoding="utf-8")

"""Gespraechsmodus mit Attrappen: Sperre, Mitarbeiter -> Gaeste, Gast -> Mitarbeiter, Gaeste-Grenze."""
import concurrent.futures

import pytest

from conftest import app_client, chunk, hdr, make_settings
from test_api import open_listener, open_operator, token_of

_pool = concurrent.futures.ThreadPoolExecutor(max_workers=8)


def recv(ws, timeout=6.0):
    """receive_json mit Zeitgrenze (sonst haengt ein Fehler den ganzen Testlauf)."""
    return _pool.submit(ws.receive_json).result(timeout=timeout)


def recv_until(ws, pred, limit=40):
    seen = []
    for _ in range(limit):
        m = recv(ws)
        seen.append(m)
        if pred(m):
            return m, seen
    raise AssertionError(f"Nachricht nicht gefunden: {seen[-5:]}")


@pytest.fixture
def conv():
    with app_client(make_settings(max_guests=2)) as c:
        yield c


def new_conv_room(client, langs=("uk", "en")):
    r = client.post("/api/rooms", headers=hdr(), json={"mode": "gespraech", "langs": list(langs)})
    assert r.status_code == 200 and r.json()["mode"] == "gespraech"
    return r.json()["room_id"]


def link(client, rid, lang):
    r = client.post(f"/api/rooms/{rid}/listener-links", headers=hdr(), json={"lang": lang})
    return token_of(r.json())


def test_unbekannte_betriebsart_wird_abgelehnt(conv):
    assert conv.post("/api/rooms", headers=hdr(), json={"mode": "unsinn"}).status_code == 400


def test_mitarbeiter_spricht_gaeste_erhalten_und_melden_fertig(conv):
    rid = new_conv_room(conv)
    op = open_operator(conv, rid)
    uk = open_listener(conv, link(conv, rid, "uk"))
    ready = recv(uk)
    assert ready["type"] == "ready" and ready["mode"] == "gespraech" and ready["turn"]["state"] == "frei"
    op.send_json({"type": "talk", "on": True})
    assert recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == "staff")
    assert recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "spricht")
    for _ in range(3):
        op.send_bytes(chunk(100))
    op.send_json({"type": "talk", "on": False})
    got, seen = [], []
    while True:
        m = recv(uk)
        seen.append(m)
        if m["type"] == "translation":
            got.append(m["seq"])
            uk.send_json({"type": "played", "seq": m["seq"]})      # "fertig": Ton zu Ende oder Text angezeigt
        if m["type"] == "turn" and m["state"] == "frei":
            break
    assert len(got) >= 1
    states = [m["state"] for m in seen if m["type"] == "turn"]       # "spricht" wurde oben schon gelesen
    assert states[-1] == "frei" and "wiedergabe" in states and states.index("wiedergabe") < len(states) - 1


def test_waehrend_gesprochen_wird_ist_sprechen_gesperrt(conv):
    rid = new_conv_room(conv)
    op = open_operator(conv, rid)
    uk = open_listener(conv, link(conv, rid, "uk"))
    recv(uk)
    op.send_json({"type": "talk", "on": True})
    recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "spricht")
    uk.send_json({"type": "talk", "on": True})                     # Gast will auch sprechen: gesperrt
    assert recv_until(uk, lambda m: m["type"] == "busy")
    op.send_json({"type": "release"})                               # Notbremse
    assert recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "frei")


def test_gast_spricht_mitarbeiter_bekommt_deutschen_text(conv):
    rid = new_conv_room(conv)
    op = open_operator(conv, rid)
    uk = open_listener(conv, link(conv, rid, "uk"))
    recv(uk)
    uk.send_json({"type": "talk", "on": True})
    recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"].startswith("gast:"))
    op.send_json({"type": "talk", "on": True})                      # Mitarbeiter waehrend der Gast spricht: gesperrt
    assert recv_until(op, lambda m: m["type"] == "busy")
    for _ in range(3):
        uk.send_bytes(chunk(100))
    uk.send_json({"type": "talk", "on": False})
    m, _ = recv_until(op, lambda m: m["type"] == "guest_message")
    assert m["from_lang"] == "uk" and m["text"].startswith("[de] Dies ist Testsatz")
    assert set(m["t"]) == {"t_audio_in", "t_asr", "t_mt", "t_tts", "t_out"}
    recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "frei")


def test_gaeste_grenze(conv):
    rid = new_conv_room(conv)
    open_operator(conv, rid)
    a = open_listener(conv, link(conv, rid, "uk")); recv(a)
    b = open_listener(conv, link(conv, rid, "en")); recv(b)
    c = open_listener(conv, link(conv, rid, "uk"))
    assert recv(c)["code"] == "room_full"


def test_im_vortrag_gibt_es_keine_sperre(client):
    rid = client.post("/api/rooms", headers=hdr()).json()["room_id"]
    op = open_operator(client, rid)
    op.send_json({"type": "talk", "on": True})                      # wird ignoriert
    op.send_json({"type": "ping", "t": 1})
    assert recv_until(op, lambda m: m["type"] == "pong")

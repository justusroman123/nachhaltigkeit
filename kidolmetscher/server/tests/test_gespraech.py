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
    assert m["audio"] and m["t"]["t_tts"] is not None               # deutsche Vorlesung fuer den Mitarbeiter
    op.send_json({"type": "played", "seq": m["seq"]})               # Bedienplatz: fertig vorgelesen -> Sperre faellt
    for _ in range(10):                                             # weitere Abschnitte derselben Aussage ebenfalls quittieren
        x = recv(op)
        if x["type"] == "guest_message":
            op.send_json({"type": "played", "seq": x["seq"]})
        if x["type"] == "turn" and x["state"] == "frei":
            break
    else:
        raise AssertionError("Sperre wurde nicht frei")


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


def test_vortrag_zustellkontrolle_angezeigt_und_gesprochen(client):
    """Rueckmeldungen der Zuhoerer: der Bedienplatz sieht, wer es angezeigt und fertig gesprochen hat; flow zeigt busy."""
    rid = client.post("/api/rooms", headers=hdr()).json()["room_id"]
    uk = open_listener(client, token_of(client.post(f"/api/rooms/{rid}/listener-links", headers=hdr(), json={"lang": "uk"}).json()))
    recv(uk)
    op = open_operator(client, rid)
    for _ in range(3):
        op.send_bytes(chunk(100))
    msg, _ = recv_until(uk, lambda m: m["type"] == "translation")
    flow, _ = recv_until(op, lambda m: m["type"] == "flow" and m["busy"] is True)
    uk.send_json({"type": "shown", "seq": msg["seq"]})
    d, _ = recv_until(op, lambda m: m["type"] == "delivery" and m["seq"] == msg["seq"] and m["shown"] == 1)
    assert d["expected"] == 1 and d["played"] == 0 and d["lang"] == "uk"
    uk.send_json({"type": "played", "seq": msg["seq"]})
    recv_until(op, lambda m: m["type"] == "delivery" and m["seq"] == msg["seq"] and m["played"] == 1)
    recv_until(op, lambda m: m["type"] == "flow" and m["busy"] is False)          # alles angekommen


def test_gespraech_audio_ohne_sprechen_wird_ignoriert_und_sperre_wartet_auf_fertig(conv):
    """Mitarbeiter allein im Gespraech: Audio ohne vorheriges "Sprechen" wird verworfen; frei erst nach "fertig" aller Geraete."""
    rid = new_conv_room(conv, ("uk",))
    op = open_operator(conv, rid)
    uk = open_listener(conv, link(conv, rid, "uk"))
    ready = recv(uk)
    assert ready["mode"] == "gespraech" and ready["turn"]["state"] == "frei"
    for _ in range(4):
        op.send_bytes(chunk(100))                                  # ohne "Sprechen" gesendet: wird verworfen
    op.send_json({"type": "talk", "on": True})
    recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == "staff")
    for _ in range(3):
        op.send_bytes(chunk(100))
    op.send_json({"type": "talk", "on": False})
    texts, states = [], []
    while True:
        m = recv(uk)
        if m["type"] == "translation":
            texts.append(m["text"])
            uk.send_json({"type": "shown", "seq": m["seq"]})
            uk.send_json({"type": "played", "seq": m["seq"]})
        if m["type"] == "turn":
            states.append(m["state"])
            if m["state"] == "frei":
                break
    assert texts and len(texts) <= 2                                # nur die gesprochenen Saetze, keine aus dem verworfenen Audio
    assert "wiedergabe" in states and states[-1] == "frei"


def test_nur_zwei_betriebsarten(conv):
    assert conv.post("/api/rooms", headers=hdr(), json={"mode": "dolmetschen"}).status_code == 400
    for mode in ("vortrag", "gespraech"):
        assert conv.post("/api/rooms", headers=hdr(), json={"mode": mode}).status_code == 200


def test_mitarbeiter_stoppt_sprechenden_gast_sofort_und_nichts_geht_verloren(conv):
    """Vorrang des Mitarbeiters: der Gast wird sofort abgeschnitten, bereits Gesagtes wird trotzdem uebersetzt (nur Text, kein Vorlesen)."""
    rid = new_conv_room(conv)
    op = open_operator(conv, rid)
    uk = open_listener(conv, link(conv, rid, "uk"))
    recv(uk)
    uk.send_json({"type": "talk", "on": True})
    recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"].startswith("gast:"))
    for _ in range(3):
        uk.send_bytes(chunk(100))                                   # Gast spricht ...
    op.send_json({"type": "takeover"})                              # ... und der Mitarbeiter stoppt ihn
    t, _ = recv_until(uk, lambda m: m["type"] == "turn" and m["who"] == "staff")
    assert t["state"] == "spricht" and t["reason"] == "unterbrochen"       # der Gast erfaehrt, dass er abgeschnitten wurde
    t2, _ = recv_until(op, lambda m: m["type"] == "turn" and m["who"] == "staff")
    assert t2["state"] == "spricht"
    for _ in range(3):
        uk.send_bytes(chunk(100))                                   # weitere Blocks des Gastes werden nicht mehr angenommen
    m, _ = recv_until(op, lambda m: m["type"] == "guest_message")
    assert m["text"].startswith("[de] Dies ist Testsatz")           # Gesagtes vor dem Stopp wurde uebersetzt
    assert m["audio"] is None                                       # der Mitarbeiter spricht: kein Vorlesen, nur Text


def test_gast_kann_weder_stoppen_noch_freigeben(conv):
    rid = new_conv_room(conv)
    op = open_operator(conv, rid)
    uk = open_listener(conv, link(conv, rid, "uk"))
    recv(uk)
    op.send_json({"type": "talk", "on": True})
    recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == "staff")
    uk.send_json({"type": "takeover"})                              # Gast versucht, den Mitarbeiter zu stoppen
    uk.send_json({"type": "release"})                               # ... oder die Sperre aufzuheben
    uk.send_json({"type": "talk", "on": True})                      # ... oder einfach zu sprechen
    recv_until(uk, lambda m: m["type"] == "busy")
    op.send_json({"type": "ping", "t": 5})
    recv_until(op, lambda m: m["type"] == "pong")
    for _ in range(2):
        op.send_bytes(chunk(100))
    op.send_json({"type": "talk", "on": False})
    seen = []
    for _ in range(40):
        m = recv(uk)
        seen.append(m)
        if m["type"] == "translation":
            uk.send_json({"type": "played", "seq": m["seq"]})
        if m["type"] == "turn" and m["state"] == "frei":
            break
    whos = {m["who"] for m in seen if m["type"] == "turn" and m["state"] == "spricht"}
    assert whos <= {"staff"}                                        # nie hat der Gast das Wort bekommen
    assert not any(m["type"] == "turn" and m.get("reason") == "unterbrochen" for m in seen)

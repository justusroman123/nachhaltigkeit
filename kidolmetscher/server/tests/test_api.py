import time

import pytest
from starlette.websockets import WebSocketDisconnect

from conftest import KEY, app_client, chunk, hdr, make_settings


def new_room(client):
    r = client.post("/api/rooms", headers=hdr())
    assert r.status_code == 200
    return r.json()["room_id"]


def new_link(client, room_id, lang="uk", **body):
    r = client.post(f"/api/rooms/{room_id}/listener-links", headers=hdr(), json={"lang": lang, **body})
    assert r.status_code == 200, r.text
    return r.json()


def token_of(link):
    return link["path"].split("#t=")[1]


def open_operator(client, room_id):
    ws = client.stack.enter_context(client.websocket_connect("/ws/operator"))
    ws.send_json({"type": "hello", "room_id": room_id, "operator_key": KEY})
    assert ws.receive_json()["type"] == "ready"
    return ws


def open_listener(client, token):
    ws = client.stack.enter_context(client.websocket_connect("/ws/listener"))
    ws.send_json({"type": "hello", "token": token})
    return ws


# ---------- REST ----------
def test_operator_schluessel_pflicht(client):
    assert client.post("/api/rooms").status_code == 401
    assert client.post("/api/rooms", headers={"X-Operator-Key": "falsch"}).status_code == 401
    rid = new_room(client)
    for method, url in (("get", f"/api/rooms/{rid}/stats"), ("delete", f"/api/rooms/{rid}")):
        assert getattr(client, method)(url).status_code == 401
    assert client.post(f"/api/rooms/{rid}/listener-links", json={"lang": "uk"}).status_code == 401


def test_link_enthaelt_token_im_fragment(client):
    rid = new_room(client)
    link = new_link(client, rid, "ar", ttl_s=120)
    assert link["path"].startswith("/listener.html#t=") and len(token_of(link)) >= 32
    assert 118 <= link["expires_in_s"] <= 120


def test_link_fehler(client):
    rid = new_room(client)
    assert client.post(f"/api/rooms/{rid}/listener-links", headers=hdr(), json={"lang": "xx"}).status_code == 400
    assert client.post(f"/api/rooms/{rid}/listener-links", headers=hdr(), json={"lang": "uk", "ttl_s": 10**9}).status_code == 400
    assert client.post("/api/rooms/nix/listener-links", headers=hdr(), json={"lang": "uk"}).status_code == 404


def test_sicherheitsheader_auf_allen_antworten(client):
    for url in ("/healthz", "/operator.html", "/listener.html", "/mic-test.html", "/js/listener.js", "/css/common.css"):
        r = client.get(url)
        assert r.status_code == 200, url
        csp = r.headers["content-security-policy"]
        assert "default-src 'none'" in csp and "unsafe-inline" not in csp and "unsafe-eval" not in csp
        assert "http" not in csp.replace("'self'", "")          # keine externen Quellen erlaubt
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["referrer-policy"] == "no-referrer"
        assert r.headers["cache-control"] == "no-store"
        assert "set-cookie" not in r.headers


def test_csp_hash_nur_fuer_mic_test(client):
    assert "sha256-" in client.get("/mic-test.html").headers["content-security-policy"]
    assert "sha256-" not in client.get("/operator.html").headers["content-security-policy"]


def test_stats_enthaelt_nur_zaehler(client):
    rid = new_room(client)
    s = client.get(f"/api/rooms/{rid}/stats", headers=hdr()).json()
    assert set(s) == {"room_open", "operator_active", "listeners", "counters"}


# ---------- WebSocket Ende-zu-Ende ----------
def test_audio_wird_an_zuhoerer_der_sprache_geliefert(client):
    rid = new_room(client)
    uk = open_listener(client, token_of(new_link(client, rid, "uk")))
    en = open_listener(client, token_of(new_link(client, rid, "en")))
    assert uk.receive_json()["lang"] == "uk" and en.receive_json()["lang"] == "en"
    op = open_operator(client, rid)
    op.send_bytes(chunk(100)); op.send_bytes(chunk(100))
    m_uk, m_en = uk.receive_json(), en.receive_json()
    assert m_uk["lang"] == "uk" and m_uk["text"].startswith("[uk] ")
    assert m_en["text"].startswith("[en] ")
    for m in (m_uk, m_en):
        assert "text_src" not in m
        t = m["t"]
        assert list(t) == ["t_audio_in", "t_asr", "t_mt", "t_tts", "t_out"]
        assert t["t_audio_in"] <= t["t_asr"] <= t["t_mt"] <= t["t_tts"] <= t["t_out"]
        assert m["audio"]["format"] == "wav" and m["audio"]["data_b64"]
    # Bedienplatz sieht auch den Quelltext
    got = {op.receive_json()["lang"] for _ in range(2)}
    assert got == {"uk", "en"}


def test_operator_nachricht_hat_quelltext(client):
    rid = new_room(client)
    l = open_listener(client, token_of(new_link(client, rid, "tr")))
    l.receive_json()
    op = open_operator(client, rid)
    op.send_bytes(chunk(100)); op.send_bytes(chunk(100))
    m = op.receive_json()
    assert m["text_src"].startswith("Dies ist Testsatz") and m["lang"] == "tr"


def test_ungueltiger_token_wird_abgewiesen(client):
    ws = open_listener(client, "falsch")
    assert ws.receive_json() == {"type": "error", "v": 1, "code": "token_invalid"}
    with pytest.raises(WebSocketDisconnect) as e:
        ws.receive_json()
    assert e.value.code == 4401


def test_abgelaufener_token_wird_abgewiesen(settings):
    from conftest import FakeClock
    clk = FakeClock()
    with app_client(settings, clk) as c:
        rid = new_room(c)
        tok = token_of(new_link(c, rid, "uk", ttl_s=60))
        clk.advance(61)
        ws = open_listener(c, tok)
        assert ws.receive_json()["code"] == "token_invalid"


def test_verbundener_zuhoerer_wird_bei_ablauf_getrennt():
    s = make_settings(min_listener_ttl_s=1)
    with app_client(s) as c:
        rid = new_room(c)
        ws = open_listener(c, token_of(new_link(c, rid, "uk", ttl_s=1)))
        assert ws.receive_json()["type"] == "ready"
        t0 = time.time()
        assert ws.receive_json()["type"] == "token_expired"
        assert time.time() - t0 < 3
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
        assert e.value.code == 4408


def test_sitzungsende_benachrichtigt_und_loescht(client):
    rid = new_room(client)
    tok = token_of(new_link(client, rid, "uk"))
    ws = open_listener(client, tok)
    ws.receive_json()
    assert client.delete(f"/api/rooms/{rid}", headers=hdr()).status_code == 200
    assert ws.receive_json()["type"] == "session_end"
    with pytest.raises(WebSocketDisconnect):
        ws.receive_json()
    # Raum und Token sind weg
    assert client.get(f"/api/rooms/{rid}/stats", headers=hdr()).status_code == 404
    again = open_listener(client, tok)
    assert again.receive_json()["code"] == "token_invalid"
    assert client.delete(f"/api/rooms/{rid}", headers=hdr()).status_code == 404


def test_spaeter_beitretender_sieht_letzte_untertitel_ohne_audio(client):
    rid = new_room(client)
    l1 = open_listener(client, token_of(new_link(client, rid, "uk")))
    l1.receive_json()
    op = open_operator(client, rid)
    op.send_bytes(chunk(100)); op.send_bytes(chunk(100))
    l1.receive_json()
    l2 = open_listener(client, token_of(new_link(client, rid, "uk")))
    assert l2.receive_json()["type"] == "ready"
    old = l2.receive_json()
    assert old["replay"] is True and old["audio"] is None and old["text"].startswith("[uk]")


def test_operator_falscher_schluessel_und_unbekannter_raum(client):
    rid = new_room(client)
    for hello, code in (({"type": "hello", "room_id": rid, "operator_key": "falsch"}, 4401),
                        ({"type": "hello", "room_id": "nix", "operator_key": KEY}, 4404)):
        with client.websocket_connect("/ws/operator") as ws:
            ws.send_json(hello)
            with pytest.raises(WebSocketDisconnect) as e:
                ws.receive_json()
            assert e.value.code == code


def test_nur_ein_bedienplatz_pro_raum(client):
    rid = new_room(client)
    op = open_operator(client, rid)
    with client.websocket_connect("/ws/operator") as ws2:
        ws2.send_json({"type": "hello", "room_id": rid, "operator_key": KEY})
        with pytest.raises(WebSocketDisconnect) as e:
            ws2.receive_json()
        assert e.value.code == 4409


def test_fremder_origin_wird_abgewiesen(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/listener", headers={"origin": "https://boese.example"}) as ws:
            ws.send_json({"type": "hello", "token": "x"})
            ws.receive_json()
    # gleicher Origin ist erlaubt
    with client.websocket_connect("/ws/listener", headers={"origin": "http://testserver"}) as ws:
        ws.send_json({"type": "hello", "token": "x"})
        assert ws.receive_json()["code"] == "token_invalid"


def test_kaputte_frames_werden_gezaehlt_nicht_verarbeitet(client):
    rid = new_room(client)
    op = open_operator(client, rid)
    op.send_bytes(b"\x01")                 # ungerade Laenge
    op.send_text("kein json")
    op.send_bytes(chunk(100))
    time.sleep(0.2)
    s = client.get(f"/api/rooms/{rid}/stats", headers=hdr()).json()
    assert s["counters"]["bad_frames"] == 2 and s["counters"]["audio_chunks"] == 1


def test_hello_ungueltig(client):
    with client.websocket_connect("/ws/listener") as ws:
        ws.send_text("{kein json")
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
        assert e.value.code == 4400


def test_root_leitet_zum_bedienplatz_weiter(client):
    r = client.get("/", follow_redirects=False)
    assert r.status_code in (302, 307) and r.headers["location"] == "/operator.html"


def test_swagger_und_openapi_aus(client):
    assert client.get("/docs").status_code == 404 and client.get("/openapi.json").status_code == 404

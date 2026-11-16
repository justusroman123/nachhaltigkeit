"""Schutz gegen Raten des Bedienschluessels: Sperre je Absender, kein IP-Klartext, richtige Schluessel nicht betroffen."""
import pytest
from starlette.websockets import WebSocketDisconnect

from app.security import FailureLimiter, client_of
from conftest import FakeClock, KEY, app_client, hdr, make_settings


def test_limiter_sperrt_nach_fehlversuchen_und_gibt_nach_ablauf_frei():
    u = FakeClock()
    lim = FailureLimiter(3, 600, 900, u)
    assert not lim.failure("1.2.3.4") and not lim.failure("1.2.3.4")
    assert lim.blocked_for("1.2.3.4") == 0
    assert lim.failure("1.2.3.4")                                   # dritter Fehlversuch: gesperrt
    assert 890 <= lim.blocked_for("1.2.3.4") <= 901
    assert lim.blocked_for("5.6.7.8") == 0                          # andere Absender nicht betroffen
    u.advance(901)
    assert lim.blocked_for("1.2.3.4") == 0                          # Sperre laeuft ab, Zaehler neu


def test_limiter_fehlversuche_verfallen_und_erfolg_setzt_zurueck():
    u = FakeClock()
    lim = FailureLimiter(3, 100, 900, u)
    lim.failure("a"); lim.failure("a"); u.advance(101)
    assert not lim.failure("a")                                     # alte Fehlversuche zaehlen nicht mehr
    lim.success("a")
    assert not lim.failure("a") and not lim.failure("a")            # Zaehler nach Erfolg neu begonnen
    assert lim.failure("a")


def test_limiter_speichert_keine_klartext_adressen():
    lim = FailureLimiter(2, 600, 900, FakeClock())
    lim.failure("203.0.113.7"); lim.failure("203.0.113.7")
    gespeichert = " ".join(list(lim._fails) + list(lim._blocked))
    assert "203.0.113.7" not in gespeichert and "203.0.113" not in gespeichert      # nur HMAC-Hashes, keine Adressen


def test_client_of_vertraut_forwarded_for_nur_vom_eigenen_rechner():
    class Conn:
        def __init__(self, host, xff=None):
            self.client = type("C", (), {"host": host})()
            self.headers = {"x-forwarded-for": xff} if xff else {}
    assert client_of(Conn("127.0.0.1", "198.51.100.9, 10.0.0.1")) == "198.51.100.9"     # Caddy auf diesem Rechner
    assert client_of(Conn("203.0.113.5", "198.51.100.9")) == "203.0.113.5"               # gefaelschter Header von aussen: ignoriert
    assert client_of(Conn("127.0.0.1")) == "127.0.0.1"


def test_http_nach_zu_vielen_falschen_schluesseln_429_auch_mit_richtigem_schluessel():
    u = FakeClock()
    with app_client(make_settings(auth_max_fails=3, auth_window_s=600, auth_block_s=60), clock=u) as c:
        falsch = {"X-Operator-Key": "falsch-" + KEY}
        assert [c.post("/api/rooms", headers=falsch).status_code for _ in range(3)] == [401, 401, 401]
        r = c.post("/api/rooms", headers=hdr())                     # jetzt gesperrt: auch der richtige Schluessel hilft nicht
        assert r.status_code == 429 and int(r.headers["Retry-After"]) > 0
        u.advance(61)
        assert c.post("/api/rooms", headers=hdr()).status_code == 200     # nach der Sperrzeit wieder frei


def test_richtiger_schluessel_wird_nie_gesperrt():
    with app_client(make_settings(auth_max_fails=3), clock=FakeClock()) as c:
        for _ in range(30):
            assert c.post("/api/rooms", headers=hdr()).status_code == 200


def test_websocket_operator_gesperrt_nach_falschen_schluesseln():
    u = FakeClock()
    with app_client(make_settings(auth_max_fails=2, auth_block_s=60), clock=u) as c:
        rid = c.post("/api/rooms", headers=hdr()).json()["room_id"]
        codes = []
        for _ in range(3):
            with pytest.raises(WebSocketDisconnect) as e:
                with c.websocket_connect("/ws/operator") as ws:
                    ws.send_json({"type": "hello", "room_id": rid, "operator_key": "falsch-" + KEY})
                    ws.receive_json()
            codes.append(e.value.code)
        assert codes == [4401, 4401, 4430]                          # beim dritten Versuch: gesperrt


def test_oeffentliche_konfiguration_bleibt_trotz_sperre_erreichbar():
    """Die Sperre betrifft nur Endpunkte, die den Bedienschluessel brauchen; die oeffentliche Konfiguration bleibt erreichbar."""
    with app_client(make_settings(auth_max_fails=2), clock=FakeClock()) as c:
        c.post("/api/rooms", headers={"X-Operator-Key": "x" * 20})
        c.post("/api/rooms", headers={"X-Operator-Key": "x" * 20})
        assert c.get("/api/config").status_code == 200              # oeffentliche Konfiguration bleibt erreichbar

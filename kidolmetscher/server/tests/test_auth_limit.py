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


def test_limiter_fehlversuche_verfallen_ein_erfolg_loescht_sie_nicht():
    u = FakeClock()
    lim = FailureLimiter(3, 100, 900, u)
    lim.failure("a"); lim.failure("a"); u.advance(101)
    assert not lim.failure("a")                                     # alte Fehlversuche zaehlen nicht mehr
    lim.success("a")                                                # richtiger Schluessel (z. B. Abfrage des Bedienplatzes) ...
    assert not lim.failure("a")                                     # ... setzt den Zaehler NICHT zurueck: 2 Fehlversuche stehen noch
    assert lim.failure("a")                                         # der dritte sperrt (Angreifer hinter gleicher Kennung kann nicht beliebig raten)


def test_limiter_begrenzt_die_Zahl_verfolgter_absender():
    lim = FailureLimiter(3, 600, 900, FakeClock())
    lim.MAX_TRACKED = 50
    for i in range(500):
        lim.failure(f"10.0.{i // 250}.{i % 250}")
    assert len(lim._fails) <= 50                                    # Arbeitsspeicher waechst nicht ohne Grenze


def test_ipv6_absender_werden_auf_das_praefix_gekuerzt():
    from app.security import normalize_client
    assert normalize_client("2001:db8:1:2:aaaa:bbbb:cccc:dddd") == normalize_client("2001:db8:1:2:1111:2222:3333:4444")
    assert normalize_client("2001:db8:1:3::1") != normalize_client("2001:db8:1:2::1")
    assert normalize_client("::ffff:192.0.2.7") == "192.0.2.7"
    assert normalize_client("203.0.113.7") == "203.0.113.7"


def test_limiter_speichert_keine_klartext_adressen():
    lim = FailureLimiter(2, 600, 900, FakeClock())
    lim.failure("203.0.113.7"); lim.failure("203.0.113.7")
    gespeichert = " ".join(list(lim._fails) + list(lim._blocked))
    assert "203.0.113.7" not in gespeichert and "203.0.113" not in gespeichert      # nur HMAC-Hashes, keine Adressen


def test_client_of_vertraut_forwarded_for_nur_vom_vertrauten_proxy_und_liest_von_rechts():
    class Conn:
        def __init__(self, host, xff=None):
            self.client = type("C", (), {"host": host})()
            self.headers = {"x-forwarded-for": xff} if xff else {}
    assert client_of(Conn("127.0.0.1", "198.51.100.9")) == "198.51.100.9"                   # Caddy auf diesem Rechner setzt die echte Adresse
    assert client_of(Conn("127.0.0.1", "6.6.6.6, 198.51.100.9")) == "198.51.100.9"          # links selbst Angehaengtes zaehlt nicht
    assert client_of(Conn("203.0.113.5", "198.51.100.9")) == "203.0.113.5"                   # gefaelschter Header von aussen: ignoriert
    assert client_of(Conn("127.0.0.1")) == "127.0.0.1"
    # zweiter vertrauter Proxy (z. B. Docker-Netz): dessen Adresse wird uebersprungen
    assert client_of(Conn("172.18.0.5", "198.51.100.9, 172.18.0.2"), ["172.18.0.0/16"]) == "198.51.100.9"
    assert client_of(Conn("172.18.0.5", "198.51.100.9"), ["127.0.0.1"]) == "172.18.0.5"      # Docker-Proxy nicht als vertraut eingetragen: nur dessen Adresse


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

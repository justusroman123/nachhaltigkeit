"""Zugang der Zuhoerer: niemand soll heimlich mithoeren koennen (Nutzerwunsch 17.11.2026, Hürde S10).
 - Jeder Beitritt und jeder Weggang wird dem Bedienplatz sofort gemeldet (Zaehler, keine Kennung, keine Inhalte).
 - "Tuer zu": alle Links des Raums werden ungueltig, alle verbundenen Zuhoerer werden getrennt.
 - Gaeste erfahren keine Kennungen anderer Gaeste.
Alle Tests nutzen nur Attrappen, keine Inhalte, keine Netzverbindung."""
import json

import pytest
from starlette.websockets import WebSocketDisconnect

from app.rooms import Room
from conftest import hdr, make_settings
from test_api import new_link, new_room, open_listener, open_operator, token_of
from test_gespraech import link, recv, recv_until
from test_gespraech_luecken import beitreten, client_with, raum, stats, wait_until


def liste(op, **bed):
    """Naechste 'listeners'-Meldung am Bedienplatz, die auf alle Bedingungen passt."""
    return recv_until(op, lambda m: m["type"] == "listeners" and all(m.get(k) == v for k, v in bed.items()))[0]


# ------------------------------------------------------------------ Beitritt und Weggang sind sofort sichtbar
@pytest.mark.parametrize("modus", ["vortrag", "gespraech"])
def test_beitritt_und_weggang_werden_dem_bedienplatz_sofort_gemeldet_ohne_kennung(modus):
    """Faengt: Beitritte, die der Bedienplatz nicht bemerkt (heimliches Mithoeren)."""
    with client_with(make_settings(max_guests=3)) as c:
        if modus == "gespraech":
            rid, op = raum(c)
        else:
            rid = new_room(c)
            op = open_operator(c, rid)
        tok = token_of(new_link(c, rid, "uk"))
        a = open_listener(c, tok)
        assert recv(a)["type"] == "ready"
        m = liste(op, change="join")
        assert m["count"] == 1 and m["lang"] == "uk"
        assert not any(k in m for k in ("device", "id", "ip", "token")), m          # keine Kennung, keine Adresse
        b = open_listener(c, tok)
        assert recv(b)["type"] == "ready"
        assert liste(op, change="join", count=2)["by_lang"] == {"uk": 2}
        a.close()
        assert liste(op, change="leave", count=1)["lang"] == "uk"
        b.close()
        liste(op, change="leave", count=0)


def test_beitritt_vor_dem_bedienplatz_geht_nicht_verloren():
    """Faengt: Beitritt, waehrend kein Bedienplatz verbunden ist: die Meldung wartet und kommt beim Verbinden an (und der Zaehler stimmt)."""
    with client_with(make_settings()) as c:
        rid = new_room(c)
        g = open_listener(c, token_of(new_link(c, rid, "en")))
        assert recv(g)["type"] == "ready"
        wait_until(lambda: stats(c, rid)["listeners_connected"] == 1, what="Zuhoerer verbunden")
        op = open_operator(c, rid)
        m = liste(op, change="join")
        assert m["count"] == 1 and m["lang"] == "en"


# ------------------------------------------------------------------ Tuer zu
def test_tuer_zu_trennt_alle_geraete_und_macht_den_link_ungueltig():
    """Faengt: Link, der nach 'Tuer zu' noch taugt; Geraete, die verbunden bleiben; fehlende Meldung an den Gast."""
    with client_with(make_settings(max_guests=3)) as c:
        rid, op = raum(c, ("uk", "en"))
        tok = token_of(new_link(c, rid, "uk"))
        a = open_listener(c, tok); assert recv(a)["type"] == "ready"
        b = open_listener(c, tok); assert recv(b)["type"] == "ready"
        wait_until(lambda: stats(c, rid)["listeners_connected"] == 2, what="beide verbunden")
        r = c.post(f"/api/rooms/{rid}/disconnect-all", headers=hdr())
        assert r.status_code == 200 and r.json() == {"disconnected": 2, "links_revoked": 1}
        for g in (a, b):
            assert recv_until(g, lambda m: m["type"] == "removed")[0]["type"] == "removed"
            with pytest.raises(WebSocketDisconnect) as e:
                for _ in range(20):
                    g.receive_json()
            assert e.value.code == 4403                                   # "entfernt", der Browser verbindet sich nicht neu
        wait_until(lambda: stats(c, rid)["listeners_connected"] == 0, what="beide getrennt")
        spaet = open_listener(c, tok)                                     # derselbe Link taugt nicht mehr
        assert spaet.receive_json()["code"] == "token_invalid"
        neu = open_listener(c, token_of(new_link(c, rid, "uk")))          # ein frisch erzeugter Link geht
        assert recv(neu)["type"] == "ready"
        st = stats(c, rid)
        assert st["room_open"] and st["operator_active"] and st["counters"]["listeners_removed"] == 2


def test_tuer_zu_braucht_den_bedienschluessel_und_einen_bekannten_raum():
    with client_with(make_settings()) as c:
        rid = new_room(c)
        assert c.post(f"/api/rooms/{rid}/disconnect-all").status_code == 401
        assert c.post(f"/api/rooms/{rid}/disconnect-all", headers={"X-Operator-Key": "falsch"}).status_code == 401
        assert c.post("/api/rooms/gibt-es-nicht/disconnect-all", headers=hdr()).status_code == 404
        assert c.post(f"/api/rooms/{rid}/disconnect-all", headers=hdr()).json() == {"disconnected": 0, "links_revoked": 0}   # ohne Gaeste harmlos


def test_ein_getrennter_gast_haelt_die_sperre_nicht_fest():
    """Faengt: Gast spricht, wird getrennt, die Sperre bleibt haengen (der Mitarbeiter haette niemanden mehr zum Stoppen)."""
    with client_with(make_settings(max_guests=2)) as c:
        rid, op = raum(c)
        a, da = beitreten(c, rid, "uk")
        a.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == da)
        assert c.post(f"/api/rooms/{rid}/disconnect-all", headers=hdr()).status_code == 200
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] in ("uebersetzt", "wiedergabe", "frei"))
        wait_until(lambda: stats(c, rid)["turn"]["state"] == "frei", timeout=8, what="Sperre wieder frei")


# ------------------------------------------------------------------ Gaeste sehen keine Kennungen anderer Gaeste
def test_gaeste_sehen_nur_staff_sich_selbst_oder_gast():
    """Faengt: Kennungen anderer Gaeste im Zustand der Sperre (turn.who, turn.waiting) und im ready des spaeteren Beitritts."""
    with client_with(make_settings(max_guests=3)) as c:
        rid, op = raum(c, ("uk", "en"))
        a, da = beitreten(c, rid, "uk")
        b, db = beitreten(c, rid, "en")
        a.send_json({"type": "talk", "on": True})
        m_op = recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == da)[0]
        assert m_op["who"] == da                                           # der Bedienplatz sieht die Kennung
        assert recv_until(a, lambda m: m["type"] == "turn" and m["state"] == "spricht")[0]["who"] == da          # A erkennt sich selbst
        assert recv_until(b, lambda m: m["type"] == "turn" and m["state"] == "spricht")[0]["who"] == "gast"      # B erfaehrt keine Kennung von A
        b.send_json({"type": "want", "on": True})
        wa = recv_until(a, lambda m: m["type"] == "turn" and m.get("waiting"))[0]["waiting"]
        wb = recv_until(b, lambda m: m["type"] == "turn" and m.get("waiting"))[0]["waiting"]
        wo = recv_until(op, lambda m: m["type"] == "turn" and m.get("waiting"))[0]["waiting"]
        assert wa == ["gast"] and wb == [db] and wo == [db]
        spaet = open_listener(c, link(c, rid, "uk"))                       # spaeter Beitritt: das ready zeigt ebenfalls keine fremden Kennungen
        ready = recv(spaet)
        assert ready["type"] == "ready" and ready["turn"]["who"] == "gast" and ready["turn"]["waiting"] == ["gast"]
        assert da not in json.dumps(ready) and db not in json.dumps(ready)


def test_turn_ansicht_ersetzt_fremde_kennungen_vollstaendig():
    snap = {"state": "spricht", "who": "gast:aaaa", "reason": "", "waiting": ["staff", "gast:bbbb", "gast:cccc"], "utterance": 3}
    sicht = Room._anon_turn(snap, "gast:bbbb")
    assert sicht["who"] == "gast" and sicht["waiting"] == ["staff", "gast:bbbb", "gast"]
    assert sicht["state"] == "spricht" and sicht["utterance"] == 3
    assert Room._anon_turn(snap, "gast:aaaa")["who"] == "gast:aaaa"
    assert Room._anon_turn({"state": "frei", "who": None, "waiting": []}, "gast:x") == {"state": "frei", "who": None, "waiting": []}
    assert "gast:aaaa" not in str(Room._anon_turn(snap, "gast:zzzz")) and "gast:bbbb" not in str(Room._anon_turn(snap, "gast:zzzz"))

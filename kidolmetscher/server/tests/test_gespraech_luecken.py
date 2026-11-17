"""Tests zum Gespraechsmodus, die in der Mutationspruefung (Gutachten) unbemerkte Aenderungen faengt
und bisherige Luecken schliesst. Alle Tests nutzen nur Attrappen, keine Inhalte, keine Netzverbindung."""
import array
import asyncio
import contextlib
import hashlib
import logging
import re
import time

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.pipeline import build_pipeline
from app.pipeline.tts_mock import MockTts
from app.rooms import RoomManager
from app.security import FailureLimiter
from app.turns import FREI, SPRICHT, UEBERSETZT, WIEDERGABE, TurnLimits, TurnManager
from conftest import FakeClock, KEY, _WsStack, chunk, hdr, make_settings
from test_api import open_listener, open_operator, token_of
from test_gespraech import link, new_conv_room, recv, recv_until
from test_turns import neu


# ------------------------------------------------------------------ Hilfen
@contextlib.contextmanager
def client_with(settings, pipeline=None, clock=None, **tc):
    kw = {}
    if clock is not None:
        kw["clock"] = clock
    if pipeline is not None:
        kw["pipeline"] = pipeline
    with TestClient(create_app(settings, **kw), **tc) as c:
        c.stack = _WsStack()
        try:
            yield c
        finally:
            c.stack.close()


def stats(c, rid):
    return c.get(f"/api/rooms/{rid}/stats", headers=hdr()).json()


def wait_until(pred, timeout=5.0, what="Bedingung"):
    t0 = time.time()
    while time.time() - t0 < timeout:
        v = pred()
        if v:
            return v
        time.sleep(0.03)
    raise AssertionError(f"nicht eingetreten: {what}")


def laut(ms=100, rate=16000):
    """Hoerbare Sprache (Rechteck, RMS 4000) - die Test-Hilfe chunk() liefert nur Stille."""
    return array.array("h", [4000, -4000] * (rate * ms // 2000)).tobytes()


def raum(c, langs=("uk",)):
    rid = new_conv_room(c, langs)
    return rid, open_operator(c, rid)


def beitreten(c, rid, lang):
    ws = open_listener(c, link(c, rid, lang))
    ready = recv(ws)
    assert ready["type"] == "ready"
    return ws, ready["device"]


def sync_op(op):
    op.send_json({"type": "ping", "t": 1})
    recv_until(op, lambda m: m["type"] == "pong")


def pipeline_mit(settings, **stufen):
    p = build_pipeline(settings)
    for k, v in stufen.items():
        setattr(p, k, v)
    return p


class KaputtMt:
    """Uebersetzung ins Deutsche (Gast -> Mitarbeiter) schlaegt fehl."""
    async def load(self): ...
    async def translate(self, text, src, tgt):
        if tgt == "de":
            raise RuntimeError("Modell kaputt")
        return f"[{tgt}] {text}"


class LangsamerErsterMt:
    """Der erste Satz braucht laenger als der zweite (kommt realistisch bei langem/kurzem Satz vor)."""
    async def load(self): ...
    async def translate(self, text, src, tgt):
        if "Nummer 1 " in text:
            await asyncio.sleep(0.7)
        return f"[{tgt}] {text}"


class AufzeichnendeTts:
    def __init__(self):
        self.sprachen = []
    async def load(self): ...
    async def synthesize(self, text, lang):
        self.sprachen.append(lang)
        return await MockTts().synthesize(text, lang)


# ================================================================== B6 (Einheit): Sperre
def test_B6_zweites_geraet_ohne_fertig_haelt_die_sperre_auch_nach_der_schonfrist():
    """Faengt: expect_playback merkt nichts vor (T20). Der bestehende Test prueft 'WIEDERGABE' ohne je Zeit verstreichen zu lassen."""
    u, ev, t = neu(grace_s=0.5)
    t.claim("staff"); t.segment_started(); t.end_speaking("staff")
    t.expect_playback(1, "gast:1"); t.expect_playback(1, "gast:2")
    t.segment_done()
    assert t.state == WIEDERGABE
    t.playback_done(1, "gast:1")
    u.t += 5; t.tick()                                               # weit ueber der Schonfrist, Geraet 2 schweigt
    assert t.state == WIEDERGABE and t.claim("gast:2") == (False, "busy")
    t.playback_done(1, "gast:2"); u.t += 0.6; t.tick()
    assert t.state == FREI


def test_B6_getrenntes_geraet_gibt_die_sperre_frei_nicht_erst_die_zeitgrenze():
    """Faengt: device_left loescht awaiting nicht (T12). Der bestehende Test merkt das Geraet erst NACH Beginn der Schonfrist vor."""
    u, ev, t = neu(grace_s=0.5, play_max_s=15)
    t.claim("staff"); t.segment_started(); t.end_speaking("staff")
    t.expect_playback(1, "gast:1")                                    # vor dem Wechsel in die Wiedergabe
    t.segment_done()
    assert t.state == WIEDERGABE and (1, "gast:1") in t.awaiting
    u.t += 2; t.tick(); assert t.state == WIEDERGABE                  # wartet wirklich
    t.device_left("gast:1"); u.t += 0.6; t.tick()
    assert t.state == FREI and ev[-1]["reason"] == ""                 # frei durch Schonfrist, nicht durch Zeitgrenze


def test_B6_haengendes_geraet_wird_nach_der_wiedergabe_zeitgrenze_uebergangen():
    """Faengt: Zweig 'zeitgrenze_wiedergabe' in tick() entfernt (T06). Der bestehende Test besteht ueber die Schonfrist, nicht ueber die Zeitgrenze."""
    u, ev, t = neu(play_max_s=15, grace_s=0.5)
    t.claim("staff"); t.segment_started(); t.end_speaking("staff")
    t.expect_playback(1, "gast:9", 2.0)                               # Geraet meldet nie "fertig"
    t.segment_done()
    assert t.state == WIEDERGABE
    u.t += 14; t.tick(); assert t.state == WIEDERGABE
    u.t += 1.5; t.tick()
    assert t.state == FREI and ev[-1]["reason"] == "zeitgrenze_wiedergabe"


def test_B6_verspaetete_fertigmeldung_nach_freigeben_darf_die_naechste_aussage_nicht_verkuerzen():
    """DEFEKT (belegt): segment_done() hat keine Zuordnung zur Aussage. Nach 'Freigeben' (oder Zeitgrenze) meldet die haengende
    Uebersetzung der ALTEN Aussage spaeter 'fertig' und zaehlt den Abschnitt der NEUEN Aussage herunter: die Sperre fiele zu frueh."""
    u, ev, t = neu(grace_s=0.5)
    t.claim("staff"); alt = t.segment_started()                       # Aussage 1: Abschnitt haengt in der Uebersetzung
    t.release()                                                       # Notbremse des Mitarbeiters
    assert t.claim("gast:1")[0]; t.segment_started()                  # Aussage 2: eigener Abschnitt noch in Arbeit
    t.segment_done(alt)                                               # alter Abschnitt meldet endlich "fertig" (Marke der alten Runde)
    t.end_speaking("gast:1")
    assert t.state == UEBERSETZT, "Abschnitt von Aussage 2 ist noch nicht uebersetzt, die Sperre darf noch nicht weitergehen"
    u.t += 1; t.tick()
    assert t.state == UEBERSETZT


# ================================================================== B4 (Einheit): Wortmeldung
def test_B4_erste_wortmeldung_bekommt_das_wort_zuerst():
    """Faengt: LIFO statt FIFO (T08). Bestehende Tests pruefen nur die Listenreihenfolge, nie wer das Wort bekommt (immer nur 1 Wartender)."""
    u, ev, t = neu(grace_s=0.5)
    t.claim("staff")
    for d in ("gast:1", "gast:2", "gast:3"):
        t.request(d)
    order = []
    for _ in range(3):
        t.end_speaking(t.who); u.t += 0.6; t.tick()
        order.append(t.who)
    assert order == ["gast:1", "gast:2", "gast:3"]


def test_B4_bestaetigte_uebergabe_gilt_die_volle_stillefrist_nicht_nur_30_s():
    """Faengt: claim() setzt nach der Bestaetigung die Frist nicht auf idle_s (T09): ein Gast, der nach der Uebergabe 30 s nachdenkt, flog raus."""
    u, ev, t = neu(grace_s=0.5, pickup_s=30, idle_s=120)
    t.claim("staff"); t.request("gast:1"); t.end_speaking("staff"); u.t += 0.6; t.tick()
    assert t.who == "gast:1"
    assert t.claim("gast:1")[0]                                       # Geraet bestaetigt, Mikrofon laeuft
    u.t += 60; t.tick()
    assert t.state == SPRICHT and t.who == "gast:1"
    u.t += 61; t.tick()
    assert t.state != SPRICHT


def test_B4_stopp_nimmt_die_eigene_wortmeldung_des_mitarbeiters_zurueck():
    """Faengt: take_over laesst 'staff' in der Warteschlange (T04): nach der eigenen Aussage bekaeme er das Wort automatisch ein zweites Mal."""
    u, ev, t = neu(grace_s=0.5)
    t.claim("gast:1"); t.request("staff")
    assert t.waiting == ["staff"]
    ok, prev = t.take_over("staff")
    assert ok and prev == "gast:1" and t.waiting == [] and ev[-1]["waiting"] == []
    t.end_speaking("staff"); u.t += 0.6; t.tick()
    assert t.state == FREI


def test_B1_B4_B9_B8_standardwerte_entsprechen_der_vorgabe():
    """Faengt: geaenderte Standardwerte (T16, T17, T18, S10, K01). Die Tests setzen alle Werte selbst, die Vorgabe (Stille-Frist AUS, 30 s, 10/10 min/15 min) steht nirgends."""
    assert TurnLimits().idle_s == 0 and TurnLimits().pickup_s == 30          # Nutzerwunsch 17.11.2026: nichts beendet eine Aussage von selbst
    s = Settings()
    assert s.turn_idle_s == 0
    assert (s.auth_max_fails, s.auth_window_s, s.auth_block_s) == (10, 600, 900)
    assert s.debug_fehler is False
    assert (s.lang_queue_max, s.tts_skip_backlog, s.stage_timeout_s) == (500, 100000, 60)     # B7: "Vollstaendigkeit geht vor" (K03/K04)
    assert Settings().fehler(RuntimeError("GEHEIMER INHALT")) == "RuntimeError"
    room = RoomManager(make_settings()).create_room(mode="gespraech")
    assert room.turns.limits.idle_s == 0


# ================================================================== B1: Stille-Frist und hoerbare Sprache (Ende-zu-Ende)
def test_B1_hoerbare_sprache_des_mitarbeiters_verlaengert_stille_aber_nicht_stille():
    """Faengt: touch() fuer den Mitarbeiter entfernt (M01) oder pcm_rms() kaputt (M03). 5 Minuten am Stueck, alle 60 s hoerbare Sprache."""
    clk = FakeClock(1000.0)
    with client_with(make_settings(turn_idle_s=120)) as c:
        rid, op = raum(c)
        c.app.state.rooms.get(rid).turns.clock = clk                  # Uhr der Sperre austauschbar (kein Warten in Echtzeit)
        op.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == "staff")
        for _ in range(5):
            clk.advance(60)
            op.send_bytes(laut()); sync_op(op); time.sleep(0.45)      # Block verarbeitet, pump hat mindestens einmal getickt
        t = stats(c, rid)["turn"]
        assert t["state"] == "spricht" and t["who"] == "staff"        # 300 s gesprochen, nie 120 s Stille
        clk.advance(121)                                              # jetzt wirklich 121 s Stille
        m, _ = recv_until(op, lambda m: m["type"] == "turn" and m.get("reason") == "inaktiv", limit=300)
        assert m["state"] in ("uebersetzt", "wiedergabe")


def test_B1_hoerbare_sprache_des_gastes_verlaengert_die_frist():
    """Faengt: touch() fuer Gaeste entfernt (M02)."""
    clk = FakeClock(1000.0)
    with client_with(make_settings(turn_idle_s=120)) as c:
        rid, op = raum(c)
        c.app.state.rooms.get(rid).turns.clock = clk
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == dev)
        for i in range(5):
            clk.advance(60)
            uk.send_bytes(laut())
            wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == i + 1, what="Block angekommen")
            time.sleep(0.45)
        t = stats(c, rid)["turn"]
        assert t["state"] == "spricht" and t["who"] == dev


def test_B1_hoerbare_stille_wird_nach_120_s_beendet_auch_wenn_nichts_gesendet_wird():
    """Faengt: Idle-Frist wirkt im Server nicht (T05/M16). Bestehende Tests pruefen die Frist nur an TurnManager, nie im laufenden Server."""
    clk = FakeClock(1000.0)
    with client_with(make_settings(turn_idle_s=120)) as c:
        rid, op = raum(c)
        c.app.state.rooms.get(rid).turns.clock = clk
        op.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht")
        clk.advance(119); time.sleep(0.6)
        assert stats(c, rid)["turn"]["state"] == "spricht"
        clk.advance(2)
        recv_until(op, lambda m: m["type"] == "turn" and m.get("reason") == "inaktiv")


# ================================================================== B6 (Ende-zu-Ende)
def test_B6_sperre_bleibt_bis_ALLE_geraete_fertig_melden_und_faellt_nicht_schon_bei_angezeigt():
    """Faengt: publish merkt Gaeste nicht vor (R01), 'shown' gibt die Sperre frei (R03)."""
    with client_with(make_settings(max_guests=2)) as c:
        rid, op = raum(c, ("uk", "en"))
        uk, d1 = beitreten(c, rid, "uk"); en, d2 = beitreten(c, rid, "en")
        op.send_json({"type": "talk", "on": True})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "spricht")
        for _ in range(3):
            op.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("audio_chunks", 0) == 3, what="Audio angekommen")
        op.send_json({"type": "talk", "on": False})
        seqs = {}
        for name, ws in (("uk", uk), ("en", en)):
            _, seen = recv_until(ws, lambda m: m["type"] == "turn" and m["state"] == "wiedergabe")
            seqs[name] = [m["seq"] for m in seen if m["type"] == "translation"]
            assert seqs[name], "keine Uebersetzung angekommen"
        for s in seqs["uk"]:
            uk.send_json({"type": "shown", "seq": s}); uk.send_json({"type": "played", "seq": s})
        for s in seqs["en"]:
            en.send_json({"type": "shown", "seq": s})                 # angezeigt, aber noch nicht fertig gesprochen
        time.sleep(1.3)                                               # Schonfrist (0,5 s) + pump (0,2 s) mehrfach ueberschritten
        assert stats(c, rid)["turn"]["state"] == "wiedergabe"        # Geraet "en" fehlt noch
        for s in seqs["en"]:
            en.send_json({"type": "played", "seq": s})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "frei")


def test_B6_haengendes_geraet_blockiert_nicht_ewig_im_laufenden_server():
    """Faengt: Zeitgrenze Wiedergabe (T06) bzw. fehlendes tick() im pump (M16), im laufenden Server mit austauschbarer Uhr."""
    clk = FakeClock(1000.0)
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        c.app.state.rooms.get(rid).turns.clock = clk
        uk, dev = beitreten(c, rid, "uk")
        op.send_json({"type": "talk", "on": True})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "spricht")
        for _ in range(3):
            op.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("audio_chunks", 0) == 3, what="Audio angekommen")
        op.send_json({"type": "talk", "on": False})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "wiedergabe")   # das Tablet meldet NIE "fertig"
        clk.advance(16)
        m, _ = recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "frei")
        assert m["reason"] == "zeitgrenze_wiedergabe"


def test_B6_getrenntes_gastgeraet_gibt_die_sperre_sofort_frei_und_die_wortmeldung_zurueck():
    """Faengt: device_left() im Zuhoerer-Handler entfernt (M13): sonst wartet die Sperre die volle Zeitgrenze (>= 15 s) auf ein totes Tablet."""
    with client_with(make_settings(max_guests=2)) as c:
        rid, op = raum(c, ("uk", "en"))
        uk, d1 = beitreten(c, rid, "uk"); en, d2 = beitreten(c, rid, "en")
        op.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == "staff")
        en.send_json({"type": "want", "on": True})
        m, _ = recv_until(op, lambda m: m["type"] == "turn" and m.get("waiting") == [d2])
        en.close()                                                    # Tablet weg
        m, _ = recv_until(op, lambda m: m["type"] == "turn" and m.get("waiting") == [])
        assert m["reason"] == "wortmeldung_zurueck"
        for _ in range(3):
            op.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("audio_chunks", 0) == 3, what="Audio angekommen")
        op.send_json({"type": "talk", "on": False})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "wiedergabe")
        uk.close()                                                    # auch das zweite Tablet bricht ab, ohne "fertig"
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "frei")   # < 6 s, nicht erst nach 15 s


def test_B6_bedienplatz_trennung_gibt_die_sperre_frei():
    """Faengt: turns.release() im finally des Bedienplatz-Handlers entfernt (M14)."""
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        op.send_json({"type": "talk", "on": True})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "spricht")
        op.close()
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "frei")


def test_B6_B5_sperre_wartet_auf_played_des_bedienplatzes_bei_gast_antwort():
    """Faengt: Gast-Antwort merkt den Bedienplatz nicht vor (C02): die Sperre fiele nach 0,5 s, obwohl noch vorgelesen wird."""
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == dev)
        for _ in range(3):
            uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Audio angekommen")
        uk.send_json({"type": "talk", "on": False})
        msgs = []
        _, seen = recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "wiedergabe")
        msgs = [m for m in seen if m["type"] == "guest_message"]
        assert msgs and all(m["audio"] for m in msgs)
        time.sleep(1.3)
        assert stats(c, rid)["turn"]["state"] == "wiedergabe"        # Bedienplatz liest noch vor
        for m in msgs:
            op.send_json({"type": "played", "seq": m["seq"]})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "frei")


# ================================================================== B3: Stopp des Mitarbeiters
def _gast_spricht_und_wird_gestoppt(c, weiteres_audio):
    rid, op = raum(c)
    uk, dev = beitreten(c, rid, "uk")
    uk.send_json({"type": "talk", "on": True})
    recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == dev)
    for _ in range(3):
        uk.send_bytes(chunk(100))                                     # 1 ganzer Abschnitt (0,2 s) + 0,1 s Rest
    wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Gast-Audio angekommen")
    op.send_json({"type": "takeover"})
    recv_until(uk, lambda m: m["type"] == "turn" and m["who"] == "staff")
    if weiteres_audio:
        for _ in range(4):
            uk.send_bytes(chunk(100))                                 # Mikrofon waere noch offen: muss verworfen werden
        uk.send_json({"type": "talk", "on": True})
        recv_until(uk, lambda m: m["type"] == "busy")                 # Rueckmeldung = alle Bloecke davor sind verarbeitet
    return rid, op, uk


def test_B3_nach_stopp_wird_weiteres_gast_audio_verworfen():
    """Faengt: Audiosperre im Zuhoerer-Handler entfernt (M04). Der bestehende Test sendet 3 Bloecke 'die nicht mehr angenommen werden', prueft es aber nie."""
    with client_with(make_settings()) as c:
        rid, op, uk = _gast_spricht_und_wird_gestoppt(c, weiteres_audio=True)
        assert stats(c, rid)["counters"]["guest_audio_chunks"] == 3


def nachrichten(ws, art, n, limit=80):
    """Sammelt n Nachrichten der Art, ohne dazwischen liegende still zu verwerfen (recv_until wirft sie weg)."""
    out = []
    for _ in range(limit):
        m = recv(ws)
        if m["type"] == art:
            out.append(m)
            if len(out) == n:
                return out
    raise AssertionError(f"nur {len(out)} von {n} Nachrichten '{art}'")


def test_B3_nach_stopp_wird_das_bereits_gesagte_vollstaendig_uebersetzt_ohne_vorlesen():
    """Faengt: Abschluss des Rests nach Stopp entfernt (M07/C05). Der bestehende Test ueberliest per recv_until die erste Gast-Nachricht
    (sie liegt vor der 'turn'-Meldung) und prueft nur den Rest-Abschnitt; dass BEIDE Abschnitte ankommen, wird nirgends verlangt."""
    with client_with(make_settings()) as c:
        rid, op, uk = _gast_spricht_und_wird_gestoppt(c, weiteres_audio=False)
        msgs = nachrichten(op, "guest_message", 2)
        assert "Nummer 1 " in msgs[0]["text_src"] and "Nummer 2 " in msgs[1]["text_src"]
        assert msgs[1]["audio"] is None                                # Rest wird erst nach dem Stopp fertig: nur Text, kein Vorlesen


def test_B3_B7_gast_fertig_uebersetzt_auch_den_rest_der_aussage():
    """Faengt: finish() verwirft den Rest (C05). Der bestehende Gast-Test liest nur die erste Nachricht."""
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["who"] == dev)
        for _ in range(3):
            uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Audio angekommen")
        uk.send_json({"type": "talk", "on": False})
        wait_until(lambda: stats(c, rid)["counters"].get("guest_messages", 0) == 2, what="beide Abschnitte uebersetzt")


# ================================================================== B2: nur der Mitarbeiter darf stoppen
def test_B2_gast_kann_weder_einen_sprechenden_gast_stoppen_noch_freigeben_noch_den_mitarbeiter_spielen():
    """Faengt: Gast-Handler fuer takeover/release (M08/M09). Der bestehende Test laesst den MITARBEITER sprechen: take_over('staff') waere dort wirkungslos."""
    with client_with(make_settings(max_guests=2)) as c:
        rid, op = raum(c, ("uk", "en"))
        a, da = beitreten(c, rid, "uk"); b, db = beitreten(c, rid, "en")
        a.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == da)
        b.send_json({"type": "takeover"}); b.send_json({"type": "release"}); b.send_json({"type": "talk", "on": True})
        recv_until(b, lambda m: m["type"] == "busy")                   # alles davor ist verarbeitet
        t = stats(c, rid)["turn"]
        assert t["state"] == "spricht" and t["who"] == da             # A hat das Wort noch, Mitarbeiter hat es nicht uebernommen


def test_B2_im_vortrag_aendert_talk_nichts():
    """Faengt: 'talk' wirkt auch im Vortrag (M25). Der bestehende Test wartet nur auf pong, der Zustand wird nie geprueft."""
    with client_with(make_settings()) as c:
        rid = c.post("/api/rooms", headers=hdr()).json()["room_id"]
        op = open_operator(c, rid)
        op.send_json({"type": "talk", "on": True}); op.send_json({"type": "takeover"})
        sync_op(op)
        assert stats(c, rid)["turn"]["state"] == "frei"


# ================================================================== B4: Wortmeldung ueber WebSocket
def test_B4_wortmeldung_von_gaesten_der_reihe_nach_automatisch_und_zurueckziehen():
    """Faengt: 'want' des Gastes tot (M11). Fuer die Wortmeldung gibt es bisher KEINEN WebSocket-Test."""
    with client_with(make_settings(max_guests=3)) as c:
        rid, op = raum(c, ("uk", "en"))
        a, da = beitreten(c, rid, "uk"); b, db = beitreten(c, rid, "en")
        op.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == "staff")
        b.send_json({"type": "want", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m.get("waiting") == [db])
        a.send_json({"type": "want", "on": True})
        m, _ = recv_until(op, lambda m: m["type"] == "turn" and m.get("waiting") == [db, da])
        assert m["state"] == "spricht" and m["who"] == "staff"        # keine Unterbrechung
        a.send_json({"type": "want", "on": False})                     # A zieht zurueck
        recv_until(op, lambda m: m["type"] == "turn" and m.get("waiting") == [db])
        a.send_json({"type": "want", "on": True})                      # ... und meldet sich erneut: jetzt hinter B
        recv_until(op, lambda m: m["type"] == "turn" and m.get("waiting") == [db, da])
        op.send_json({"type": "talk", "on": False})                    # Mitarbeiter: Fertig
        m, _ = recv_until(b, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == db)
        assert m["reason"] == "naechster" and m["waiting"] == ["gast"]    # B ist als Erster dran (nicht A); B sieht A nur als "gast", nie die Kennung (S10)
        b.send_json({"type": "talk", "on": True}); b.send_json({"type": "talk", "on": False})   # B bestaetigt und ist fertig
        m, _ = recv_until(a, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == da)
        assert m["reason"] == "naechster" and m["waiting"] == []


def test_B4_wortmeldung_des_mitarbeiters_ueber_websocket():
    """Faengt: 'want' des Mitarbeiters tot (M10)."""
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == dev)
        op.send_json({"type": "want", "on": True})
        recv_until(uk, lambda m: m["type"] == "turn" and m.get("waiting") == ["staff"])
        uk.send_json({"type": "talk", "on": False})
        m, _ = recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == "staff")
        assert m["reason"] == "naechster"


def test_B4_stopp_waehrend_eigene_aussage_verteilt_wird_merkt_den_mitarbeiter_vor():
    """Faengt: takeover bei eigener Aussage ohne request('staff') (M24)."""
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        op.send_json({"type": "talk", "on": True})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "spricht")
        for _ in range(3):
            op.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("audio_chunks", 0) == 3, what="Audio angekommen")
        op.send_json({"type": "talk", "on": False})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "wiedergabe")        # eigene Aussage wird verteilt
        op.send_json({"type": "takeover"})
        recv_until(op, lambda m: m["type"] == "turn" and m.get("waiting") == ["staff"])    # vorgemerkt statt abgebrochen


# ================================================================== B5: deutsche Vorlesung
def test_B5_gast_antwort_wird_auf_deutsch_vertont_und_tts_aus_bleibt_text():
    """Faengt: TTS in der Gastsprache statt 'de' (C03) und tts_enabled=False im Gespraech ignoriert (C04); MockTts kann 'de' nicht von 'uk' unterscheiden."""
    s = make_settings()
    rec = AufzeichnendeTts()
    with client_with(s, pipeline_mit(s, tts=rec)) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        for _ in range(3):
            uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Audio angekommen")
        uk.send_json({"type": "talk", "on": False})
        m, _ = recv_until(op, lambda m: m["type"] == "guest_message")
        assert m["audio"] and set(rec.sprachen) == {"de"}
    s2 = make_settings(tts_enabled=False)
    rec2 = AufzeichnendeTts()
    with client_with(s2, pipeline_mit(s2, tts=rec2)) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        for _ in range(3):
            uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Audio angekommen")
        uk.send_json({"type": "talk", "on": False})
        m, _ = recv_until(op, lambda m: m["type"] == "guest_message")
        assert m["audio"] is None and m["t"]["t_tts"] is None and rec2.sprachen == []


def test_B5_ohne_deutsche_stimme_bleibt_es_beim_text_und_die_sperre_wartet_nicht(tmp_path, monkeypatch):
    """Belegt "fehlt die deutsche Stimme, bleibt es beim Text" mit der echten TTS-Logik (Attrappen-Piper, nur uk/en eingerichtet)."""
    import sys, types
    from test_tts_real import FakeSynthesisConfig, FakeVoice
    mod = types.ModuleType("piper"); mod.PiperVoice = FakeVoice; mod.SynthesisConfig = FakeSynthesisConfig
    monkeypatch.setitem(sys.modules, "piper", mod)
    for n in ("uk_UA-ukrainian_tts-medium", "en_GB-alba-medium"):
        (tmp_path / f"{n}.onnx").write_bytes(b"x")
    s = make_settings(tts_backend="real", tts_voice_dir=str(tmp_path),
                      tts_voices="uk=uk_UA-ukrainian_tts-medium:1,en=en_GB-alba-medium")
    with client_with(s) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        for _ in range(3):
            uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Audio angekommen")
        uk.send_json({"type": "talk", "on": False})
        m, seen = recv_until(op, lambda m: m["type"] == "guest_message")
        assert m["audio"] is None and m["text"].startswith("[de] ")
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "frei")      # ohne "played" des Bedienplatzes


def test_B5_antworten_mehrerer_abschnitte_kommen_in_sprechreihenfolge():
    """DEFEKT (belegt): jeder Abschnitt wird in einer eigenen Aufgabe uebersetzt; seq wird erst NACH Uebersetzung vergeben.
    Ist Abschnitt 1 langsamer als Abschnitt 2, kommt Abschnitt 2 zuerst beim Mitarbeiter an (Anzeige und Vorlesung in falscher Reihenfolge)."""
    s = make_settings()
    with client_with(s, pipeline_mit(s, mt=LangsamerErsterMt())) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        for _ in range(3):
            uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Audio angekommen")
        uk.send_json({"type": "talk", "on": False})
        texte = [recv_until(op, lambda m: m["type"] == "guest_message")[0]["text_src"] for _ in range(2)]
        assert [t.split()[4] for t in texte] == ["1", "2"], f"falsche Reihenfolge: {texte}"


# ================================================================== B7: nichts wird still verworfen
def test_B7_gast_uebersetzungsfehler_wird_dem_mitarbeiter_sichtbar_gemeldet():
    """DEFEKT (belegt): GuestPath._translate zaehlt den Fehler nur (conversation.py:86-88), es kommt keine 'problem'-Nachricht;
    der Satz geht still verloren. (Zeilen 86-88 werden von KEINEM Test ausgefuehrt.)"""
    s = make_settings()
    with client_with(s, pipeline_mit(s, mt=KaputtMt())) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        for _ in range(3):
            uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Audio angekommen")
        uk.send_json({"type": "talk", "on": False})
        seen = []
        for _ in range(40):
            m = recv(op); seen.append(m)
            if m["type"] == "turn" and m["state"] == "frei":
                break
        assert stats(c, rid)["counters"]["pipeline_errors"] >= 1
        assert any(m["type"] == "problem" for m in seen), "Satz verloren, aber keine sichtbare Problemmeldung am Bedienplatz"


def test_B7_gast_nicht_verstanden_meldet_dem_gast_und_dem_mitarbeiter():
    """Faengt: _notice() im Gast-Pfad entfernt (C06); Verdrahtung ist bisher ungetestet (die Attrappen-ASR meldet nie 'nicht erkannt')."""
    class Strom:
        def __init__(self): self._n = None
        async def feed(self, c): return []
        async def flush(self): self._n = "nicht_erkannt"; return []
        def pop_notice(self): n, self._n = self._n, None; return n
        async def close(self): ...
    class Asr:
        async def load(self): ...
        def new_stream(self, lang=None): return Strom()
    s = make_settings()
    with client_with(s, pipeline_mit(s, asr=Asr())) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True}); uk.send_bytes(chunk(100)); uk.send_json({"type": "talk", "on": False})
        m, _ = recv_until(op, lambda m: m["type"] == "problem")
        assert m["what"] == "gast_nicht_erkannt"
        m, _ = recv_until(uk, lambda m: m["type"] == "problem")
        assert m["what"] == "nicht_erkannt"


def test_B7_gast_verbindung_weg_mitten_in_der_aussage_darf_den_rest_nicht_still_verlieren():
    """DEFEKT (belegt): beim Trennen wird nur die Sperre freigegeben, guest.close() verwirft den ungeschlossenen Abschnitt (main.py:567-575);
    flush() wie bei 'Fertig' oder Stopp findet nicht statt, und es gibt keine Meldung."""
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["who"] == dev)
        uk.send_bytes(chunk(100))                                      # 0,1 s: noch kein fertiger Abschnitt
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 1, what="Audio angekommen")
        uk.close()                                                     # Tablet verliert die Verbindung
        m, _ = recv_until(op, lambda m: m["type"] in ("guest_message", "problem"))
        assert m["type"] == "guest_message", "gesprochener Rest muss uebersetzt beim Mitarbeiter ankommen"


def test_B7_gast_spracherkennung_fehler_beendet_nicht_die_verbindung_sondern_meldet():
    """DEFEKT (belegt): eine Ausnahme in guest.on_audio() beendet den drain()-Task und damit die ganze Gast-Verbindung ohne Meldung
    (der Bedienplatz-Pfad faengt dieselbe Ausnahme ab und meldet 'spracherkennung', main.py:318-321)."""
    class Strom:
        async def feed(self, c): raise RuntimeError("ASR kaputt")
        async def flush(self): return []
        async def close(self): ...
    class Asr:
        async def load(self): ...
        def new_stream(self, lang=None): return Strom()
    s = make_settings()
    with client_with(s, pipeline_mit(s, asr=Asr())) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["who"] == dev)
        uk.send_bytes(chunk(100))
        m, _ = recv_until(op, lambda m: m["type"] == "problem")
        assert m["what"] == "gast_spracherkennung"
        m, _ = recv_until(uk, lambda m: m["type"] == "problem")
        assert m["what"] == "spracherkennung"
        uk.send_json({"type": "talk", "on": False})                  # die Verbindung des Gastes besteht weiter: er kann das Wort zurueckgeben
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] in ("uebersetzt", "wiedergabe", "frei"))


def test_B7_vortrag_uebersetzungsfehler_wird_sichtbar_gemeldet():
    """Faengt: Problemmeldung im Orchestrator entfernt (O01). test_pipeline_fehler_stoppt_den_arbeiter_nicht prueft nur den Zaehler."""
    s = make_settings(mock_asr_segment_s=0.2)
    with client_with(s, pipeline_mit(s, mt=KaputtMtAlle())) as c:
        rid = c.post("/api/rooms", headers=hdr()).json()["room_id"]
        uk = open_listener(c, token_of(c.post(f"/api/rooms/{rid}/listener-links", headers=hdr(), json={"lang": "uk"}).json()))
        recv(uk)
        op = open_operator(c, rid)
        op.send_bytes(chunk(100)); op.send_bytes(chunk(100))
        m, _ = recv_until(op, lambda m: m["type"] == "problem")
        assert m["what"] == "uebersetzung"


class KaputtMtAlle:
    async def load(self): ...
    async def translate(self, text, src, tgt):
        raise RuntimeError("Modell kaputt")


def test_B7_audio_verworfen_wird_gemeldet():
    """Faengt: Problemmeldung 'audio_verworfen' entfernt (M22). Die Zeilen 374-377 in main.py werden von keinem Test ausgefuehrt."""
    class BlockierendeAsr:
        class S:
            async def feed(self, c): await asyncio.sleep(0.4); return []
            async def flush(self): return []
            async def close(self): ...
        async def load(self): ...
        def new_stream(self, lang=None): return self.S()
    import app.main as mainmod
    s = make_settings()
    old = mainmod.MAX_AUDIO_QUEUE
    mainmod.MAX_AUDIO_QUEUE = 3
    try:
        with client_with(s, pipeline_mit(s, asr=BlockierendeAsr())) as c:
            rid = c.post("/api/rooms", headers=hdr()).json()["room_id"]       # Vortrag: kein Sprechen-Knopf noetig
            uk = open_listener(c, token_of(c.post(f"/api/rooms/{rid}/listener-links", headers=hdr(), json={"lang": "uk"}).json()))
            recv(uk)
            op = open_operator(c, rid)
            for _ in range(10):
                op.send_bytes(chunk(100))
            m, _ = recv_until(op, lambda m: m["type"] == "problem")
            assert m["what"] == "audio_verworfen"
    finally:
        mainmod.MAX_AUDIO_QUEUE = old


# ================================================================== B8: Datenschutz
def test_B8_limiter_salz_ist_zufaellig_und_der_hash_gesalzen():
    """Faengt: konstantes Salz (S01) oder ungesalzener SHA-256 (S02). Der bestehende Test prueft nur 'kein Klartext'."""
    a = FailureLimiter(3, 600, 900, FakeClock()); b = FailureLimiter(3, 600, 900, FakeClock())
    assert a._id("203.0.113.7") != b._id("203.0.113.7")               # je Start neues Salz
    assert a._id("203.0.113.7") != hashlib.sha256(b"203.0.113.7").hexdigest()[:16]
    assert a._id("203.0.113.7") == a._id("203.0.113.7") and a._id("203.0.113.7") != a._id("203.0.113.8")


def test_B8_limiter_purge_gibt_speicher_frei():
    """Faengt: purge() ohne Wirkung (S06): ohne purge wuerde der Speicher mit jedem fremden Absender wachsen."""
    u = FakeClock(); lim = FailureLimiter(2, 100, 200, u)
    lim.failure("a"); lim.failure("b"); lim.failure("b")             # b gesperrt, a hat einen Fehlversuch
    u.advance(250); lim.purge()
    assert lim._fails == {} and lim._blocked == {}


def test_B8_sperr_warnung_enthaelt_keinen_absender(caplog):
    """Faengt: Absender im Log (M21). Kein Test prueft die Logzeile der Sperre."""
    caplog.set_level(logging.DEBUG)
    with client_with(make_settings(auth_max_fails=2), clock=FakeClock(), client=("203.0.113.77", 4711)) as c:
        for _ in range(3):
            c.post("/api/rooms", headers={"X-Operator-Key": "falsch" * 4})
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "bedienschluessel_sperre" in text
    assert "203.0.113.77" not in text and "testclient" not in text


def test_B8_gast_pfad_loggt_keine_inhalte(caplog):
    """Faengt: Inhalt im Log des Gast-Pfads (C07). test_keine_inhalte_in_logs prueft nur den Vortrag-Pfad."""
    caplog.set_level(logging.DEBUG)
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        for _ in range(3):
            uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Audio angekommen")
        uk.send_json({"type": "talk", "on": False})
        recv_until(op, lambda m: m["type"] == "guest_message")
    text = "\n".join(r.getMessage() for r in caplog.records)
    assert "Testsatz" not in text and "[de]" not in text


def test_B8_geraete_kennungen_sind_zufaellig_nicht_zaehlend():
    """Faengt: Zaehler statt Zufall (R04). Im Projektstand als Massnahme genannt, aber ohne Test."""
    room = RoomManager(make_settings()).create_room(mode="gespraech")
    ids = [room.attach_listener(room.create_listener_token("uk")[0]).id for _ in range(3)]
    assert all(re.fullmatch(r"[0-9a-f]{8}", i) for i in ids) and len(set(ids)) == 3
    ints = sorted(int(i, 16) for i in ids)
    assert ints[-1] - ints[0] > 10                                    # nicht 1,2,3


# ================================================================== B9: Zugriffsschutz
def test_B9_sperre_gilt_je_absender_und_x_forwarded_for_nur_von_loopback():
    """Faengt: alle Absender teilen einen Zaehler (M20) bzw. X-Forwarded-For wird von jeder Adresse geglaubt (S09)."""
    s = make_settings(auth_max_fails=3, auth_block_s=60)
    with client_with(s, client=("127.0.0.1", 50000)) as c:                # wie hinter dem Reverse Proxy auf demselben Rechner
        falsch = lambda ip: c.post("/api/rooms", headers={"X-Operator-Key": "falsch" * 4, "X-Forwarded-For": ip}).status_code
        assert [falsch("198.51.100.1") for _ in range(3)] == [401, 401, 401]
        assert c.post("/api/rooms", headers={**hdr(), "X-Forwarded-For": "198.51.100.1"}).status_code == 429
        assert c.post("/api/rooms", headers={**hdr(), "X-Forwarded-For": "198.51.100.2"}).status_code == 200    # anderer Absender frei
    with client_with(s, client=("203.0.113.5", 50000)) as c:              # direkt aus dem Netz: Header ist gefaelscht
        falsch = lambda ip: c.post("/api/rooms", headers={"X-Operator-Key": "falsch" * 4, "X-Forwarded-For": ip}).status_code
        assert [falsch(f"198.51.100.{i}") for i in range(3)] == [401, 401, 401]       # wechselnde Adresse hilft nicht
        assert c.post("/api/rooms", headers=hdr()).status_code == 429


def test_B9_websocket_richtiger_schluessel_in_der_sperre_4430_danach_wieder_frei():
    """Ergaenzt den bestehenden WS-Test (der prueft nur falsche Schluessel und nie das Ende der Sperre)."""
    from starlette.websockets import WebSocketDisconnect
    u = FakeClock()
    with client_with(make_settings(auth_max_fails=2, auth_block_s=60), clock=u) as c:
        rid = c.post("/api/rooms", headers=hdr()).json()["room_id"]
        def versuch(key):
            with pytest.raises(WebSocketDisconnect) as e:
                with c.websocket_connect("/ws/operator") as ws:
                    ws.send_json({"type": "hello", "room_id": rid, "operator_key": key}); recv(ws, 3)     # mit Zeitgrenze statt endlos zu warten
            return e.value.code
        assert [versuch("falsch" * 4) for _ in range(2)] == [4401, 4401]
        assert versuch(KEY) == 4430                                    # gesperrt: auch der richtige Schluessel
        u.advance(61)
        ws = open_operator(c, rid)                                     # danach wieder frei
        ws.send_json({"type": "ping", "t": 1}); recv_until(ws, lambda m: m["type"] == "pong")


# ================================================================== B6 (Ende-zu-Ende): "Freigeben" waehrend einer haengenden Uebersetzung
class GesteuerteMt:
    """Die Uebersetzung haengt, bis das jeweilige Tor (threading.Event) geoeffnet wird; ins Ukrainische (Mitarbeiter -> Gast)
    und ins Deutsche (Gast -> Mitarbeiter) getrennt steuerbar."""
    def __init__(self):
        import threading
        self.tor_uk, self.tor_de = threading.Event(), threading.Event()
    async def load(self): ...
    async def translate(self, text, src, tgt):
        tor = self.tor_de if tgt == "de" else self.tor_uk
        while not tor.is_set():
            await asyncio.sleep(0.01)
        return f"[{tgt}] {text}"


def test_B6_freigeben_waehrend_uebersetzung_darf_die_naechste_aussage_nicht_vorzeitig_freigeben():
    """DEFEKT (belegt, Ende-zu-Ende): Der Mitarbeiter tippt 'Freigeben', weil eine Uebersetzung haengt. Ein Gast spricht, seine Uebersetzung
    laeuft. Meldet nun die ALTE haengende Uebersetzung 'fertig', zaehlt TurnManager.segment_done() den Abschnitt des Gastes herunter:
    die Sperre geht weiter, obwohl dessen Uebersetzung noch aussteht (guest_message kommt erst NACH 'wiedergabe'/'frei')."""
    s = make_settings(max_guests=2)
    mt = GesteuerteMt()
    with client_with(s, pipeline_mit(s, mt=mt)) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        op.send_json({"type": "talk", "on": True})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "spricht")
        for _ in range(3):
            op.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("audio_chunks", 0) == 3, what="Audio angekommen")
        op.send_json({"type": "talk", "on": False})
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "uebersetzt")           # Uebersetzung ins Ukrainische haengt
        op.send_json({"type": "release"})                                                      # Notbremse
        recv_until(uk, lambda m: m["type"] == "turn" and m["state"] == "frei")
        uk.send_json({"type": "talk", "on": True})                                              # Gast spricht jetzt
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == dev)
        for _ in range(3):
            uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 3, what="Gast-Audio angekommen")
        uk.send_json({"type": "talk", "on": False})
        wait_until(lambda: stats(c, rid)["turn"]["state"] == "uebersetzt", what="Gast fertig, wird uebersetzt")
        mt.tor_uk.set()                                                                         # die ALTE Uebersetzung meldet endlich fertig
        time.sleep(1.5)
        t = stats(c, rid)["turn"]
        assert t["state"] == "uebersetzt", f"Sperre ging vorzeitig weiter ({t['state']}), obwohl die Uebersetzung des Gastes noch aussteht"
        mt.tor_de.set()
        recv_until(op, lambda m: m["type"] == "guest_message")


# ================================================================== Nachtrag: weitere Mutationen
def test_B3_stopp_vergisst_auch_die_erwartete_tonlaenge_des_mitarbeiters():
    """Faengt: take_over loescht _play_s des Mitarbeiters nicht (T03): eine lange alte Vorlesung verlaengerte spaeter die Zeitgrenze
    fuer ein haengendes Geraet (hier 68 s statt 15 s)."""
    u, ev, t = neu(play_max_s=15, grace_s=0.5)
    t.claim("gast:1"); t.segment_started(); t.expect_playback(7, "staff", 60.0)       # dem Mitarbeiter sollten 60 s Ton vorgelesen werden
    assert t.take_over("staff")[0]
    t.segment_done()
    t.expect_playback(8, "gast:2", 1.0)                                                # naechste Aussage: Tablet 2 meldet nie "fertig"
    t.end_speaking("staff")
    assert t.state == WIEDERGABE
    u.t += 16; t.tick()
    assert t.state == FREI and ev[-1]["reason"] == "zeitgrenze_wiedergabe"


def test_B9_sperre_laeuft_auch_lange_nach_dem_ende_ab():
    """Faengt: Sperre laeuft nie ab (S07). Die bestehenden Tests warten genau block_s + 1 s; dann liefert blocked_for() zufaellig 0
    (int(-1)+1), obwohl der Eintrag nie geloescht wuerde. Hier 5000 s."""
    u = FakeClock(); lim = FailureLimiter(3, 600, 900, u)
    for _ in range(3):
        lim.failure("a")
    assert lim.blocked_for("a") > 0
    u.advance(5000)
    assert lim.blocked_for("a") == 0
    assert not lim.failure("a")                                       # Zaehler beginnt neu


def test_B4_wortmeldung_bei_freiem_wort_gibt_das_wort_sofort_und_audio_wird_angenommen():
    """Faengt: ensure_guest() nach request()=='dran' entfernt (M12): das Audio des Gastes ginge still verloren (guest is None)."""
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "want", "on": True})                     # Wort ist frei: sofort dran, ohne "talk"
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == dev)
        uk.send_bytes(chunk(100))
        wait_until(lambda: stats(c, rid)["counters"].get("guest_audio_chunks", 0) == 1, what="Gast-Audio angenommen")


def test_B5_deutsche_stimme_ist_in_tts_voices_zulaessig():
    """Faengt: 'de' aus der Liste erlaubter Sprachen entfernt (K02): TTS_VOICES=...,de=de_DE-thorsten-medium wuerde den Start verweigern.
    Bisher kommt 'de' in keinem Test vor (test_tts_real.py kennt nur uk/en)."""
    from app.config import parse_tts_voices
    assert parse_tts_voices("de=de_DE-thorsten-medium,uk=uk_UA-ukrainian_tts-medium:0") == {
        "de": ("de_DE-thorsten-medium", None), "uk": ("uk_UA-ukrainian_tts-medium", 0)}
    s = make_settings(tts_voices="uk=uk_UA-ukrainian_tts-medium:0,de=de_DE-thorsten-medium")     # validate() darf nicht abbrechen
    assert "de" in parse_tts_voices(s.tts_voices)


def test_B1_B7_fertig_des_mitarbeiters_uebersetzt_auch_den_rest_der_aussage():
    """Faengt: end_utterance() verwirft den Rest (O02). test_mitarbeiter_spricht_gaeste_erhalten_und_melden_fertig verlangt nur 'len(got) >= 1':
    die letzten Worte vor 'Fertig' koennten fehlen, ohne dass ein Test es merkt."""
    with client_with(make_settings()) as c:
        rid, op = raum(c)
        uk, dev = beitreten(c, rid, "uk")
        op.send_json({"type": "talk", "on": True})
        for _ in range(3):
            op.send_bytes(chunk(100))                                  # 1 ganzer Abschnitt (0,2 s) + 0,1 s Rest
        wait_until(lambda: stats(c, rid)["counters"].get("audio_chunks", 0) == 3, what="Audio angekommen")
        op.send_json({"type": "talk", "on": False})
        wait_until(lambda: stats(c, rid)["counters"].get("translations", 0) == 2, what="beide Abschnitte uebersetzt")


# ================================================================== Nutzerwunsch 17.11.2026: Redezeit beliebig lang, nichts schaltet von selbst ab
def test_ohne_stille_frist_bleibt_der_mitarbeiter_stundenlang_dran_und_ein_gast_kann_nur_melden():
    """Faengt: eine Zeitgrenze, die eine Aussage des Mitarbeiters von selbst beendet (Standard: Stille-Frist aus). 3 Stunden ohne hoerbare
    Sprache (Uhr der Sperre vorgestellt); ein Gast meldet sich und versucht, ihn zu stoppen: der Mitarbeiter bleibt dran."""
    assert make_settings().turn_idle_s == 0
    clk = FakeClock(1000.0)
    with client_with(make_settings(max_guests=2)) as c:
        rid, op = raum(c)
        c.app.state.rooms.get(rid).turns.clock = clk
        uk, dev = beitreten(c, rid, "uk")
        op.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == "staff")
        for _ in range(6):                                                # 6 x 30 Minuten = 3 Stunden, nie hoerbare Sprache gemeldet
            clk.advance(1800); time.sleep(0.45)                           # der Takt (alle 0,2 s) hat mindestens einmal geprueft
        t = stats(c, rid)["turn"]
        assert t["state"] == "spricht" and t["who"] == "staff"
        uk.send_json({"type": "want", "on": True}); uk.send_json({"type": "takeover"}); uk.send_json({"type": "release"})
        recv_until(op, lambda m: m["type"] == "turn" and m.get("waiting") == [dev])      # Wortmeldung kommt an ...
        clk.advance(1800); time.sleep(0.45)
        t = stats(c, rid)["turn"]
        assert t["state"] == "spricht" and t["who"] == "staff" and t["waiting"] == [dev]  # ... unterbricht aber nicht, auch nach Stunden nicht
        op.send_json({"type": "talk", "on": False})                        # nur "Fertig" beendet die Aussage
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] in ("uebersetzt", "wiedergabe"))


def test_ohne_stille_frist_bleibt_ein_gast_dran_bis_der_mitarbeiter_stoppt():
    """Faengt: Zeitgrenze fuer Gaeste. Ein Gast spricht (oder schweigt) 3 Stunden lang; der Mitarbeiter kann ihn jederzeit sofort stoppen."""
    clk = FakeClock(1000.0)
    with client_with(make_settings(max_guests=2)) as c:
        rid, op = raum(c)
        c.app.state.rooms.get(rid).turns.clock = clk
        uk, dev = beitreten(c, rid, "uk")
        uk.send_json({"type": "talk", "on": True})
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == dev)
        for _ in range(6):
            clk.advance(1800); time.sleep(0.45)
        t = stats(c, rid)["turn"]
        assert t["state"] == "spricht" and t["who"] == dev
        op.send_json({"type": "takeover"})                                 # Vorrang: sofort
        recv_until(op, lambda m: m["type"] == "turn" and m["state"] == "spricht" and m["who"] == "staff" and m.get("reason") == "unterbrochen")

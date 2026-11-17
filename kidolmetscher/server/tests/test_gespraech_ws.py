"""Gespraechsmodus ueber die echten WebSockets (Starlette-TestClient): Fehler melden statt still verlieren, Abbruch, Reihenfolge, Wettlaeufe.

Eigene Attrappen simulieren, was die echten Stufen tun: langsame Erkennung/Sprachausgabe, Fehler, Abbruch."""
import asyncio
import contextlib
import dataclasses
import queue
import threading
import time
from typing import Optional

from fastapi.testclient import TestClient

from app.main import create_app
from app.pipeline.asr_mock import MockAsr, MockAsrStream
from app.pipeline.base import Pipeline
from app.pipeline.mt_mock import MockMt
from app.pipeline.tts_mock import MockTts
from conftest import KEY, _WsStack, chunk, hdr, make_settings
from test_api import token_of


# ------------------------------------------------------------------ Hilfen
class Reader:
    """Liest einen Test-WebSocket in einem Hintergrund-Thread in eine Warteschlange (kein Haengen bei fehlenden Nachrichten)."""

    def __init__(self, ws, auto_ack=False):
        self.ws, self.q, self.closed = ws, queue.Queue(), False
        self.log = []
        self.auto_ack = auto_ack            # wie der echte Browser: "angezeigt"/"fertig" melden
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        try:
            while True:
                m = self.ws.receive_json()
                self.log.append(m)
                self.q.put(m)
                if self.auto_ack:
                    try:
                        if m["type"] == "translation" and not m.get("replay"):
                            self.ws.send_json({"type": "shown", "seq": m["seq"]})
                            self.ws.send_json({"type": "played", "seq": m["seq"]})
                        elif m["type"] == "guest_message":
                            self.ws.send_json({"type": "played", "seq": m["seq"]})
                    except BaseException:
                        pass
        except BaseException as exc:      # Verbindung zu
            self.closed = True
            self.q.put({"type": "__closed__", "exc": type(exc).__name__})

    def until(self, pred, timeout=5.0):
        end = time.monotonic() + timeout
        seen = []
        while True:
            left = end - time.monotonic()
            if left <= 0:
                return None, seen
            try:
                m = self.q.get(timeout=left)
            except queue.Empty:
                return None, seen
            seen.append(m)
            if pred(m):
                return m, seen

    def flush(self):
        """Alles bisher Angekommene verwerfen (damit alte Nachrichten nicht als neue zaehlen)."""
        try:
            while True:
                self.q.get_nowait()
        except queue.Empty:
            pass

    def collect(self, seconds):
        end = time.monotonic() + seconds
        out = []
        while time.monotonic() < end:
            try:
                out.append(self.q.get(timeout=max(0.01, end - time.monotonic())))
            except queue.Empty:
                break
        return out


@contextlib.contextmanager
def client_for(settings, pipeline=None):
    app = create_app(settings, pipeline) if pipeline is not None else create_app(settings)
    with TestClient(app) as c:
        c.stack = _WsStack()
        try:
            yield c
        finally:
            c.stack.close()


def conv_room(c, langs=("uk",)):
    r = c.post("/api/rooms", headers=hdr(), json={"mode": "gespraech", "langs": list(langs)})
    return r.json()["room_id"]


def link(c, rid, lang):
    return token_of(c.post(f"/api/rooms/{rid}/listener-links", headers=hdr(), json={"lang": lang}).json())


def op_open(c, rid, auto_ack=False):
    ws = c.stack.enter_context(c.websocket_connect("/ws/operator"))
    ws.send_json({"type": "hello", "room_id": rid, "operator_key": KEY})
    rd = Reader(ws, auto_ack)
    m, _ = rd.until(lambda m: m["type"] == "ready")
    assert m
    return ws, rd


def guest_open(c, token, stack=True, auto_ack=False):
    cm = c.websocket_connect("/ws/listener")
    ws = c.stack.enter_context(cm) if stack else cm.__enter__()
    ws.send_json({"type": "hello", "token": token})
    rd = Reader(ws, auto_ack)
    m, _ = rd.until(lambda m: m["type"] == "ready")
    assert m
    return ws, rd, cm


def pipe(asr=None, mt=None, tts=None, seg=0.2):
    return Pipeline(asr=asr or MockAsr(seg), mt=mt or MockMt(), tts=tts or MockTts())


def is_turn(state=None, who=None):
    def p(m):
        if m["type"] != "turn":
            return False
        if state and m["state"] != state:
            return False
        if who == "gast:" and not (m["who"] or "").startswith("gast:"):
            return False
        if who and who != "gast:" and m["who"] != who:
            return False
        return True
    return p


# ================================================================== Befund 1: MT-Fehler im Gast-Pfad ohne Problemmeldung
class FailMt(MockMt):
    async def translate(self, text, src, tgt):
        if tgt == "de":
            raise RuntimeError("MT kaputt (Gast -> Mitarbeiter)")
        return await super().translate(text, src, tgt)


def test_gast_uebersetzung_fehlgeschlagen_wird_dem_mitarbeiter_gemeldet():
    with client_for(make_settings(max_guests=2), pipe(mt=FailMt())) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"))
        uk.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "gast:"))[0]
        for _ in range(3):
            uk.send_bytes(chunk(100))
        uk.send_json({"type": "talk", "on": False})
        got = oprd.collect(2.0) + ukrd.collect(0.1)
        kinds = [(m["type"], m.get("what")) for m in got if m["type"] in ("problem", "guest_message")]
        assert any(k[0] == "problem" for k in kinds), f"weder Text noch Problemmeldung: {kinds}"


# ================================================================== Befund 2: Gast trennt nach "Fertig" -> Uebersetzung geht verloren
def test_gast_trennt_sofort_nach_fertig_uebersetzung_geht_nicht_verloren():
    s = make_settings(max_guests=2, mock_delay_ms=300)
    with client_for(s) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        uk, ukrd, cm = guest_open(c, link(c, rid, "uk"), stack=False)
        uk.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "gast:"))[0]
        for _ in range(3):
            uk.send_bytes(chunk(100))
        uk.send_json({"type": "talk", "on": False})
        cm.__exit__(None, None, None)                                   # Tablet geht in den Ruhezustand / WLAN weg
        m, seen = oprd.until(lambda m: m["type"] == "guest_message", timeout=4.0)
        assert m is not None, f"Aussage des Gastes ging verloren; Mitarbeiter sah nur: {[x['type'] for x in seen]}"


def test_gast_trennt_waehrend_er_spricht_rest_wird_trotzdem_uebersetzt():
    s = make_settings(max_guests=2)
    with client_for(s) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        uk, ukrd, cm = guest_open(c, link(c, rid, "uk"), stack=False)
        uk.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "gast:"))[0]
        uk.send_bytes(chunk(100))                                        # 0,1 s Sprache: noch kein Abschnitt abgeschlossen
        time.sleep(0.2)
        cm.__exit__(None, None, None)
        m, seen = oprd.until(lambda m: m["type"] == "guest_message", timeout=3.0)
        assert m is not None, f"Rest der Aussage wurde verworfen; Mitarbeiter sah: {[x['type'] for x in seen]}"


# ================================================================== Befund 3: Reihenfolge bei Stopp + langsamer Sprachausgabe
class SlowDeTts(MockTts):
    async def synthesize(self, text, lang):
        if lang == "de":
            await asyncio.sleep(0.8)
        return await super().synthesize(text, lang)


def test_stopp_waehrend_vorlesung_reihenfolge_der_gast_saetze_bleibt_erhalten():
    with client_for(make_settings(max_guests=2), pipe(tts=SlowDeTts())) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"))
        uk.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "gast:"))[0]
        uk.send_bytes(chunk(100)); uk.send_bytes(chunk(100))             # Satz 1 fertig -> Vorlesung (0,8 s) beginnt
        uk.send_bytes(chunk(100))                                        # Rest = Satz 2
        time.sleep(0.15)
        op.send_json({"type": "takeover"})                               # Mitarbeiter stoppt den Gast
        msgs = []
        end = time.monotonic() + 3.0
        while time.monotonic() < end and len([m for m in msgs if m["type"] == "guest_message"]) < 2:
            m = oprd.until(lambda m: m["type"] == "guest_message", timeout=max(0.1, end - time.monotonic()))[0]
            if m:
                msgs.append(m)
        texts = [m["text"] for m in msgs if m["type"] == "guest_message"]
        assert len(texts) == 2, texts
        assert "Nummer 1" in texts[0] and "Nummer 2" in texts[1], f"falsche Reihenfolge beim Mitarbeiter: {texts}"


# ================================================================== Befund 4: ASR-Fehler im Gast-Pfad
class BoomStream(MockAsrStream):
    async def feed(self, chunk):
        raise RuntimeError("Erkennung kaputt")


class BoomAsr(MockAsr):
    def new_stream(self, lang=None):
        return BoomStream(0.2, 0, lambda: 0)


def test_gast_asr_fehler_wird_gemeldet_und_verbindung_bleibt():
    with client_for(make_settings(max_guests=2), pipe(asr=BoomAsr())) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"))
        uk.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "gast:"))[0]
        uk.send_bytes(chunk(100))
        got_op = oprd.collect(1.5)
        stats = c.get(f"/api/rooms/{rid}/stats", headers=hdr()).json()
        assert stats["listeners_connected"] == 1, "Verbindung des Gastes wurde wegen des Erkennungsfehlers beendet"
        assert any(m["type"] == "problem" for m in got_op), f"Mitarbeiter bekam keine Problemmeldung: {[m['type'] for m in got_op]}"


# ================================================================== Befund 5: spaete Abschluss-Aufgabe beendet die NEUE Aussage
class SlowFlushStream(MockAsrStream):
    async def flush(self):
        await asyncio.sleep(1.2)
        return await super().flush()


class SlowFlushAsr(MockAsr):
    def new_stream(self, lang=None):
        if lang is None:                                   # Mitarbeiter: normal schnell
            return super().new_stream(lang)
        return SlowFlushStream(self._segment_s, 0, self._clock)   # Gaeste: Abschluss dauert (wie echte Erkennung)


def test_sperre_bleibt_bis_der_abgeschnittene_rest_des_gastes_uebersetzt_und_zugestellt_ist():
    """Der Mitarbeiter stoppt den Gast und ist sofort fertig; die Erkennung des Rests dauert noch. Die Sperre darf erst frei werden,
    wenn der Rest beim Mitarbeiter angekommen ist (sonst koennte die naechste Person den Satz uebersprechen)."""
    s = dataclasses.replace(make_settings(max_guests=2), turn_idle_s=30.0)
    with client_for(s, pipe(asr=SlowFlushAsr(0.5))) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid, auto_ack=True)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"), auto_ack=True)
        uk.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "gast:"))[0]
        uk.send_bytes(chunk(100))                                        # offener Rest -> Abschluss dauert 1,2 s
        time.sleep(0.2)
        op.send_json({"type": "takeover"})                               # Stopp
        assert oprd.until(is_turn("spricht", "staff"))[0]
        op.send_json({"type": "talk", "on": False})                      # Mitarbeiter ist sofort fertig
        m, seen = oprd.until(lambda m: m["type"] == "guest_message" or is_turn("frei")(m), timeout=6.0)
        assert m is not None and m["type"] == "guest_message", f"Sperre wurde frei, bevor der Rest ankam: {[x['type'] for x in seen]}"
        assert oprd.until(is_turn("frei"), timeout=6.0)[0], "danach muss die Sperre wieder frei werden"


# ================================================================== Befund 7: "nicht erkannt" beim Abschluss der Aussage des Mitarbeiters
class FlushNoticeStream(MockAsrStream):
    """Wie die echte Erkennung: beim Abschluss kommt kein Text heraus, der Hinweis 'nicht_erkannt' wird vermerkt."""
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._notice = None

    async def flush(self):
        self._acc = 0.0
        self._notice = "nicht_erkannt"
        return []

    def pop_notice(self):
        n, self._notice = self._notice, None
        return n


class FlushNoticeAsr(MockAsr):
    def new_stream(self, lang=None):
        return FlushNoticeStream(self._segment_s, 0, self._clock)


def test_mitarbeiter_nicht_erkannt_beim_abschluss_wird_sofort_gemeldet_nicht_erst_spaeter():
    with client_for(make_settings(max_guests=2), pipe(asr=FlushNoticeAsr(5.0))) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"))
        op.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "staff"))[0]
        op.send_bytes(chunk(100))
        op.send_json({"type": "talk", "on": False})                      # Abschluss: nichts erkannt
        m, seen = oprd.until(is_turn("frei"), timeout=4.0)
        assert m
        seen += oprd.collect(0.5)
        assert any(x["type"] == "problem" for x in seen), "nach 'Fertig' keine Meldung 'nicht erkannt'"


def test_nicht_erkannt_des_letzten_abschnitts_taucht_erst_bei_der_naechsten_aussage_auf():
    with client_for(make_settings(max_guests=2), pipe(asr=FlushNoticeAsr(5.0))) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"))
        op.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "staff"))[0]
        op.send_bytes(chunk(100))
        op.send_json({"type": "talk", "on": False})
        assert oprd.until(is_turn("frei"), timeout=4.0)[0]
        oprd.flush()
        op.send_json({"type": "talk", "on": True})                       # zweite Aussage, erster Block
        assert oprd.until(is_turn("spricht", "staff"))[0]
        op.send_bytes(chunk(100))
        m, _ = oprd.until(lambda m: m["type"] == "problem", timeout=1.5)
        assert m is None, "alte Meldung 'nicht erkannt' erscheint mitten in der neuen Aussage"


# ================================================================== Befund 9: Abbruch der Bedienplatz-Verbindung beendet fremde Aussagen
def test_bedienplatz_verbindungsabbruch_beendet_nicht_die_aussage_eines_gastes():
    with client_for(make_settings(max_guests=3)) as c:
        rid = conv_room(c, ("uk", "en"))
        cm_op = c.websocket_connect("/ws/operator")
        op = cm_op.__enter__()
        op.send_json({"type": "hello", "room_id": rid, "operator_key": KEY})
        oprd = Reader(op)
        assert oprd.until(lambda m: m["type"] == "ready")[0]
        a, ard, _ = guest_open(c, link(c, rid, "uk"))
        b, brd, _ = guest_open(c, link(c, rid, "en"))
        a.send_json({"type": "talk", "on": True})
        assert ard.until(is_turn("spricht", "gast:"))[0]
        b.send_json({"type": "want", "on": True})                        # B wartet
        assert ard.until(lambda m: m["type"] == "turn" and m["waiting"])[0]
        a.send_bytes(chunk(100))
        ard.flush()
        cm_op.__exit__(None, None, None)                                 # kurzer Netzabbruch des Bedienplatzes
        msgs = ard.collect(2.0)
        ended = [m for m in msgs if m["type"] == "turn" and not (m["state"] == "spricht" and (m["who"] or "").startswith("gast:"))]
        assert not ended, f"Gast A wurde mitten in der Rede abgeschnitten, B's Wortmeldung gestrichen: {[(m['state'], m['reason'], m['waiting']) for m in ended]}"


# ================================================================== Befund 3 (Ende-zu-Ende): Notbremse + noch laufende Uebersetzung
class StagedMt(MockMt):
    """Mitarbeiter -> Gast schnell (0,3 s), Gast -> Mitarbeiter langsam (2 s)."""
    async def translate(self, text, src, tgt):
        await asyncio.sleep(2.0 if tgt == "de" else 0.3)
        return f"[{tgt}] {text}"


def test_notbremse_waehrend_uebersetzung_sperre_bleibt_fuer_den_naechsten_sprecher_bis_zum_ende():
    with client_for(make_settings(max_guests=2), pipe(mt=StagedMt())) as c:
        rid = conv_room(c)
        room = c.app.state.rooms.get(rid)
        op, oprd = op_open(c, rid, auto_ack=True)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"), auto_ack=True)
        op.send_json({"type": "talk", "on": True})
        assert oprd.until(is_turn("spricht", "staff"))[0]
        op.send_bytes(chunk(100)); op.send_bytes(chunk(100))             # ein Abschnitt, Uebersetzung laeuft (0,3 s)
        op.send_json({"type": "talk", "on": False})
        assert oprd.until(is_turn("uebersetzt"))[0]
        op.send_json({"type": "release"})                                # Notbremse, obwohl noch uebersetzt wird
        assert oprd.until(is_turn("frei"))[0]
        uk.send_json({"type": "talk", "on": True})                       # Gast spricht sofort danach (ein Satz, 2 s Uebersetzung)
        assert oprd.until(is_turn("spricht", "gast:"))[0]
        uk.send_bytes(chunk(100)); uk.send_bytes(chunk(100))
        uk.send_json({"type": "talk", "on": False})
        t0 = time.monotonic()
        m, seen = oprd.until(lambda m: (m["type"] == "guest_message") or is_turn("frei")(m), timeout=6.0)
        assert m is not None and m["type"] == "guest_message", (
            f"Sperre wurde nach {time.monotonic() - t0:.1f} s frei, bevor der Satz des Gastes beim Mitarbeiter ankam: {[x['type'] + ':' + str(x.get('state')) for x in seen]}")


# ================================================================== Gegenprobe B1: laute Sprache haelt das Wort, Stille gibt es frei
def _laut(ms=100, amp=3000, rate=16000):
    import math, struct
    n = rate * ms // 1000
    return b"".join(struct.pack("<h", int(amp * math.sin(2 * math.pi * 300 * i / rate))) for i in range(n))


def test_keine_redezeitgrenze_aber_stille_beendet_gast_und_mitarbeiter():
    s = dataclasses.replace(make_settings(max_guests=2), turn_idle_s=1.5)
    with client_for(s) as c:
        rid = conv_room(c)
        op, oprd = op_open(c, rid, auto_ack=True)
        uk, ukrd, _ = guest_open(c, link(c, rid, "uk"), auto_ack=True)
        for who, ws, rd in (("gast", uk, oprd), ("staff", op, oprd)):
            ws.send_json({"type": "talk", "on": True})
            assert rd.until(is_turn("spricht", "gast:" if who == "gast" else "staff"))[0]
            t_end = time.monotonic() + 4.0                                # laenger als idle_s (1,5 s), aber laut
            while time.monotonic() < t_end:
                ws.send_bytes(_laut()); time.sleep(0.1)
            assert c.app.state.rooms.get(rid).turns.state == "spricht", f"{who}: Redezeit wurde begrenzt"
            m, _ = rd.until(is_turn("uebersetzt"), timeout=4.0)           # nun Stille: nach idle_s endet die Aussage
            assert m and m["reason"] == "inaktiv", f"{who}: Stille beendet die Aussage nicht"
            assert rd.until(is_turn("frei"), timeout=6.0)[0]

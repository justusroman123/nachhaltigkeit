"""Zufallslauf (Chaos) gegen den Gespraechsmodus. Prueft Lebendigkeit (Sperre wird wieder frei, nichts bleibt
in waiting/awaiting haengen) und dass der Server keine unbehandelten Fehler meldet."""
import logging
import random
import time

import pytest

from app.turns import TurnLimits
from test_gespraech_ws import client_for, conv_room, op_open, guest_open, link, chunk, make_settings


def _act(rng, op, guests, room):
    who = rng.choice(["op", "g0", "g1", "g1", "g0"])
    kind = rng.choice(["talk_on", "talk_on", "audio", "audio", "audio", "talk_off", "want_on", "want_off", "takeover", "release",
                       "reconnect", "silence"])
    if who == "op":
        if kind == "talk_on": op.send_json({"type": "talk", "on": True})
        elif kind == "talk_off": op.send_json({"type": "talk", "on": False})
        elif kind == "audio":
            for _ in range(rng.randint(1, 4)): op.send_bytes(chunk(100))
        elif kind == "want_on": op.send_json({"type": "want", "on": True})
        elif kind == "want_off": op.send_json({"type": "want", "on": False})
        elif kind == "takeover": op.send_json({"type": "takeover"})
        elif kind == "release" and rng.random() < 0.3: op.send_json({"type": "release"})
    else:
        i = int(who[1])
        g = guests[i]
        if g["ws"] is None:
            return
        ws = g["ws"]
        if kind == "talk_on": ws.send_json({"type": "talk", "on": True})
        elif kind == "talk_off": ws.send_json({"type": "talk", "on": False})
        elif kind == "audio":
            for _ in range(rng.randint(1, 4)): ws.send_bytes(chunk(100))
        elif kind == "want_on": ws.send_json({"type": "want", "on": True})
        elif kind == "want_off": ws.send_json({"type": "want", "on": False})
        elif kind == "reconnect" and rng.random() < 0.5:
            g["reopen"]()


@pytest.mark.parametrize("seed", [1, 2, 3, 4, 5, 6])
def test_zufallslauf_sperre_wird_immer_wieder_frei(seed, caplog):
    rng = random.Random(seed)
    caplog.set_level(logging.WARNING)
    s = make_settings(max_guests=3)
    with client_for(s) as c:
        rid = conv_room(c, ("uk", "en"))
        room = c.app.state.rooms.get(rid)
        room.turns.limits = TurnLimits(idle_s=1.0, pickup_s=1.0, process_max_s=3.0, play_max_s=2.0, grace_s=0.1)
        op, oprd = op_open(c, rid, auto_ack=True)
        guests = []
        for lang in ("uk", "en"):
            tok = link(c, rid, lang)
            g = {"tok": tok, "ws": None, "rd": None, "cm": None}

            def reopen(g=g):
                if g["cm"] is not None:
                    try: g["cm"].__exit__(None, None, None)
                    except BaseException: pass
                ws, rd, cm = guest_open(c, g["tok"], stack=False, auto_ack=True)
                g["ws"], g["rd"], g["cm"] = ws, rd, cm
            g["reopen"] = reopen
            reopen()
            guests.append(g)
        t_end = time.monotonic() + 12
        n = 0
        while time.monotonic() < t_end:
            _act(rng, op, guests, room); n += 1
            time.sleep(rng.choice([0.01, 0.05, 0.1, 0.2, 0.4]))
        # Ruhe: alles muss von selbst wieder frei werden
        deadline = time.monotonic() + 15
        t = room.turns
        while time.monotonic() < deadline:
            if t.state == "frei" and not t.waiting and not t.awaiting and t.pending == 0:
                break
            time.sleep(0.2)
        snap = (t.state, t.who, list(t.waiting), sorted(t.awaiting), t.pending)
        for g in guests:
            if g["cm"] is not None:
                try: g["cm"].__exit__(None, None, None)
                except BaseException: pass
        assert snap[0] == "frei" and not snap[2] and not snap[3] and snap[4] == 0, f"seed={seed} Sperre haengt: {snap}"
        bad = [r for r in caplog.records if r.levelno >= logging.ERROR and "gast_pipeline_fehler" not in r.getMessage()]
        assert not bad, [r.getMessage() for r in bad][:5]

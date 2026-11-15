from app.turns import FREI, SPRICHT, UEBERSETZT, WIEDERGABE, TurnLimits, TurnManager


class Uhr:
    def __init__(self): self.t = 0.0
    def __call__(self): return self.t


def neu(**kw):
    u = Uhr(); events = []
    return u, events, TurnManager(limits=TurnLimits(**kw), clock=u, on_change=events.append)


def test_normaler_ablauf_und_sperre_fuer_alle():
    u, ev, t = neu()
    assert t.claim("staff") == (True, "")
    assert t.claim("gast:1") == (False, "busy")          # wer spricht, sperrt alle anderen
    t.segment_started(); t.end_speaking("staff")
    assert t.state == UEBERSETZT and t.claim("gast:1") == (False, "busy")
    t.expect_playback(1, "gast:1"); t.expect_playback(1, "gast:2")
    t.segment_done()
    assert t.state == WIEDERGABE and t.claim("gast:2") == (False, "busy")
    t.playback_done(1, "gast:1"); assert t.state == WIEDERGABE
    t.playback_done(1, "gast:2"); u.t += 0.6; t.tick()
    assert t.state == FREI and t.claim("gast:2")[0]
    assert [e["state"] for e in ev] == [SPRICHT, UEBERSETZT, WIEDERGABE, FREI, SPRICHT]


def test_wer_zuerst_kommt_bekommt_das_wort():
    _, _, t = neu()
    assert t.claim("gast:1")[0] and not t.claim("gast:2")[0] and not t.claim("staff")[0]


def test_kurze_schonfrist_nach_alle_fertig():
    u, _, t = neu(grace_s=0.5)
    t.claim("staff"); t.end_speaking("staff")             # nichts zu verarbeiten
    assert t.state == WIEDERGABE
    u.t += 0.3; t.tick(); assert t.state == WIEDERGABE
    u.t += 0.3; t.tick(); assert t.state == FREI


def test_zeitgrenzen_verhindern_dauerhafte_sperre():
    u, _, t = neu(speak_max_s=5, process_max_s=4, play_max_s=3)
    t.claim("gast:1"); t.segment_started(); t.segment_started(); u.t += 5.1; t.tick()
    assert t.state == UEBERSETZT                          # Sprechen zu lang: beendet, 2 Abschnitte offen
    u.t += 4.1; t.tick(); assert t.state == WIEDERGABE   # Verarbeitung haengt: weiter
    t.expect_playback(1, "gast:9")
    u.t += 3.1; t.tick(); assert t.state == FREI         # Geraet meldet nie "fertig": frei
    assert t.claim("staff")[0]


def test_notbremse_gibt_sofort_frei():
    _, ev, t = neu()
    t.claim("staff"); t.release()
    assert t.state == FREI and ev[-1]["reason"] == "freigegeben"
    t.release()                                           # schon frei: nichts passiert
    assert len(ev) == 2


def test_getrenntes_geraet_blockiert_nicht():
    u, _, t = neu(grace_s=0)
    t.claim("staff"); t.end_speaking("staff"); t.expect_playback(1, "gast:1")
    assert t.state == WIEDERGABE
    t.device_left("gast:1"); u.t += 0.1; t.tick()
    assert t.state == FREI


def test_spricher_verlaesst_geraet_beendet_aussage():
    _, _, t = neu()
    t.claim("gast:1"); t.device_left("gast:1")
    assert t.state in (UEBERSETZT, WIEDERGABE)


def test_fremdes_ende_wird_ignoriert():
    _, _, t = neu()
    t.claim("staff"); t.end_speaking("gast:1")
    assert t.state == SPRICHT

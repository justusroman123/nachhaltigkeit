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


def test_wortmeldung_unterbricht_nicht_und_uebernimmt_automatisch():
    u, ev, t = neu(grace_s=0.5)
    t.claim("staff")
    assert t.request("gast:1") == "vorgemerkt"
    assert t.state == SPRICHT and t.who == "staff"                  # keine Unterbrechung
    assert ev[-1]["waiting"] == ["gast:1"] and ev[-1]["reason"] == "wortmeldung"
    t.end_speaking("staff"); u.t += 0.6; t.tick()                    # nichts zu verarbeiten, alles fertig
    assert t.state == SPRICHT and t.who == "gast:1" and t.waiting == []
    assert ev[-1]["reason"] == "naechster"


def test_wortmeldungen_der_reihe_nach_und_zurueckziehen():
    u, _, t = neu(grace_s=0.5)
    t.claim("staff")
    t.request("gast:1"); t.request("gast:2"); t.request("gast:1")   # doppelt zaehlt einmal
    assert t.waiting == ["gast:1", "gast:2"]
    t.cancel_request("gast:1")
    assert t.waiting == ["gast:2"]
    t.end_speaking("staff"); u.t += 0.6; t.tick()
    assert t.who == "gast:2"


def test_wortmeldung_bei_frei_gibt_das_wort_sofort():
    _, _, t = neu()
    assert t.request("gast:1") == "dran" and t.who == "gast:1"
    assert t.claim("gast:1")[0]                                      # Bestaetigung vom Geraet bleibt gueltig


def test_keine_redezeitgrenze_von_2_minuten_mehr():
    u, _, t = neu()
    t.claim("staff")
    u.t += 600; t.tick()                                             # 10 Minuten am Stueck
    assert t.state == SPRICHT and t.who == "staff"


def test_uebernommenes_wort_ohne_bestaetigung_geht_weiter():
    u, _, t = neu(grace_s=0.5, pickup_s=30)
    t.claim("staff"); t.request("gast:1")
    t.end_speaking("staff"); u.t += 0.6; t.tick()
    assert t.who == "gast:1"
    u.t += 31; t.tick()                                              # Geraet meldet sich nicht: nicht ewig blockieren
    assert t.state != SPRICHT
    u.t += 1; t.tick(); u.t += 1; t.tick()
    assert t.state in (WIEDERGABE, FREI)


def test_geraet_weg_nimmt_wortmeldung_zurueck():
    _, _, t = neu()
    t.claim("staff"); t.request("gast:1"); t.device_left("gast:1")
    assert t.waiting == []

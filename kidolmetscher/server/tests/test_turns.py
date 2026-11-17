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
    u, ev, t = neu(idle_s=5, process_max_s=4, play_max_s=3)
    t.claim("gast:1"); t.segment_started(); t.segment_started(); u.t += 5.1; t.tick()
    assert t.state == UEBERSETZT and ev[-1]["reason"] == "inaktiv"     # lange Stille: beendet, 2 Abschnitte offen
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


def test_keine_redezeitgrenze_solange_gesprochen_wird():
    u, _, t = neu(idle_s=120)
    t.claim("staff")
    for _ in range(40):                                              # 40 Minuten am Stueck, alle 30 s hoerbare Sprache
        u.t += 60; t.touch("staff"); t.tick()
        assert t.state == SPRICHT and t.who == "staff"


def test_nur_lange_stille_gibt_das_wort_frei():
    u, ev, t = neu(idle_s=120, grace_s=0.5)
    t.claim("staff")
    u.t += 119; t.tick(); assert t.state == SPRICHT                  # fast 2 Minuten Stille: noch dran
    t.touch("staff"); u.t += 119; t.tick(); assert t.state == SPRICHT   # Sprache setzt die Frist zurueck
    u.t += 2; t.tick()
    assert t.state in (UEBERSETZT, WIEDERGABE) and ev[-2]["reason"] == "inaktiv"


def test_aktivitaet_anderer_personen_verlaengert_nichts():
    u, _, t = neu(idle_s=10)
    t.claim("staff")
    u.t += 6; t.touch("gast:1")                                      # Geraeusche eines Gastes zaehlen nicht
    u.t += 5; t.tick()
    assert t.state != SPRICHT


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


def test_mitarbeiter_stoppt_sprechenden_gast_sofort():
    u, ev, t = neu(grace_s=0.5)
    t.claim("gast:1")
    t.segment_started()                                              # ein Abschnitt des Gastes ist noch in Arbeit
    t.expect_playback(7, "staff", 3.0)                               # dem Mitarbeiter sollte noch vorgelesen werden
    ok, prev = t.take_over("staff")
    assert ok and prev == "gast:1"
    assert t.state == SPRICHT and t.who == "staff" and ev[-1]["reason"] == "unterbrochen"
    assert (7, "staff") not in t.awaiting                            # Vorlesen entfaellt
    assert t.pending == 1                                            # Verarbeitung des Gesagten laeuft weiter, nichts geht verloren
    t.segment_done()
    t.end_speaking("staff"); u.t += 0.6; t.tick()
    assert t.state == FREI


def test_mitarbeiter_uebernimmt_waehrend_uebersetzt_und_vorgelesen_wird():
    u, _, t = neu()
    t.claim("gast:1"); t.segment_started(); t.end_speaking("gast:1")
    assert t.state == UEBERSETZT
    ok, prev = t.take_over("staff")
    assert ok and prev == "gast:1" and t.who == "staff" and t.state == SPRICHT
    t.segment_done()
    t.end_speaking("staff"); t.expect_playback(2, "gast:1")
    ok2, why = t.take_over("staff")                                  # eigene Aussage wird gerade verteilt: nicht abbrechen
    assert t.state == WIEDERGABE and not ok2 and why == "eigene_aussage"


def test_gast_kann_niemanden_stoppen_nur_melden():
    _, _, t = neu()
    t.claim("staff")
    assert t.take_over("gast:1") == (False, "nicht_erlaubt")         # Vorrang nur fuer den Mitarbeiter
    assert t.state == SPRICHT and t.who == "staff"
    assert t.request("gast:1") == "vorgemerkt"                       # Gast kann sich nur melden: kein Abbruch
    assert t.state == SPRICHT and t.who == "staff" and t.waiting == ["gast:1"]


def test_standard_ohne_stille_frist_nichts_beendet_eine_aussage_von_selbst():
    """Nutzerwunsch 17.11.2026: Mitarbeiter und Gast sprechen so lange sie wollen; nur "Fertig" oder Stopp beendet (Stille-Frist aus)."""
    assert TurnLimits().idle_s == 0
    u, ev, t = neu()
    t.claim("staff")
    for _ in range(36):                                   # 3 Stunden in 5-Minuten-Schritten, dazwischen nie hoerbare Sprache
        u.t += 300; t.tick()
        assert t.state == SPRICHT and t.who == "staff"
    t.touch("staff"); u.t += 3600; t.tick()
    assert t.state == SPRICHT and t._deadline is None     # auch nach hoerbarer Sprache entsteht keine Frist
    assert t.request("gast:1") == "vorgemerkt" and t.take_over("gast:1") == (False, "nicht_erlaubt")
    u.t += 10_000; t.tick()
    assert t.state == SPRICHT and t.who == "staff" and t.waiting == ["gast:1"]       # Gast hat nur gemeldet, nichts unterbrochen
    t.end_speaking("staff")                               # "Fertig"
    assert t.state in (UEBERSETZT, WIEDERGABE)


def test_standard_ohne_stille_frist_ein_gast_bleibt_dran_bis_der_mitarbeiter_stoppt():
    u, ev, t = neu()
    t.claim("gast:1")
    u.t += 7200; t.tick(); t.touch("gast:1"); u.t += 7200; t.tick()
    assert t.state == SPRICHT and t.who == "gast:1"
    ok, prev = t.take_over("staff")                       # Vorrang des Mitarbeiters gilt immer
    assert ok and prev == "gast:1" and t.who == "staff" and ev[-1]["reason"] == "unterbrochen"


def test_wortmeldung_uebergabe_ohne_stille_frist_hat_nach_der_bestaetigung_keine_frist():
    u, ev, t = neu(pickup_s=30)
    t.claim("staff"); assert t.request("gast:1") == "vorgemerkt"
    t.end_speaking("staff"); u.t += 0.6; t.tick()                                    # nichts offen: frei, der Gast bekommt das Wort automatisch
    assert t.state == SPRICHT and t.who == "gast:1" and t._pickup
    assert t.claim("gast:1") == (True, "")                                           # Geraet bestaetigt
    u.t += 7200; t.tick()
    assert t.state == SPRICHT and t.who == "gast:1" and t._deadline is None


def test_mit_eingeschalteter_stille_frist_endet_die_aussage_wie_eingestellt():
    u, ev, t = neu(idle_s=30)
    t.claim("staff"); u.t += 29; t.tick(); assert t.state == SPRICHT
    t.touch("staff"); u.t += 29; t.tick(); assert t.state == SPRICHT                 # hoerbare Sprache verschiebt die Frist
    u.t += 2; t.tick()
    assert t.state in (UEBERSETZT, WIEDERGABE) and any(e.get("reason") == "inaktiv" for e in ev)      # erst nach 29 + 2 s Stille

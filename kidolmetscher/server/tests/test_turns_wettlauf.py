"""Wettlaeufe und Zeitgrenzen der Sperrlogik (app/turns.py, reine Logik, ohne Netz). Herkunft: Gutachten zum Gespraechsmodus."""
from app.turns import FREI, SPRICHT, UEBERSETZT, WIEDERGABE, TurnLimits, TurnManager


class Uhr:
    def __init__(self): self.t = 0.0
    def __call__(self): return self.t


def neu(**kw):
    u = Uhr(); events = []
    return u, events, TurnManager(limits=TurnLimits(**kw), clock=u, on_change=events.append)


# ---------------------------------------------------------------- Befund: pending ohne Zuordnung zur Aussage
def test_alter_abschnitt_zaehlt_pending_des_neuen_sprechers_herunter():
    """Notbremse waehrend noch uebersetzt wird: die alten Abschnitte melden sich spaeter ab und zaehlen den NEUEN
    Sprecher herunter -> Sperre geht in 'wiedergabe'/'frei', obwohl dessen Satz noch uebersetzt wird (B6)."""
    u, ev, t = neu(grace_s=0.5)
    t.claim("staff"); alt1 = t.segment_started(); alt2 = t.segment_started()      # zwei Abschnitte des Mitarbeiters in Arbeit (mit Marke der Runde)
    t.end_speaking("staff")
    t.release()                                                      # Mitarbeiter drueckt "Freigeben"
    assert t.state == FREI and t.pending == 0
    assert t.claim("gast:1")[0]
    t.segment_started()                                              # ein Abschnitt des Gastes
    t.end_speaking("gast:1")
    assert t.state == UEBERSETZT and t.pending == 1
    t.segment_done(alt1); t.segment_done(alt2)                       # die ALTEN Abschnitte melden sich spaet: gehoeren zu einer beendeten Runde
    assert t.state == UEBERSETZT and t.pending == 1, "Sperre faellt, obwohl der Satz des Gastes noch uebersetzt wird"


def test_segment_started_in_wiedergabe_wird_nicht_gezaehlt_und_sperre_faellt_zu_frueh():
    """Gast-Rest nach Stopp/Stille wird erst NACH dem Wechsel in 'wiedergabe' gestartet: segment_started() ignoriert ihn,
    expect_playback() haengt ihn an, aber die laufende Schonfrist gibt die Sperre trotzdem frei."""
    u, ev, t = neu(grace_s=0.5)
    t.claim("staff"); t.end_speaking("staff")                        # nichts in Arbeit -> wiedergabe, Schonfrist laeuft
    assert t.state == WIEDERGABE and t._free_at is not None
    t.segment_started()                                              # Rest eines abgeschnittenen Gastes wird jetzt erst erkannt
    t.expect_playback(9, "staff", 4.0)                               # Ergebnis liegt vor, Mitarbeiter muss noch "fertig" melden
    u.t += 0.6; t.tick()
    assert t.state == WIEDERGABE, "Sperre ist frei, obwohl noch ein 'fertig' des Geraets aussteht"


# ---------------------------------------------------------------- Befund: Zeitgrenze summiert den ganzen Vortrag
def test_wiedergabe_zeitgrenze_nutzt_summe_aller_toene_statt_offener():
    """Ein Geraet quittiert alle Abschnitte bis auf den letzten. Die Zeitgrenze richtet sich nach der SUMME aller Toene der
    Aussage (nie verkleinert), nicht nach dem, was noch offen ist."""
    u, ev, t = neu(grace_s=0.5)
    t.claim("staff")
    for i in range(30):                                              # 30 Abschnitte a 10 s Ton = 5 Minuten Vortrag
        t.expect_playback(i, "gast:1", 10.0)
    for i in range(29):
        t.playback_done(i, "gast:1")                                 # bis auf den letzten quittiert
    t.end_speaking("staff")
    assert t.state == WIEDERGABE
    u.t += 60; t.tick()                                              # offen sind nur noch 10 s Ton (+ 8 s Reserve)
    assert t.state == FREI, "haengendes Geraet blockiert noch ~5 Minuten statt ~18 s"


# ---------------------------------------------------------------- Pruefungen ohne Befund (Gegenprobe)
def test_take_over_in_allen_zustaenden_bereinigt_awaiting_fuer_mitarbeiter():
    for prep in ("spricht", "uebersetzt", "wiedergabe"):
        u, ev, t = neu(grace_s=0.5)
        t.claim("gast:1")
        t.expect_playback(1, "staff", 3.0)
        t.segment_started()
        if prep != "spricht":
            t.end_speaking("gast:1")
        if prep == "wiedergabe":
            t.segment_done()
            assert t.state == WIEDERGABE
        ok, prev = t.take_over("staff")
        assert ok and prev == "gast:1" and t.who == "staff" and t.state == SPRICHT
        assert not any(d == "staff" for _, d in t.awaiting)


# ---------------------------------------------------------------- Aussagenummer, Wortmeldung, Runden
def test_verspaeteter_abschluss_einer_frueheren_aussage_beendet_die_neue_nicht():
    u, ev, t = neu(grace_s=0.5)
    assert t.claim("gast:1")[0]; alt = t.utterance                   # Aussage 1 des Gastes
    t.release()
    assert t.claim("gast:1")[0] and t.utterance != alt               # Aussage 2 desselben Gastes
    t.end_speaking("gast:1", alt)                                    # Abschluss der Aussage 1 kommt zu spaet
    assert t.state == SPRICHT, "die neue Aussage darf nicht beendet werden"
    t.end_speaking("gast:1", t.utterance)
    assert t.state != SPRICHT                                        # die richtige Nummer beendet sie


def test_wortmeldung_zurueckgenommen_waehrend_das_wort_uebergeben_wird_gibt_es_sofort_zurueck():
    u, ev, t = neu(grace_s=0.5, pickup_s=30)
    t.claim("staff"); assert t.request("gast:1") == "vorgemerkt"
    t.end_speaking("staff"); u.t += 0.6; t.tick()                    # alles fertig: gast:1 bekommt das Wort automatisch
    assert t.state == SPRICHT and t.who == "gast:1"
    t.cancel_request("gast:1")                                       # "want off" kommt zu spaet an: nicht 30 s blockieren
    assert t.state in (UEBERSETZT, WIEDERGABE)
    u.t += 0.6; t.tick()
    assert t.state == FREI


def test_haltemarke_haelt_die_sperre_bis_der_rest_verarbeitet_ist():
    """Gast spricht (Haltemarke), Mitarbeiter uebernimmt und ist sofort fertig: die Sperre geht erst weiter, wenn die Marke frei ist."""
    u, ev, t = neu(grace_s=0.5)
    t.claim("gast:1"); marke = t.segment_started()
    ok, prev = t.take_over("staff"); assert ok and prev == "gast:1"
    t.end_speaking("staff")
    assert t.state == UEBERSETZT and t.pending == 1
    u.t += 5; t.tick()
    assert t.state == UEBERSETZT                                     # kein Zeitablauf, solange nicht process_max_s
    t.segment_done(marke)
    assert t.state == WIEDERGABE


def test_neue_ausgabe_nach_dem_wechsel_nimmt_die_schonfrist_zurueck():
    u, ev, t = neu(grace_s=0.5)
    t.claim("staff"); t.end_speaking("staff")
    assert t.state == WIEDERGABE and t._free_at is not None
    t.expect_playback(5, "staff", 2.0)
    u.t += 0.6; t.tick()
    assert t.state == WIEDERGABE                                     # noch ein "fertig" offen
    t.playback_done(5, "staff"); u.t += 0.6; t.tick()
    assert t.state == FREI

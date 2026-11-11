import pytest

from app.pipeline.base import AsrSegment
from app.pipeline.segmenter import Segmenter, ends_sentence


def seg(text, final=True, t_in=100, t_asr=200):
    return AsrSegment(text, final, t_in, t_asr)


@pytest.mark.parametrize("wort,erwartet", [
    ("Ende.", True), ("Wirklich?", True), ("Halt!", True), ("so...", True), ("Haus", False),
    ("z.", False), ("z.B.", False), ("bzw.", False), ("3.", False), ("31.", False), ("2024.", True), ("Nr.", False),
    ('"Ende."', True), ("Satz.)", True), ("Komma,", False), ("", False),
])
def test_satzende(wort, erwartet):
    assert ends_sentence(wort) is erwartet


def test_schnitt_am_satzende():
    s = Segmenter(12)
    out = s.push(seg("Das ist ein Satz. Und noch einer! Offen"))
    assert [o.text for o in out] == ["Das ist ein Satz.", "Und noch einer!"]
    assert [o.text for o in s.flush()] == ["Offen"] and s.flush() == []


def test_schnitt_nach_n_woertern_bevorzugt_am_komma():
    out = Segmenter(6).push(seg("eins zwei drei, vier fuenf sechs sieben"))
    assert out[0].text == "eins zwei drei, vier fuenf sechs"        # Komma in der ersten Haelfte: harter Schnitt
    s = Segmenter(6)
    out = s.push(seg("eins zwei drei vier fuenf, sechs sieben acht"))
    assert out[0].text == "eins zwei drei vier fuenf,"          # Komma in der zweiten Haelfte
    assert [o.text for o in s.flush()] == ["sechs sieben acht"]


def test_ohne_komma_harter_schnitt():
    out = Segmenter(3).push(seg("a b c d e f g"))
    assert [o.text for o in out] == ["a b c", "d e f"]


def test_teilergebnisse_werden_ignoriert():
    s = Segmenter(12)
    assert s.push(seg("noch unsicher.", final=False)) == [] and s.flush() == []


def test_abkuerzung_und_ordnungszahl_trennen_nicht():
    out = Segmenter(30).push(seg("Wir treffen uns am 3. Mai, z. B. im Rathaus. Danach nicht."))
    assert [o.text for o in out] == ["Wir treffen uns am 3. Mai, z. B. im Rathaus.", "Danach nicht."]


def test_zeitstempel_stammen_von_den_beteiligten_woertern():
    s = Segmenter(12)
    assert s.push(AsrSegment("Das ist", True, 100, 150)) == []
    out = s.push(AsrSegment("ein Test.", True, 300, 380))
    assert out[0].t_audio_in == 100 and out[0].t_asr == 380 and out[0].final


def test_max_words_pruefung():
    with pytest.raises(ValueError):
        Segmenter(0)

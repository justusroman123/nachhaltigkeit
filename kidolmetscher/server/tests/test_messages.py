import json

import pytest

from app.messages import (STAGE_FIELDS, MessageError, Timestamps, TranslationMessage,
                          AudioPayload, control_message, now_ms)


def ts(**kw):
    base = dict(t_audio_in=100, t_asr=200, t_mt=300, t_tts=400, t_out=450)
    base.update(kw)
    return Timestamps(**base)


def msg(**kw):
    base = dict(seq=0, lang="uk", text="[uk] Hallo", text_src="Hallo", t=ts())
    base.update(kw)
    return TranslationMessage(**base)


def test_nachricht_traegt_alle_fuenf_zeitstempel():
    d = msg().to_dict()
    assert tuple(d["t"]) == STAGE_FIELDS
    assert all(isinstance(v, int) for v in d["t"].values())


def test_zeitstempel_in_millisekunden_aktuell():
    a = now_ms()
    assert 1_600_000_000_000 < a < 4_000_000_000_000   # plausibel als ms seit 1970


def test_tts_aus_gibt_null_und_bleibt_gueltig():
    d = msg(t=ts(t_tts=None)).to_dict()
    assert d["t"]["t_tts"] is None


@pytest.mark.parametrize("field", ["t_audio_in", "t_asr", "t_mt", "t_out"])
def test_pflichtzeitstempel_fehlt(field):
    with pytest.raises(MessageError):
        ts(**{field: None}).validate()


def test_nicht_monoton_wird_abgelehnt():
    with pytest.raises(MessageError):
        ts(t_mt=150).validate()
    with pytest.raises(MessageError):
        ts(t_tts=None, t_out=250).validate()   # t_out < t_mt


@pytest.mark.parametrize("bad", [-1, 1.5, "100", True])
def test_zeitstempel_typ(bad):
    with pytest.raises(MessageError):
        ts(t_asr=bad).validate()


def test_zuhoerer_bekommen_keinen_quelltext_operator_schon():
    m = msg()
    assert "text_src" not in m.to_dict(for_listener=True)
    assert m.to_dict(for_listener=False)["text_src"] == "Hallo"


def test_unbekannte_sprache_und_seq():
    with pytest.raises(MessageError):
        msg(lang="xx").to_dict()
    with pytest.raises(MessageError):
        msg(seq=-1).to_dict()


def test_audio_payload_und_json():
    d = msg(audio=AudioPayload(b"RIFFxxxx", 22050)).to_dict()
    assert d["audio"]["format"] == "wav" and d["audio"]["sample_rate"] == 22050
    json.dumps(d)     # muss serialisierbar sein
    assert d["v"] == 1 and d["type"] == "translation"


def test_deltas():
    d = ts().deltas()
    assert d == {"asr": 100, "mt": 100, "tts": 100, "out": 50, "total": 350}
    d = ts(t_tts=None).deltas()
    assert d["tts"] is None and d["out"] == 150


def test_control_message():
    assert control_message("ready", lang="uk") == {"type": "ready", "v": 1, "lang": "uk"}

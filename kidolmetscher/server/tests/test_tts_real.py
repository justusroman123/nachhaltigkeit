"""Echte Sprachausgabe (Piper): Logik mit Attrappen-Modul, optional Lauf mit echten Stimmen."""
import asyncio
import io
import os
import sys
import types
import wave
from pathlib import Path

import pytest

from app.config import ConfigError, parse_tts_voices
from app.pipeline import build_pipeline
from app.pipeline.tts_real import RealTts
from conftest import make_settings


def run(coro):
    return asyncio.run(coro)


class FakeVoice:
    """Ersatz fuer piper.PiperVoice: schreibt einen kurzen Ton, merkt sich den Text."""
    calls: list = []

    @classmethod
    def load(cls, path):
        return cls()

    def synthesize_wav(self, text, wf, syn_config=None):
        FakeVoice.calls.append((text, getattr(syn_config, "speaker_id", None)))
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(22050)
        wf.writeframes(b"\x00\x01" * 2205)


class FakeSynthesisConfig:
    def __init__(self, speaker_id=None):
        self.speaker_id = speaker_id


@pytest.fixture
def fake_piper(monkeypatch):
    FakeVoice.calls = []
    mod = types.ModuleType("piper")
    mod.PiperVoice = FakeVoice
    mod.SynthesisConfig = FakeSynthesisConfig
    monkeypatch.setitem(sys.modules, "piper", mod)


@pytest.fixture
def voice_dir(tmp_path):
    for n in ("uk_UA-ukrainian_tts-medium", "en_GB-alba-medium"):
        (tmp_path / f"{n}.onnx").write_bytes(b"x")
    return tmp_path


def settings_for(voice_dir, voices="uk=uk_UA-ukrainian_tts-medium:1,en=en_GB-alba-medium"):
    return make_settings(tts_backend="real", tts_voice_dir=str(voice_dir), tts_voices=voices)


def test_voices_parsen():
    assert parse_tts_voices("") == {}
    assert parse_tts_voices("uk=a-b_c:2, en=x.y") == {"uk": ("a-b_c", 2), "en": ("x.y", None)}


@pytest.mark.parametrize("raw", ["uk", "xx=voice", "uk=a/b", "uk=../x", "uk=a:b", "uk=a:-1", "uk="])
def test_voices_ungueltig(raw):
    with pytest.raises(ConfigError):
        parse_tts_voices(raw)


def test_fabrik_liefert_realtts_und_ungueltige_stimmen_werden_in_settings_abgelehnt():
    assert isinstance(build_pipeline(make_settings(tts_backend="real")).tts, RealTts)
    with pytest.raises(ConfigError):
        make_settings(tts_voices="kaputt").validate()


def test_load_ohne_konfiguration_und_ohne_dateien(tmp_path, fake_piper):
    with pytest.raises(ConfigError, match="TTS_VOICES"):
        run(RealTts(make_settings(tts_backend="real")).load())
    with pytest.raises(ConfigError, match="nicht gefunden"):
        run(RealTts(settings_for(tmp_path)).load())


def test_load_ohne_piper_paket(voice_dir, monkeypatch):
    monkeypatch.setitem(sys.modules, "piper", None)          # Import schlaegt fehl
    with pytest.raises(ConfigError, match="piper-tts"):
        run(RealTts(settings_for(voice_dir)).load())


def test_synthese_wav_sprecher_kleinschreibung_und_fehlende_sprache(voice_dir, fake_piper):
    async def go():
        t = RealTts(settings_for(voice_dir))
        await t.load()
        assert set(t.languages) == {"uk", "en"}
        uk = await t.synthesize("Привіт Світ", "uk")
        en = await t.synthesize("Hello World", "en")
        return uk, en, await t.synthesize("مرحبا", "ar"), await t.synthesize("   ", "en")
    uk, en, ar, leer = run(go())
    assert FakeVoice.calls == [("привіт світ", 1), ("Hello World", None)]    # nur ukrainian_tts wird klein geschrieben
    assert ar is None and leer is None                                         # keine Stimme / kein Text
    for res in (uk, en):
        assert res.fmt == "wav" and res.sample_rate == 22050
        with wave.open(io.BytesIO(res.audio)) as w:
            assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 22050)


def test_synthese_schreibt_keine_dateien(voice_dir, fake_piper):
    before = set(voice_dir.rglob("*"))
    async def go():
        t = RealTts(settings_for(voice_dir))
        await t.load()
        await asyncio.gather(*(t.synthesize(f"Satz {i}", "en") for i in range(4)))
    run(go())
    assert set(voice_dir.rglob("*")) == before


VOICES_DIR = os.environ.get("TTS_TEST_VOICE_DIR")


@pytest.mark.skipif(not VOICES_DIR or not Path(VOICES_DIR, "en_GB-alba-medium.onnx").is_file(),
                    reason="echte Stimmen: TTS_TEST_VOICE_DIR mit en_GB-alba-medium.onnx setzen (und pip install piper-tts)")
def test_echte_stimme_liefert_hoerbares_audio():
    async def go():
        t = RealTts(settings_for(VOICES_DIR, "en=en_GB-alba-medium"))
        await t.load()
        return await t.synthesize("Welcome to the demonstration.", "en")
    res = run(go())
    with wave.open(io.BytesIO(res.audio)) as w:
        seconds = w.getnframes() / w.getframerate()
        samples = w.readframes(w.getnframes())
    assert 1.0 < seconds < 6.0 and any(b for b in samples)


def test_gesamtsystem_mit_echter_sprachausgabe_ohne_stimme_nur_untertitel(voice_dir, fake_piper):
    """ASR/MT als Attrappe, TTS "real" (Attrappen-Piper): Sprache mit Stimme bekommt Ton, ohne Stimme nur Text."""
    from conftest import app_client, chunk
    from test_api import new_link, new_room, open_listener, open_operator, token_of
    with app_client(settings_for(voice_dir)) as c:
        rid = new_room(c)
        uk = open_listener(c, token_of(new_link(c, rid, "uk")))
        ar = open_listener(c, token_of(new_link(c, rid, "ar")))
        uk.receive_json(), ar.receive_json()
        op = open_operator(c, rid)
        op.send_bytes(chunk(100)); op.send_bytes(chunk(100))
        m_uk, m_ar = uk.receive_json(), ar.receive_json()
    assert m_uk["audio"]["format"] == "wav" and m_uk["audio"]["data_b64"]
    assert m_ar["audio"] is None and m_ar["text"].startswith("[ar]")
    t = m_uk["t"]
    assert t["t_audio_in"] <= t["t_asr"] <= t["t_mt"] <= t["t_tts"] <= t["t_out"]

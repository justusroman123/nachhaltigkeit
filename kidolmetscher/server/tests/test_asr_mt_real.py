"""Echte Stufen Spracherkennung (faster-whisper) und Uebersetzung (Transformers): Logik mit Attrappen,
optional ein Lauf mit echten kleinen Modellen (ASR_TEST_MODEL_DIR / MT_TEST_MODEL_DIR, sonst uebersprungen)."""
import asyncio
import os
import struct
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.config import ConfigError
from app.pipeline.asr_real import RealAsr, pcm16_rms
from app.pipeline.base import AudioChunk
from app.pipeline.mt_real import RealMt
from conftest import make_settings


def run(coro):
    return asyncio.run(coro)


def block(ms=50, amp=0, rate=16000):
    n = rate * ms // 1000
    return struct.pack("<h", amp) * n


def asr_with_fake_model(**kw):
    """RealAsr mit Attrappen-Modell: merkt sich die Laenge des erkannten Audios und gibt festen Text zurueck."""
    import numpy as np
    s = make_settings(asr_backend="real", asr_silence_ms=300, asr_max_utterance_s=2, asr_min_speech_ms=100, asr_vad_rms=400, **kw)
    a = RealAsr(s)
    a._np, a._lock = np, asyncio.Lock()
    a.calls = []

    class Model:
        def transcribe(self, audio, **opts):
            a.calls.append((len(audio) / 16000, opts))
            return iter([SimpleNamespace(text=" Hallo"), SimpleNamespace(text=" Welt ")]), None
    a._model = Model()
    return a


async def feed_all(stream, blocks, t0=1000):
    out, t = [], t0
    for b in blocks:
        out += await stream.feed(AudioChunk(b, 16000, t))
        t += 50
    return out


def test_rms():
    assert pcm16_rms(b"") == 0.0
    assert pcm16_rms(block(amp=1000)) == pytest.approx(1000)


def test_abschnitt_nach_pause_mit_vorlauf_und_zeitstempeln():
    async def go():
        a = asr_with_fake_model()
        st = a.new_stream()
        quiet = [block() for _ in range(6)]                       # 300 ms Stille vorab
        talk = [block(amp=3000) for _ in range(10)]               # 500 ms Sprache
        pause = [block() for _ in range(6)]                       # 300 ms Pause -> Abschluss
        segs = await feed_all(st, quiet + talk + pause)
        return a, segs
    a, segs = run(go())
    assert len(segs) == 1 and segs[0].text == "Hallo Welt" and segs[0].final
    assert segs[0].t_audio_in == 1000 + 6 * 50                    # erster lauter Block
    assert segs[0].t_asr >= segs[0].t_audio_in
    dauer, opts = a.calls[0]
    assert dauer == pytest.approx(0.2 + 0.5 + 0.3)               # 200 ms Vorlauf + Sprache + Pause
    assert opts["language"] == "de" and opts["vad_filter"] is True and opts["condition_on_previous_text"] is False


def test_kurzes_geraeusch_und_stille_werden_verworfen():
    async def go():
        a = asr_with_fake_model()
        st = a.new_stream()
        segs = await feed_all(st, [block() for _ in range(20)] + [block(amp=3000)] + [block() for _ in range(8)])
        segs += await st.flush()
        return a, segs
    a, segs = run(go())
    assert segs == [] and a.calls == []                          # 50 ms Sprache < ASR_MIN_SPEECH_MS=100


def test_hoechstdauer_schliesst_abschnitt_ohne_pause():
    async def go():
        a = asr_with_fake_model()
        segs = await feed_all(a.new_stream(), [block(amp=3000) for _ in range(45)])      # 2,25 s durchgehend
        return a, segs
    a, segs = run(go())
    assert len(segs) == 1 and a.calls[0][0] == pytest.approx(2.0)


def test_flush_und_close_loeschen_puffer():
    async def go():
        a = asr_with_fake_model()
        st = a.new_stream()
        await feed_all(st, [block(amp=3000) for _ in range(5)])
        segs = await st.flush()
        again = await st.flush()
        await feed_all(st, [block(amp=3000) for _ in range(5)])
        await st.close()
        return segs, again, await st.flush(), st
    segs, again, after_close, st = run(go())
    assert len(segs) == 1 and again == [] and after_close == [] and st._buf == []


def test_streams_mehrerer_raeume_sind_getrennt():
    async def go():
        a = asr_with_fake_model()
        s1, s2 = a.new_stream(), a.new_stream()
        await feed_all(s1, [block(amp=3000) for _ in range(5)])
        return await s2.flush(), await s1.flush()
    leer, text = run(go())
    assert leer == [] and len(text) == 1


def test_asr_ohne_paket_und_ohne_load(monkeypatch):
    s = make_settings(asr_backend="real")
    with pytest.raises(ConfigError, match="load"):
        RealAsr(s).new_stream()
    monkeypatch.setitem(sys.modules, "faster_whisper", None)
    with pytest.raises(ConfigError, match="faster-whisper"):
        run(RealAsr(s).load())


def test_mt_konfiguration_und_schutz(monkeypatch):
    with pytest.raises(ConfigError, match="MT_MODEL_ID"):
        run(RealMt(make_settings(mt_backend="real")).load())
    monkeypatch.setitem(sys.modules, "torch", None)
    with pytest.raises(ConfigError, match="torch"):
        run(RealMt(make_settings(mt_backend="real", mt_model_id="x")).load())
    mt = RealMt(make_settings(mt_backend="real", mt_model_id="x"))
    mt._model, mt._lock = object(), asyncio.Lock()
    mt._run = lambda text, src, tgt: f"{src}>{tgt}:{text}"                   # Attrappe fuer die Modellrechnung
    assert run(mt.translate("   ", "de", "en")) == ""
    assert run(mt.translate("Hallo", "de", "uk")) == "de>uk:Hallo"
    with pytest.raises(ValueError):
        run(mt.translate("Hallo", "de", "xx"))


@pytest.mark.parametrize("name", ["ASR_DEVICE", "MT_DEVICE", "MT_DTYPE"])
def test_config_pruefung_neuer_einstellungen(name):
    from app.config import Settings
    with pytest.raises(ConfigError):
        Settings.from_env({"OPERATOR_KEY": "0123456789abcdef0123", name: "quatsch"})
    with pytest.raises(ConfigError):
        Settings.from_env({"OPERATOR_KEY": "0123456789abcdef0123", "ASR_SILENCE_MS": "5"})


ASR_DIR, MT_DIR = os.environ.get("ASR_TEST_MODEL_DIR"), os.environ.get("MT_TEST_MODEL_DIR")


@pytest.mark.skipif(not ASR_DIR or not Path(ASR_DIR, "model.bin").is_file(),
                    reason="ASR_TEST_MODEL_DIR (faster-whisper-Ordner, z. B. tiny) setzen")
def test_echtes_asr_modell_laedt_und_verarbeitet_stille():
    async def go():
        a = RealAsr(make_settings(asr_backend="real", asr_model=ASR_DIR, asr_device="cpu", asr_compute_type="int8"))
        await a.load()
        st = a.new_stream()
        segs = await feed_all(st, [block() for _ in range(40)])
        return segs + await st.flush()
    assert run(go()) == []                                       # reine Stille ergibt keinen Text


@pytest.mark.skipif(not MT_DIR or not Path(MT_DIR, "config.json").is_file(),
                    reason="MT_TEST_MODEL_DIR (kleines Chat-Modell als Ordner) setzen")
def test_echtes_mt_modell_liefert_text():
    async def go():
        m = RealMt(make_settings(mt_backend="real", mt_model_id=MT_DIR, mt_device="cpu", mt_dtype="float32",
                                 mt_max_new_tokens=30))
        await m.load()
        return await m.translate("Der Vortrag beginnt in fünf Minuten.", "de", "en")
    assert run(go()).strip()

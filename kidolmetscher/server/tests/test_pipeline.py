import asyncio
import io
import wave

import pytest

from app.config import Settings
from app.messages import AudioPayload
from app.orchestrator import Orchestrator
from app.pipeline import build_pipeline
from app.pipeline.asr_mock import MockAsr
from app.pipeline.asr_real import RealAsr
from app.pipeline.base import AsrStage, AsrStream, AudioChunk, MtStage, TtsStage
from app.pipeline.mt_mock import MockMt
from app.pipeline.mt_real import RealMt
from app.pipeline.tts_mock import MockTts
from app.pipeline.tts_real import RealTts
from app.rooms import RoomManager
from conftest import FakeClock, chunk, make_settings


def run(coro):
    return asyncio.run(coro)


def test_mock_und_real_erfuellen_dieselbe_schnittstelle():
    s = Settings()
    for asr in (MockAsr(), RealAsr(s)):
        assert isinstance(asr, AsrStage)
    assert isinstance(MockAsr().new_stream(), AsrStream)
    for mt in (MockMt(), RealMt(s)):
        assert isinstance(mt, MtStage)
    for tts in (MockTts(), RealTts(s)):
        assert isinstance(tts, TtsStage)


def test_fabrik_waehlt_nach_konfiguration():
    p = build_pipeline(make_settings())
    assert isinstance(p.asr, MockAsr) and isinstance(p.mt, MockMt) and isinstance(p.tts, MockTts)
    p = build_pipeline(make_settings(asr_backend="real", mt_backend="real", tts_backend="real"))
    assert isinstance(p.asr, RealAsr) and isinstance(p.mt, RealMt) and isinstance(p.tts, RealTts)


def test_echte_stufen_sind_nur_geruest():
    p = build_pipeline(make_settings(asr_backend="real", mt_backend="real", tts_backend="real"))
    for stage in (p.asr, p.mt, p.tts):
        with pytest.raises(NotImplementedError, match="TODO"):
            run(stage.load())
    with pytest.raises(NotImplementedError):
        run(p.mt.translate("a", "de", "uk"))


def test_mock_asr_segmentiert_nach_dauer():
    clock = FakeClock(5000)
    stream = MockAsr(segment_s=0.3, clock=lambda: int(clock())).new_stream()

    async def go():
        a = await stream.feed(AudioChunk(chunk(100), 16000, 111))
        b = await stream.feed(AudioChunk(chunk(100), 16000, 222))
        c = await stream.feed(AudioChunk(chunk(100), 16000, 333))
        return a, b, c

    a, b, c = run(go())
    assert a == [] and b == [] and len(c) == 1
    seg = c[0]
    assert seg.final and seg.t_audio_in == 111 and seg.t_asr == 5000 and "1" in seg.text


def test_mock_asr_flush_und_close_leeren_puffer():
    stream = MockAsr(segment_s=10).new_stream()

    async def go():
        await stream.feed(AudioChunk(chunk(100), 16000, 1))
        await stream.close()
        return await stream.flush()

    assert run(go()) == []


def test_mock_mt_und_tts():
    assert run(MockMt().translate("Hallo", "de", "tr")) == "[tr] Hallo"
    res = run(MockTts().synthesize("ein kurzer Satz", "uk"))
    with wave.open(io.BytesIO(res.audio)) as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2 and w.getframerate() == res.sample_rate
        assert w.getnframes() > 0


# ---- Orchestrator ----
def make_orch(settings, clock=None, langs=("uk", "en")):
    clock = clock or FakeClock(10_000)
    mgr = RoomManager(settings)
    room = mgr.create_room()
    listeners = {l: room.attach_listener(room.create_listener_token(l)[0]) for l in langs}
    tick = {"t": 10_000}

    def ms():                       # jeder Aufruf +5 ms -> streng monotone Zeitstempel
        tick["t"] += 5
        return tick["t"]

    from app.pipeline.asr_mock import MockAsr as A
    p = build_pipeline(settings)
    p.asr = A(settings.mock_asr_segment_s, 0, ms)
    return Orchestrator(room, p, settings, clock=ms), room, listeners


def test_orchestrator_uebersetzt_nur_aktive_sprachen_mit_zeitstempeln(settings):
    orch, room, lst = make_orch(settings)

    async def go():
        out = []
        for _ in range(2):
            out += await orch.on_audio(chunk(100))
        return out

    msgs = run(go())
    assert sorted(m.lang for m in msgs) == ["en", "uk"]       # tr/ar haben keine Zuhoerer
    for m in msgs:
        t = m.t.to_dict()
        assert all(isinstance(v, int) for v in t.values())
        assert t["t_audio_in"] < t["t_asr"] < t["t_mt"] < t["t_tts"] < t["t_out"]
        assert m.audio is not None
    assert lst["uk"].queue.qsize() == 1 and lst["en"].queue.qsize() == 1
    assert msgs[0].seq == msgs[1].seq == 0
    assert room.counters["segments"] == 1 and room.counters["translations"] == 2


def test_orchestrator_ohne_zuhoerer_keine_uebersetzung(settings):
    orch, room, _ = make_orch(settings, langs=())
    msgs = run(orch.on_audio(chunk(300)))
    assert msgs == [] and room.counters["segments_no_listener"] == 1


def test_tts_aus(settings):
    s = make_settings(tts_enabled=False)
    orch, _, _ = make_orch(s, langs=("uk",))
    m = run(orch.on_audio(chunk(300)))[0]
    assert m.t.t_tts is None and m.audio is None
    m.t.validate()


def test_keine_inhalte_in_logs(settings, caplog):
    import logging
    caplog.set_level(logging.DEBUG)
    orch, _, _ = make_orch(settings, langs=("uk",))
    msgs = run(orch.on_audio(chunk(300)))
    assert msgs and caplog.records
    log_text = "\n".join(r.getMessage() for r in caplog.records)
    assert msgs[0].text not in log_text and msgs[0].text_src not in log_text
    assert "Testsatz" not in log_text and "gesamt_ms=" in log_text


def test_finish_leert_asr_puffer(settings):
    orch, _, _ = make_orch(make_settings(mock_asr_segment_s=9), langs=("uk",))
    run(orch.on_audio(chunk(100)))
    out = run(orch.finish())
    assert len(out) == 1                      # Rest wurde ausgegeben
    assert run(orch._stream.flush()) == []    # und danach ist nichts mehr da

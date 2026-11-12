import asyncio
import io
import wave

import pytest

from app.config import ConfigError, Settings
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


def test_echte_stufen_ohne_konfiguration_sind_nicht_startbar_und_nutzbar():
    p = build_pipeline(make_settings(asr_backend="real", mt_backend="real", tts_backend="real"))
    with pytest.raises(ConfigError, match="MT_MODEL_ID"):
        run(p.mt.load())
    with pytest.raises(ConfigError, match="TTS_VOICES"):
        run(p.tts.load())
    with pytest.raises(ConfigError, match="load"):                 # ohne load() kein Stream / keine Uebersetzung
        p.asr.new_stream()
    with pytest.raises(ConfigError, match="load"):
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
def make_orch(settings, langs=("uk", "en"), asr=None, mt=None, tts=None, sink=None):
    mgr = RoomManager(settings)
    room = mgr.create_room()
    listeners = {l: room.attach_listener(room.create_listener_token(l)[0]) for l in langs}
    tick = {"t": 10_000}

    def ms():                       # jeder Aufruf +5 ms -> streng monotone Zeitstempel
        tick["t"] += 5
        return tick["t"]

    p = build_pipeline(settings)
    p.asr = asr or MockAsr(settings.mock_asr_segment_s, 0, ms)
    if mt:
        p.mt = mt
    if tts:
        p.tts = tts
    return Orchestrator(room, p, settings, clock=ms, sink=sink, collect=True), room, listeners


def feed(orch, n, ms=100):
    async def go():
        for _ in range(n):
            await orch.on_audio(chunk(ms))
        return await orch.drain()
    return run(go())


def test_orchestrator_uebersetzt_nur_aktive_sprachen_mit_zeitstempeln(settings):
    orch, room, lst = make_orch(settings)
    msgs = feed(orch, 2)
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
    assert feed(orch, 3) == [] and room.counters["segments_no_listener"] == 1


def test_tts_aus(settings):
    orch, _, _ = make_orch(make_settings(tts_enabled=False), langs=("uk",))
    m = feed(orch, 3)[0]
    assert m.t.t_tts is None and m.audio is None
    m.t.validate()


def test_keine_inhalte_in_logs(settings, caplog):
    import logging
    caplog.set_level(logging.DEBUG)
    orch, _, _ = make_orch(settings, langs=("uk",))
    msgs = feed(orch, 3)
    assert msgs and caplog.records
    log_text = "\n".join(r.getMessage() for r in caplog.records)
    assert msgs[0].text not in log_text and msgs[0].text_src not in log_text
    assert "Testsatz" not in log_text and "gesamt_ms=" in log_text


def test_finish_gibt_rest_aus_und_leert_puffer(settings):
    orch, room, _ = make_orch(make_settings(mock_asr_segment_s=9), langs=("uk",))

    async def go():
        await orch.on_audio(chunk(100))
        out = await orch.finish()
        return out, await orch._stream.flush()

    out, again = run(go())
    assert len(out) == 1 and again == []
    assert orch._workers == {} and orch._queues == {}          # Arbeiter beendet, nichts bleibt liegen


def test_segmentierung_zwischen_asr_und_uebersetzung():
    from app.pipeline.base import AsrSegment

    class WortAsr:
        """Liefert einen langen Text ohne Satzzeichen in einem Stueck."""
        async def load(self): ...
        def new_stream(self):
            class S:
                done = False
                async def feed(self, c):
                    if S.done:
                        return []
                    S.done = True
                    text = "eins zwei drei vier fuenf sechs sieben acht neun zehn elf zwoelf dreizehn vierzehn"
                    return [AsrSegment(text, True, c.t_audio_in, c.t_audio_in + 1), AsrSegment("halb", False, 1, 2)]
                async def flush(self): return []
                async def close(self): ...
            return S()

    orch, room, _ = make_orch(make_settings(segment_max_words=5), langs=("en",), asr=WortAsr())
    msgs = feed(orch, 1)
    assert [m.text_src for m in msgs] == ["eins zwei drei vier fuenf", "sechs sieben acht neun zehn",
                                           "elf zwoelf dreizehn vierzehn"][:2]
    assert room.counters["partials_skipped"] == 1


class _LangsamMt:
    """MT-Attrappe, deren Sprache 'uk' haengt, bis sie freigegeben wird."""
    def __init__(self):
        self.gate = asyncio.Event()
    async def load(self): ...
    async def translate(self, text, src, tgt):
        if tgt == "uk":
            await self.gate.wait()
        return f"[{tgt}] {text}"


def test_langsame_sprache_bremst_andere_nicht():
    s = make_settings(mock_asr_segment_s=0.1)
    mt = _LangsamMt()
    got = []

    async def sink(m):
        got.append(m.lang)

    orch, room, _ = make_orch(s, langs=("uk", "en"), mt=mt, sink=sink)

    async def go():
        for _ in range(3):
            await orch.on_audio(chunk(100))
        for _ in range(20):                    # Englisch muss fertig werden, waehrend Ukrainisch haengt
            await asyncio.sleep(0.01)
        en_waehrend = got.count("en")
        mt.gate.set()
        await orch.drain()
        return en_waehrend

    assert run(go()) == 3 and got.count("uk") == 3


def test_rueckstau_verwirft_aelteste_segmente_und_ton_entfaellt():
    s = make_settings(mock_asr_segment_s=0.1, lang_queue_max=2, tts_skip_backlog=1)
    mt = _LangsamMt()
    orch, room, _ = make_orch(s, langs=("uk",), mt=mt)

    async def go():
        for _ in range(6):                      # 6 Segmente, Warteschlange fasst 2, eines in Arbeit
            await orch.on_audio(chunk(100))
            await asyncio.sleep(0)
        mt.gate.set()
        return await orch.drain()

    msgs = run(go())
    assert room.counters["segments_dropped_backpressure"] >= 1
    assert len(msgs) < 6 and len(msgs) >= 2
    assert any(m.audio is None for m in msgs) and room.counters["audio_skipped_backpressure"] >= 1
    assert all(m.text for m in msgs)            # Untertitel kommen trotzdem


def test_pipeline_fehler_stoppt_den_arbeiter_nicht(settings):
    class KaputtMt:
        n = 0
        async def load(self): ...
        async def translate(self, text, src, tgt):
            KaputtMt.n += 1
            if KaputtMt.n == 1:
                raise RuntimeError("GEHEIMER INHALT")
            return "ok"

    orch, room, _ = make_orch(make_settings(mock_asr_segment_s=0.1), langs=("uk",), mt=KaputtMt())
    msgs = feed(orch, 3)
    assert len(msgs) == 2 and room.counters["pipeline_errors"] == 1

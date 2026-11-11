"""Verbindet ASR -> Segmentierer -> MT -> TTS fuer einen Raum und setzt die Zeitstempel (Regel 4).

Je Zielsprache gibt es eine eigene Warteschlange mit eigenem Arbeiter: Eine langsame Sprache
bremst die anderen nicht (Rueckstau-Regel aus dem Plan, Phase 3):
- ab TTS_SKIP_BACKLOG wartenden Segmenten entfaellt der Ton, die Untertitel kommen weiter;
- ueber LANG_QUEUE_MAX hinaus werden die aeltesten Segmente der Sprache verworfen (gezaehlt).
Geloggt werden nur Zaehler und Zeitdauern, nie Texte oder Audio (Regel 1).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable, Optional

from .config import Settings
from .messages import AudioPayload, Timestamps, TranslationMessage, now_ms
from .pipeline.base import AsrSegment, AudioChunk, Pipeline
from .pipeline.segmenter import Segmenter
from .rooms import Room

log = logging.getLogger("kidolmetscher.pipeline")

Sink = Callable[[TranslationMessage], Awaitable[None]]


class Orchestrator:
    def __init__(self, room: Room, pipeline: Pipeline, settings: Settings,
                 clock: Callable[[], int] = now_ms, sink: Optional[Sink] = None, collect: bool = False):
        self.room = room
        self.pipeline = pipeline
        self.settings = settings
        self._clock = clock
        self._sink = sink                     # z. B. Weitergabe an den Bedienplatz
        self._collect = collect               # nur fuer Tests: fertige Nachrichten sammeln
        self.messages: list[TranslationMessage] = []
        self._stream = pipeline.asr.new_stream()
        self._segmenter = Segmenter(settings.segment_max_words)
        self._queues: dict[str, asyncio.Queue] = {}
        self._workers: dict[str, asyncio.Task] = {}

    # ---------- Eingang ----------
    async def on_audio(self, pcm: bytes) -> None:
        chunk = AudioChunk(pcm=pcm, sample_rate=self.settings.sample_rate, t_audio_in=self._clock())
        self.room.counters["audio_chunks"] += 1
        self._enqueue(self._segment(await self._stream.feed(chunk)))

    async def finish(self) -> list[TranslationMessage]:
        """Rest ausgeben, Warteschlangen leeren, ASR-Puffer loeschen, Arbeiter beenden."""
        try:
            rest = self._segment(await self._stream.flush())
            rest += self._segmenter.flush()
            self._enqueue(rest)
            return await self.drain()
        finally:
            await self._stream.close()
            self._segmenter.reset()
            await self.aclose()

    async def drain(self) -> list[TranslationMessage]:
        """Wartet, bis alle Segmente verarbeitet sind (Tests, Sitzungsende)."""
        await asyncio.gather(*(q.join() for q in self._queues.values()))
        out, self.messages = self.messages, []
        return out

    def cancel_workers(self) -> None:
        """Synchron und ohne Warten: Arbeiter abbrechen, Puffer verwerfen (auch bei abgebrochenem Aufraeumen)."""
        for t in self._workers.values():
            t.cancel()
        self._workers.clear()
        self._queues.clear()
        self.messages.clear()

    async def aclose(self) -> None:
        for t in self._workers.values():
            t.cancel()
        await asyncio.gather(*self._workers.values(), return_exceptions=True)
        self._workers.clear()
        self._queues.clear()
        self.messages.clear()

    # ---------- intern ----------
    def _segment(self, asr_segments: list[AsrSegment]) -> list[AsrSegment]:
        out: list[AsrSegment] = []
        for seg in asr_segments:
            if not seg.final:
                self.room.counters["partials_skipped"] += 1
                continue
            out += self._segmenter.push(seg)
        return out

    def _enqueue(self, segments: list[AsrSegment]) -> None:
        for seg in segments:
            self.room.counters["segments"] += 1
            langs = self.room.active_languages()
            if not langs:
                self.room.counters["segments_no_listener"] += 1
                continue
            seq = self.room.next_seq()
            for lang in langs:
                q = self._queue(lang)
                if q.full():                       # Rueckstau: aeltestes Segment dieser Sprache verwerfen
                    q.get_nowait()
                    q.task_done()
                    self.room.counters["segments_dropped_backpressure"] += 1
                q.put_nowait((seq, seg))

    def _queue(self, lang: str) -> asyncio.Queue:
        if lang not in self._queues:
            self._queues[lang] = asyncio.Queue(self.settings.lang_queue_max)
            self._workers[lang] = asyncio.create_task(self._work(lang))
        return self._queues[lang]

    async def _work(self, lang: str) -> None:
        q = self._queues[lang]
        while True:
            seq, seg = await q.get()
            try:
                skip_audio = q.qsize() >= self.settings.tts_skip_backlog
                msg = await self._process(seq, seg, lang, skip_audio)
                if self._collect:
                    self.messages.append(msg)
                if self._sink is not None:
                    try:
                        await self._sink(msg)
                    except Exception:
                        self.room.counters["sink_errors"] += 1
            except asyncio.CancelledError:
                raise
            except Exception as exc:               # nie Inhalte loggen, nur den Typ
                self.room.counters["pipeline_errors"] += 1
                log.error("pipeline_fehler lang=%s typ=%s", lang, type(exc).__name__)
            finally:
                q.task_done()

    async def _process(self, seq: int, seg: AsrSegment, lang: str, skip_audio: bool) -> TranslationMessage:
        text = await self.pipeline.mt.translate(seg.text, self.settings.source_lang, lang)
        t_mt = self._clock()
        audio, t_tts = None, None
        if self.settings.tts_enabled and not skip_audio:
            res = await self.pipeline.tts.synthesize(text, lang)
            t_tts = self._clock()
            if res is not None:
                audio = AudioPayload(res.audio, res.sample_rate, res.fmt)
        elif self.settings.tts_enabled:
            self.room.counters["audio_skipped_backpressure"] += 1
        # t_out: unmittelbar vor der Verteilung (Netzwerk zum Client nicht enthalten)
        ts = Timestamps(seg.t_audio_in, seg.t_asr, t_mt, t_tts, self._clock())
        msg = TranslationMessage(seq=seq, lang=lang, text=text, text_src=seg.text, t=ts, audio=audio)
        delivered = self.room.publish(lang, msg.to_dict(for_listener=True))
        self.room.counters["translations"] += 1
        d = ts.deltas()
        log.info("seq=%d lang=%s empfaenger=%d asr_ms=%s mt_ms=%s tts_ms=%s out_ms=%s gesamt_ms=%s",
                 seq, lang, delivered, d["asr"], d["mt"], d["tts"], d["out"], d["total"])
        return msg

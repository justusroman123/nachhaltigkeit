"""Verbindet ASR -> MT -> TTS fuer einen Raum und setzt die Zeitstempel (Regel 4).

Geloggt werden nur Zaehler und Zeitdauern, nie Texte oder Audio (Regel 1).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Callable

from .config import Settings
from .messages import AudioPayload, Timestamps, TranslationMessage, now_ms
from .pipeline.base import AsrSegment, AudioChunk, Pipeline
from .rooms import Room

log = logging.getLogger("kidolmetscher.pipeline")


class Orchestrator:
    def __init__(self, room: Room, pipeline: Pipeline, settings: Settings,
                 clock: Callable[[], int] = now_ms):
        self.room = room
        self.pipeline = pipeline
        self.settings = settings
        self._clock = clock
        self._stream = pipeline.asr.new_stream()

    async def on_audio(self, pcm: bytes) -> list[TranslationMessage]:
        chunk = AudioChunk(pcm=pcm, sample_rate=self.settings.sample_rate, t_audio_in=self._clock())
        self.room.counters["audio_chunks"] += 1
        return await self._handle(await self._stream.feed(chunk))

    async def finish(self) -> list[TranslationMessage]:
        """Rest ausgeben und ASR-Puffer loeschen."""
        try:
            return await self._handle(await self._stream.flush())
        finally:
            await self._stream.close()

    async def _handle(self, segments: list[AsrSegment]) -> list[TranslationMessage]:
        out: list[TranslationMessage] = []
        for seg in segments:
            if not seg.final:
                self.room.counters["partials_skipped"] += 1
                continue
            self.room.counters["segments"] += 1
            langs = self.room.active_languages()
            if not langs:
                self.room.counters["segments_no_listener"] += 1
                continue
            seq = self.room.next_seq()
            out.extend(await asyncio.gather(*(self._one(seq, seg, lang) for lang in langs)))
        return out

    async def _one(self, seq: int, seg: AsrSegment, lang: str) -> TranslationMessage:
        text = await self.pipeline.mt.translate(seg.text, self.settings.source_lang, lang)
        t_mt = self._clock()
        audio, t_tts = None, None
        if self.settings.tts_enabled:
            res = await self.pipeline.tts.synthesize(text, lang)
            t_tts = self._clock()
            if res is not None:
                audio = AudioPayload(res.audio, res.sample_rate, res.fmt)
        # t_out: unmittelbar vor der Verteilung (Netzwerk zum Client nicht enthalten)
        ts = Timestamps(seg.t_audio_in, seg.t_asr, t_mt, t_tts, self._clock())
        msg = TranslationMessage(seq=seq, lang=lang, text=text, text_src=seg.text, t=ts, audio=audio)
        delivered = self.room.publish(lang, msg.to_dict(for_listener=True))
        self.room.counters["translations"] += 1
        d = ts.deltas()
        log.info("seq=%d lang=%s empfaenger=%d asr_ms=%s mt_ms=%s tts_ms=%s out_ms=%s gesamt_ms=%s",
                 seq, lang, delivered, d["asr"], d["mt"], d["tts"], d["out"], d["total"])
        return msg

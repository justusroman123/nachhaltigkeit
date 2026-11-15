"""Gespraechsmodus, Richtung Gast -> Mitarbeiter: Sprache des Gastes erkennen, ins Deutsche uebersetzen, an den Bedienplatz
schicken. Alles nur im Arbeitsspeicher; es werden keine Inhalte protokolliert."""
from __future__ import annotations

import asyncio
import logging
from typing import Callable

from .config import Settings
from .messages import control_message, now_ms
from .pipeline.base import AudioChunk, Pipeline
from .rooms import Listener, Room

log = logging.getLogger("kidolmetscher")


class GuestPath:
    def __init__(self, room: Room, pipeline: Pipeline, settings: Settings, listener: Listener,
                 clock: Callable[[], int] = now_ms):
        self.room, self.pipeline, self.settings, self._clock = room, pipeline, settings, clock
        self.device = f"gast:{listener.id}"
        self.lang = listener.lang
        self._listener = listener
        self._stream = pipeline.asr.new_stream(self.lang)
        self._tasks: set[asyncio.Task] = set()
        self.open = False                       # es wurde Audio angenommen, Abschnitt noch nicht abgeschlossen

    async def on_audio(self, pcm: bytes) -> None:
        self.open = True
        chunk = AudioChunk(pcm=pcm, sample_rate=self.settings.sample_rate, t_audio_in=self._clock())
        self.room.counters["guest_audio_chunks"] += 1
        self._handle(await self._stream.feed(chunk))
        self._notice()

    async def finish(self) -> None:
        """Aussage beendet: offenen Abschnitt abschliessen und uebersetzen lassen."""
        if self.open:
            self.open = False
            self._handle(await self._stream.flush())
            self._notice()

    def _notice(self) -> None:
        """Nicht erkannte Aussage: dem Gast (und dem Mitarbeiter) sagen, dass er wiederholen soll."""
        n = getattr(self._stream, "pop_notice", lambda: None)()
        if n:
            self._listener.push(control_message("problem", what=n))
            self.room.push_operator(control_message("problem", what="gast_" + n))

    def _handle(self, segments) -> None:
        for seg in segments:
            if not seg.final:
                continue
            self.room.tracker.segment_started()
            task = asyncio.create_task(self._translate(seg))
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)

    async def _translate(self, seg) -> None:
        try:
            text = await self.pipeline.mt.translate(seg.text, self.lang, "de")
            t_mt = self._clock()
            self.room.push_operator(control_message(
                "guest_message", seq=self.room.next_seq(), from_lang=self.lang, text=text, text_src=seg.text,
                t={"t_audio_in": seg.t_audio_in, "t_asr": seg.t_asr, "t_mt": t_mt, "t_tts": None, "t_out": self._clock()}))
            self.room.counters["guest_messages"] += 1
        except Exception as exc:                # nie Inhalte loggen, nur den Typ
            self.room.counters["pipeline_errors"] += 1
            log.error("gast_pipeline_fehler typ=%s", self.settings.fehler(exc))
        finally:
            self.room.tracker.segment_done()

    async def close(self) -> None:
        for t in list(self._tasks):
            t.cancel()
        self._tasks.clear()
        await self._stream.close()

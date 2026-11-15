"""Gespraechsmodus, Richtung Gast -> Mitarbeiter: Sprache des Gastes erkennen, ins Deutsche uebersetzen, an den Bedienplatz
schicken. Alles nur im Arbeitsspeicher; es werden keine Inhalte protokolliert."""
from __future__ import annotations

import asyncio
import logging
from typing import Callable

from .config import Settings
from .messages import AudioPayload, control_message, now_ms
from .pipeline.base import AudioChunk, Pipeline
from .rooms import Listener, Room, _audio_seconds

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
            to = self.settings.stage_timeout_s
            text = await asyncio.wait_for(self.pipeline.mt.translate(seg.text, self.lang, "de"), to)
            t_mt = self._clock()
            audio, t_tts = None, None
            if self.settings.tts_enabled:                  # deutsche Stimme (falls eingerichtet): Mitarbeiter muss nicht aufs Geraet schauen
                try:
                    res = await asyncio.wait_for(self.pipeline.tts.synthesize(text, "de"), to)
                    t_tts = self._clock()
                    if res is not None:
                        audio = AudioPayload(res.audio, res.sample_rate, res.fmt).to_dict()
                except Exception as exc:
                    self.room.counters["tts_errors"] += 1
                    log.error("gast_tts_fehler typ=%s", self.settings.fehler(exc))
            seq = self.room.next_seq()
            msg = control_message(
                "guest_message", seq=seq, from_lang=self.lang, text=text, text_src=seg.text, audio=audio,
                t={"t_audio_in": seg.t_audio_in, "t_asr": seg.t_asr, "t_mt": t_mt, "t_tts": t_tts, "t_out": self._clock()})
            if audio:                                       # der Bedienplatz muss "fertig gesprochen" melden (Sperre wartet darauf)
                self.room.tracker.expect_playback(seq, "staff", _audio_seconds(msg))
            self.room.push_operator(msg)
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

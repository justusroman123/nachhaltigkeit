"""Gespraechsmodus, Richtung Gast -> Mitarbeiter: Sprache des Gastes erkennen, ins Deutsche uebersetzen, an den Bedienplatz
schicken. Alles nur im Arbeitsspeicher; es werden keine Inhalte protokolliert.

Grundsaetze (Gutachten): Nichts geht still verloren. Fehler der Erkennung oder Uebersetzung werden gemeldet (Bedienplatz und
Gast), ein offener Rest wird auch bei Verbindungsabbruch noch abgeschlossen und uebersetzt, und die Antworten kommen beim
Mitarbeiter in der Reihenfolge an, in der sie gesprochen wurden."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Callable, Optional

from .config import Settings
from .messages import AudioPayload, control_message, now_ms
from .pipeline.base import AudioChunk, Pipeline
from .rooms import Listener, Room, _audio_seconds
from .turns import SPRICHT

log = logging.getLogger("kidolmetscher")

PROBLEM_MIN_GAP_S = 5.0          # gleiche Fehlerart hoechstens alle 5 s melden (sonst Flut bei dauerhaftem Fehler); gezaehlt wird immer


class GuestPath:
    def __init__(self, room: Room, pipeline: Pipeline, settings: Settings, listener: Listener,
                 clock: Callable[[], int] = now_ms):
        self.room, self.pipeline, self.settings, self._clock = room, pipeline, settings, clock
        self.device = f"gast:{listener.id}"
        self.lang = listener.lang
        self._listener = listener
        self._stream = pipeline.asr.new_stream(self.lang)
        self._tasks: set[asyncio.Task] = set()
        self._lock = asyncio.Lock()             # Audio und Abschluss nie gleichzeitig in denselben Erkennungsstrom
        self._gate: Optional[asyncio.Event] = None      # Zustellreihenfolge: jede Antwort wartet auf die vorige
        self._hold: Optional[int] = None        # Marke der Sperre: bis der Rest der Aussage erkannt und uebersetzt ist, geht sie nicht weiter
        self._last_problem: dict[str, float] = {}
        self.open = False                       # es wurde Audio angenommen, Abschnitt noch nicht abgeschlossen

    # ---------- Sperre ----------
    @property
    def busy(self) -> bool:
        """Es steht noch etwas offen: Audio ohne Abschluss oder eine Haltemarke der Sperre."""
        return self.open or self._hold is not None

    def begin(self) -> None:
        """Der Gast hat das Wort: die Sperre darf erst weitergehen, wenn auch der Rest seiner Aussage verarbeitet ist
        (auch dann, wenn der Mitarbeiter ihn inzwischen gestoppt hat)."""
        if self._hold is None:
            self._hold = self.room.tracker.segment_started()

    def _release_hold(self) -> None:
        if self._hold is not None:
            token, self._hold = self._hold, None
            self.room.tracker.segment_done(token)

    # ---------- Fehler: melden, nie still verlieren ----------
    def _problem(self, what_operator: str, what_guest: str, exc: Optional[BaseException] = None) -> None:
        if exc is not None:
            self.room.counters["pipeline_errors"] += 1
            log.error("gast_pipeline_fehler was=%s typ=%s", what_operator, self.settings.fehler(exc))   # nie Inhalte, nur der Typ
        now = time.monotonic()
        if now - self._last_problem.get(what_operator, -1e9) < PROBLEM_MIN_GAP_S:
            return
        self._last_problem[what_operator] = now
        self.room.push_operator(control_message("problem", what=what_operator))
        self._listener.push(control_message("problem", what=what_guest))

    # ---------- Eingang ----------
    async def on_audio(self, pcm: bytes) -> None:
        async with self._lock:
            self.open = True
            try:
                chunk = AudioChunk(pcm=pcm, sample_rate=self.settings.sample_rate, t_audio_in=self._clock())
                self.room.counters["guest_audio_chunks"] += 1
                self._handle(await self._stream.feed(chunk))
                self._notice()
            except Exception as exc:
                self._problem("gast_spracherkennung", "spracherkennung", exc)

    async def finish(self) -> None:
        """Aussage beendet (Fertig, Stopp, Verbindung weg): offenen Abschnitt abschliessen und uebersetzen lassen; danach darf die Sperre weiter."""
        async with self._lock:
            try:
                if self.open:
                    self.open = False
                    self._handle(await self._stream.flush())
                    self._notice()
            except Exception as exc:
                self._problem("gast_spracherkennung", "spracherkennung", exc)
            finally:
                self._release_hold()                    # erst jetzt, nachdem die Abschnitte oben angemeldet sind

    def _notice(self) -> None:
        """Nicht erkannte Aussage: dem Gast (und dem Mitarbeiter) sagen, dass er wiederholen soll."""
        n = getattr(self._stream, "pop_notice", lambda: None)()
        if n:
            self._problem("gast_" + n, n)

    def _handle(self, segments) -> None:
        for seg in segments:
            if not seg.final:
                continue
            token = self.room.tracker.segment_started()
            prev, mine = self._gate, asyncio.Event()
            self._gate = mine
            task = asyncio.create_task(self._translate(seg, token, prev, mine))
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)

    def _staff_speaks(self) -> bool:
        return self.room.turns.state == SPRICHT and self.room.turns.who == "staff"

    async def _translate(self, seg, token: int, prev: Optional[asyncio.Event], mine: asyncio.Event) -> None:
        try:
            to = self.settings.stage_timeout_s
            text = await asyncio.wait_for(self.pipeline.mt.translate(seg.text, self.lang, "de"), to)
            t_mt = self._clock()
            audio, t_tts = None, None
            if self.settings.tts_enabled and not self._staff_speaks():     # deutsche Stimme (falls eingerichtet); nicht, wenn der Mitarbeiter gerade spricht (nur Text)
                try:
                    res = await asyncio.wait_for(self.pipeline.tts.synthesize(text, "de"), to)
                    t_tts = self._clock()
                    if res is not None:
                        audio = AudioPayload(res.audio, res.sample_rate, res.fmt).to_dict()
                except Exception as exc:
                    self.room.counters["tts_errors"] += 1
                    log.error("gast_tts_fehler typ=%s", self.settings.fehler(exc))
            if prev is not None:                                # Reihenfolge: erst zustellen, wenn die vorige Antwort zugestellt (oder gescheitert) ist
                await prev.wait()
            if audio and self._staff_speaks():                  # inzwischen spricht der Mitarbeiter: nur Text
                audio = None
            seq = self.room.next_seq()
            msg = control_message(
                "guest_message", seq=seq, from_lang=self.lang, text=text, text_src=seg.text, audio=audio,
                t={"t_audio_in": seg.t_audio_in, "t_asr": seg.t_asr, "t_mt": t_mt, "t_tts": t_tts, "t_out": self._clock()})
            if audio and self.room.operator_active:             # der Bedienplatz muss "fertig gesprochen" melden (Sperre wartet darauf)
                self.room.tracker.expect_playback(seq, "staff", _audio_seconds(msg))
            self.room.push_operator(msg)
            self.room.counters["guest_messages"] += 1
        except asyncio.CancelledError:
            raise
        except Exception as exc:                # nie Inhalte loggen, nur den Typ; der Satz ist verloren, das wird gemeldet
            self._problem("gast_uebersetzung", "uebersetzung", exc)
        finally:
            mine.set()
            self.room.tracker.segment_done(token)

    # ---------- Ende ----------
    async def shutdown(self, timeout: float) -> None:
        """Verbindung weg oder Sprachwechsel: den offenen Rest abschliessen und laufende Uebersetzungen abwarten (mit Frist),
        erst dann aufraeumen. Sonst ginge der letzte Satz der Aussage still verloren."""
        await self.finish()
        pending = {t for t in self._tasks if not t.done()}
        if pending:
            await asyncio.wait(pending, timeout=timeout)
        await self.close()

    async def close(self) -> None:
        for t in list(self._tasks):
            t.cancel()
        self._tasks.clear()
        self._release_hold()
        try:
            await self._stream.close()
        except Exception:
            pass

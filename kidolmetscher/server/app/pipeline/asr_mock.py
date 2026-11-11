"""ASR-Attrappe: erzeugt nach je N Sekunden Audio einen festen Testsatz.

Der Audioinhalt wird nicht ausgewertet und nicht gespeichert.
"""
from __future__ import annotations

import asyncio
from typing import Callable, Optional

from ..messages import now_ms
from .base import AsrSegment, AsrStream, AudioChunk


class MockAsrStream:
    def __init__(self, segment_s: float, delay_ms: int, clock: Callable[[], int]):
        self._segment_s = segment_s
        self._delay_ms = delay_ms
        self._clock = clock
        self._acc = 0.0
        self._first_in: Optional[int] = None
        self._n = 0

    def _emit(self) -> AsrSegment:
        self._n += 1
        seg = AsrSegment(text=f"Dies ist Testsatz Nummer {self._n} zur Probe.", final=True,
                         t_audio_in=self._first_in if self._first_in is not None else self._clock(),
                         t_asr=self._clock())
        self._acc, self._first_in = 0.0, None
        return seg

    async def feed(self, chunk: AudioChunk) -> list[AsrSegment]:
        if self._first_in is None:
            self._first_in = chunk.t_audio_in
        self._acc += chunk.duration_s
        if self._acc < self._segment_s:
            return []
        if self._delay_ms:
            await asyncio.sleep(self._delay_ms / 1000)
        return [self._emit()]

    async def flush(self) -> list[AsrSegment]:
        return [self._emit()] if self._acc > 0 else []

    async def close(self) -> None:
        self._acc, self._first_in = 0.0, None


class MockAsr:
    def __init__(self, segment_s: float = 2.0, delay_ms: int = 0,
                 clock: Callable[[], int] = now_ms):
        self._segment_s, self._delay_ms, self._clock = segment_s, delay_ms, clock

    async def load(self) -> None:
        return None

    def new_stream(self) -> AsrStream:
        return MockAsrStream(self._segment_s, self._delay_ms, self._clock)

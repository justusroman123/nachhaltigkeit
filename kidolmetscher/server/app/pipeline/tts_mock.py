"""TTS-Attrappe: kurzer Sinuston als WAV (Tonhoehe je Sprache), keine Sprache."""
from __future__ import annotations

import asyncio
import io
import math
import struct
import wave
from typing import Optional

from .base import TtsResult

_FREQ = {"uk": 440.0, "ar": 523.0, "en": 392.0, "tr": 349.0, "fa": 587.0}
RATE = 22050


def make_tone_wav(freq: float, seconds: float, rate: int = RATE) -> bytes:
    n = int(rate * seconds)
    fade = max(1, int(rate * 0.01))
    frames = bytearray()
    for i in range(n):
        env = min(1.0, i / fade, (n - i) / fade)
        frames += struct.pack("<h", int(9000 * env * math.sin(2 * math.pi * freq * i / rate)))
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(bytes(frames))
    return buf.getvalue()


class MockTts:
    def __init__(self, delay_ms: int = 0):
        self._delay_ms = delay_ms

    async def load(self) -> None:
        return None

    async def synthesize(self, text: str, lang: str) -> Optional[TtsResult]:
        if self._delay_ms:
            await asyncio.sleep(self._delay_ms / 1000)
        seconds = min(1.0, 0.1 + 0.02 * len(text.split()))
        return TtsResult(audio=make_tone_wav(_FREQ.get(lang, 440.0), seconds), sample_rate=RATE)

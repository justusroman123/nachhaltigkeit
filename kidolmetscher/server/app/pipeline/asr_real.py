"""Echte Spracherkennung mit faster-whisper (Whisper large-v3, MIT-Lizenz; Paket optional, nicht in requirements.txt).

Weg "pausenbasiert" (nicht SimulStreaming/WhisperLiveKit; Entscheidung E9 bleibt offen und ist auf der GPU zu messen):
Die Anwendung erkennt Sprechpausen an der Lautstaerke, sammelt je Raum den Abschnitt im Arbeitsspeicher und laesst
Whisper den fertigen Abschnitt erkennen. Die Verzoegerung ist damit Abschnittslaenge + Erkennungszeit (Messpunkt
t_asr - t_audio_in). Abschnitte werden nach ASR_MAX_UTTERANCE_S auch ohne Pause abgeschlossen.

- Audio nur im RAM, nie auf Platte; close() loescht den Puffer (Regel 1).
- Schwellen (ASR_SILENCE_MS, ASR_MAX_UTTERANCE_S, ASR_VAD_RMS) sind Annahmen, an echten Aufnahmen zu messen.
- Imports von numpy/faster_whisper erst in load().
"""
from __future__ import annotations

import asyncio
import math
from collections import deque
from typing import Any, Callable, Optional

from ..config import ConfigError, Settings
from ..messages import now_ms
from .base import AsrSegment, AsrStream, AudioChunk

PREROLL_MS = 200          # Audio vor dem ersten lauten Block, damit der Wortanfang nicht fehlt


def pcm16_rms(pcm: bytes) -> float:
    """Effektivwert eines PCM16-Blocks (ohne numpy, ein Block hat nur ca. 800 Werte)."""
    n = len(pcm) // 2
    if n == 0:
        return 0.0
    import array
    a = array.array("h")
    a.frombytes(pcm[: n * 2])
    return math.sqrt(sum(x * x for x in a) / n)


class RealAsrStream:
    def __init__(self, owner: "RealAsr", clock: Callable[[], int]):
        self._o = owner
        self._clock = clock
        self._pre: deque[AudioChunk] = deque()
        self._pre_ms = 0.0
        self._reset()

    def _reset(self) -> None:
        self._buf: list[bytes] = []
        self._rate = 16000
        self._speech_ms = 0.0
        self._silence_ms = 0.0
        self._total_ms = 0.0
        self._first_in: Optional[int] = None
        self._active = False

    async def _finish(self) -> list[AsrSegment]:
        pcm, first_in, speech_ms, rate = b"".join(self._buf), self._first_in, self._speech_ms, self._rate
        self._reset()
        if not pcm or speech_ms < self._o.settings.asr_min_speech_ms:
            return []
        text = await self._o.transcribe(pcm, rate)
        if not text:
            return []
        return [AsrSegment(text=text, final=True, t_audio_in=first_in if first_in is not None else self._clock(),
                           t_asr=self._clock())]

    async def feed(self, chunk: AudioChunk) -> list[AsrSegment]:
        s = self._o.settings
        ms = chunk.duration_s * 1000
        self._rate = chunk.sample_rate
        loud = pcm16_rms(chunk.pcm) >= s.asr_vad_rms
        if not self._active:
            if not loud:                                   # Stille: nur kurzen Vorlauf merken
                self._pre.append(chunk)
                self._pre_ms += ms
                while self._pre and self._pre_ms - self._pre[0].duration_s * 1000 >= PREROLL_MS:
                    self._pre_ms -= self._pre.popleft().duration_s * 1000
                return []
            self._active = True
            self._first_in = chunk.t_audio_in
            for c in self._pre:
                self._buf.append(c.pcm)
                self._total_ms += c.duration_s * 1000
            self._pre.clear()
            self._pre_ms = 0.0
        self._buf.append(chunk.pcm)
        self._total_ms += ms
        if loud:
            self._speech_ms += ms
            self._silence_ms = 0.0
        else:
            self._silence_ms += ms
        if self._silence_ms >= s.asr_silence_ms or self._total_ms >= s.asr_max_utterance_s * 1000:
            return await self._finish()
        return []

    async def flush(self) -> list[AsrSegment]:
        return await self._finish() if self._active else []

    async def close(self) -> None:
        self._reset()
        self._pre.clear()
        self._pre_ms = 0.0


class RealAsr:
    def __init__(self, settings: Settings, clock: Callable[[], int] = now_ms):
        self.settings = settings
        self._clock = clock
        self._model: Any = None
        self._np: Any = None
        self._lock: Optional[asyncio.Lock] = None

    async def load(self) -> None:
        try:
            import numpy
            from faster_whisper import WhisperModel          # optional, MIT
        except ImportError as exc:
            raise ConfigError('Paket "faster-whisper" ist nicht installiert (pip install -r requirements-asr.txt)') from exc
        s = self.settings
        self._np = numpy
        self._model = await asyncio.to_thread(
            lambda: WhisperModel(s.asr_model, device=s.asr_device, compute_type=s.asr_compute_type))
        self._lock = asyncio.Lock()

    def new_stream(self) -> AsrStream:
        if self._model is None:
            raise ConfigError("RealAsr.load() wurde nicht aufgerufen")
        return RealAsrStream(self, self._clock)

    def _run(self, pcm: bytes, rate: int) -> str:
        audio = self._np.frombuffer(pcm, dtype=self._np.int16).astype(self._np.float32) / 32768.0
        if rate != 16000:
            raise ValueError("ASR erwartet 16 kHz")
        segments, _ = self._model.transcribe(
            audio, language=self.settings.source_lang, beam_size=self.settings.asr_beam_size,
            vad_filter=True, condition_on_previous_text=False)
        return " ".join(seg.text.strip() for seg in segments).strip()

    async def transcribe(self, pcm: bytes, rate: int) -> str:
        assert self._lock is not None
        async with self._lock:                               # ein Modell, eine Erkennung gleichzeitig
            return await asyncio.to_thread(self._run, pcm, rate)

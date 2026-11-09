"""Schnittstellen der Pipeline-Stufen (Regel 3).

Jede Stufe hat eine Mock- und eine echte Implementierung. Modelle werden einmal
beim Serverstart geladen (load); ASR ist zusaetzlich pro Raum zustandsbehaftet
(new_stream), MT und TTS sind zustandslos.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol, runtime_checkable


@dataclass(frozen=True)
class AudioChunk:
    pcm: bytes                 # 16-Bit little-endian, mono
    sample_rate: int
    t_audio_in: int            # Server-Empfangszeit in ms

    @property
    def duration_s(self) -> float:
        return len(self.pcm) / 2 / self.sample_rate


@dataclass(frozen=True)
class AsrSegment:
    text: str
    final: bool
    t_audio_in: int            # Eingang des ersten Audios, das zum Segment beitrug
    t_asr: int                 # Zeitpunkt, an dem das Segment vorlag


@dataclass(frozen=True)
class TtsResult:
    audio: bytes
    sample_rate: int
    fmt: str = "wav"


@runtime_checkable
class AsrStream(Protocol):
    """Zustand einer laufenden Sitzung (Audio-Puffer)."""
    async def feed(self, chunk: AudioChunk) -> list[AsrSegment]: ...
    async def flush(self) -> list[AsrSegment]: ...
    async def close(self) -> None: ...        # Puffer loeschen


@runtime_checkable
class AsrStage(Protocol):
    async def load(self) -> None: ...
    def new_stream(self) -> AsrStream: ...


@runtime_checkable
class MtStage(Protocol):
    async def load(self) -> None: ...
    async def translate(self, text: str, src: str, tgt: str) -> str: ...


@runtime_checkable
class TtsStage(Protocol):
    async def load(self) -> None: ...
    async def synthesize(self, text: str, lang: str) -> Optional[TtsResult]: ...


@dataclass
class Pipeline:
    asr: AsrStage
    mt: MtStage
    tts: TtsStage

    async def load(self) -> None:
        await self.asr.load()
        await self.mt.load()
        await self.tts.load()

"""Echte Spracherkennung (Whisper large-v3 ueber SimulStreaming oder WhisperLiveKit).

STATUS: nur Geruest. Keine GPU-Abhaengigkeiten importieren (Imports erst in load()).

TODO (offen, siehe docs/entscheidungen.md):
- Entscheidung SimulStreaming vs. WhisperLiveKit (Lizenz, Latenz, Sprachwechsel) - unbekannt, messen.
- load(): Modell EINMAL laden (Name aus Settings.asr_model), Geraet cuda waehlen.
- new_stream(): pro Raum ein eigener Zustand; Audio nur im RAM, nie auf Platte.
- feed(): PCM16 mono 16 kHz annehmen, Teil-/Endergebnisse als AsrSegment liefern.
  t_audio_in = Eingang des ersten beteiligten Audios, t_asr = Zeitpunkt der Ausgabe.
- Nur Endergebnisse (final=True) werden uebersetzt; Teilergebnisse nur fuer Anzeige (spaeter).
- close(): Puffer und Zwischenzustand loeschen.
"""
from __future__ import annotations

from ..config import Settings
from .base import AsrSegment, AsrStream, AudioChunk


class RealAsrStream:
    async def feed(self, chunk: AudioChunk) -> list[AsrSegment]:
        raise NotImplementedError("TODO: Streaming-ASR anbinden")

    async def flush(self) -> list[AsrSegment]:
        raise NotImplementedError("TODO: Streaming-ASR anbinden")

    async def close(self) -> None:
        raise NotImplementedError("TODO: Puffer loeschen")


class RealAsr:
    def __init__(self, settings: Settings):
        self._model_name = settings.asr_model

    async def load(self) -> None:
        raise NotImplementedError("TODO: Whisper large-v3 laden (GPU-Server noetig)")

    def new_stream(self) -> AsrStream:
        raise NotImplementedError("TODO: Stream-Zustand je Raum anlegen")

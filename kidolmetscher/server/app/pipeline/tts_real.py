"""Echte Sprachausgabe mit Piper (Python-Paket "piper-tts", GPL-3.0; Stimmen mit eigener Lizenz).

- Stimmen je Zielsprache aus TTS_VOICES, Dateien <TTS_VOICE_DIR>/<stimme>.onnx (+ .onnx.json). Lizenz jeder Stimme
  vor Einsatz pruefen (docs/lizenzen-recherche.md). Sprache ohne Stimme: synthesize() liefert None (nur Untertitel).
- Audio nur im Arbeitsspeicher (WAV, 16 Bit mono), nie auf Platte (Regel 1).
- Piper ist eine optionale Abhaengigkeit: Import erst in load(), nicht in requirements.txt.
- Piper rechnet auf der CPU (onnxruntime); die Synthese laeuft in einem Thread, damit der Event-Loop frei bleibt.
"""
from __future__ import annotations

import asyncio
import io
import wave
from pathlib import Path
from typing import Any, Optional

from ..config import ConfigError, Settings, parse_tts_voices
from .base import TtsResult

# Diese Stimme kennt nur Kleinbuchstaben (sonst fehlen Laute); gilt fuer alle Stimmen mit diesem Namensteil.
LOWERCASE_VOICES = ("ukrainian_tts",)


class RealTts:
    def __init__(self, settings: Settings):
        self._voice_dir = Path(settings.tts_voice_dir) if settings.tts_voice_dir else None
        self._wanted = parse_tts_voices(settings.tts_voices)
        self._voices: dict[str, Any] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._syn_config: Any = None

    @property
    def languages(self) -> tuple[str, ...]:
        return tuple(self._voices)

    async def load(self) -> None:
        if self._voice_dir is None or not self._wanted:
            raise ConfigError("TTS_BACKEND=real braucht TTS_VOICE_DIR und TTS_VOICES "
                              "(z. B. uk=uk_UA-ukrainian_tts-medium:0,en=en_GB-alba-medium)")
        missing = [str(self._voice_dir / f"{v}.onnx") for v, _ in self._wanted.values()
                   if not (self._voice_dir / f"{v}.onnx").is_file()]
        if missing:
            raise ConfigError(f"Stimmen-Datei(en) nicht gefunden: {', '.join(missing)}")
        try:
            from piper import PiperVoice          # optional, GPL-3.0
        except ImportError as exc:
            raise ConfigError('Paket "piper-tts" ist nicht installiert (pip install piper-tts)') from exc
        try:
            from piper import SynthesisConfig
        except ImportError:                        # aeltere Versionen: nur Standardsprecher
            SynthesisConfig = None
        self._syn_config = SynthesisConfig
        loaded = await asyncio.to_thread(
            lambda: {lang: PiperVoice.load(str(self._voice_dir / f"{v}.onnx")) for lang, (v, _) in self._wanted.items()})
        self._voices = loaded
        self._locks = {lang: asyncio.Lock() for lang in loaded}

    def _render(self, text: str, lang: str) -> TtsResult:
        voice = self._voices[lang]
        name, speaker = self._wanted[lang]
        if any(x in name for x in LOWERCASE_VOICES):
            text = text.lower()
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            if speaker is not None and self._syn_config is not None:
                voice.synthesize_wav(text, wf, syn_config=self._syn_config(speaker_id=speaker))
            else:
                voice.synthesize_wav(text, wf)
        data = buf.getvalue()
        with wave.open(io.BytesIO(data), "rb") as r:
            rate = r.getframerate()
        return TtsResult(audio=data, sample_rate=rate)

    async def synthesize(self, text: str, lang: str) -> Optional[TtsResult]:
        if lang not in self._voices or not text.strip():
            return None
        async with self._locks[lang]:               # eine Synthese je Stimme gleichzeitig
            return await asyncio.to_thread(self._render, text, lang)

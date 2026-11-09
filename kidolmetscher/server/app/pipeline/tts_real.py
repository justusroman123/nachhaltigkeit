"""Echte Sprachausgabe (Piper; Lizenz noch offen).

STATUS: nur Geruest. Keine GPU-Abhaengigkeiten importieren (Imports erst in load()).

TODO:
- Lizenz von Piper-Paket UND jeder einzelnen Stimme pruefen (Regel/Lizenztabelle).
- Verfuegbarkeit von Stimmen fuer uk, ar, en, tr, fa: UNBEKANNT -> pruefen; Pfad aus TTS_VOICE_DIR.
- load(): Stimmen je Zielsprache laden.
- synthesize(): Text -> WAV (PCM16 mono) im RAM; Rueckgabe None, wenn Sprache keine Stimme hat.
- Keine Audiodateien auf Platte schreiben.
"""
from __future__ import annotations

from typing import Optional

from ..config import Settings
from .base import TtsResult


class RealTts:
    def __init__(self, settings: Settings):
        self._voice_dir = settings.tts_voice_dir

    async def load(self) -> None:
        raise NotImplementedError("TODO: Piper-Stimmen laden (TTS_VOICE_DIR setzen)")

    async def synthesize(self, text: str, lang: str) -> Optional[TtsResult]:
        raise NotImplementedError("TODO: Sprachsynthese aufrufen")

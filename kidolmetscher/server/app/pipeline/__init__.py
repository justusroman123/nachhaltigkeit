"""Pipeline-Fabrik: waehlt je Stufe Mock oder echte Implementierung aus der Konfiguration."""
from __future__ import annotations

from ..config import Settings
from .asr_mock import MockAsr
from .asr_real import RealAsr
from .base import AsrStage, MtStage, Pipeline, TtsStage
from .mt_mock import MockMt
from .mt_real import RealMt
from .tts_mock import MockTts
from .tts_real import RealTts


def build_pipeline(settings: Settings) -> Pipeline:
    asr: AsrStage = (MockAsr(settings.mock_asr_segment_s, settings.mock_delay_ms)
                     if settings.asr_backend == "mock" else RealAsr(settings))
    mt: MtStage = MockMt(settings.mock_delay_ms) if settings.mt_backend == "mock" else RealMt(settings)
    tts: TtsStage = MockTts(settings.mock_delay_ms) if settings.tts_backend == "mock" else RealTts(settings)
    return Pipeline(asr=asr, mt=mt, tts=tts)


__all__ = ["build_pipeline", "Pipeline"]

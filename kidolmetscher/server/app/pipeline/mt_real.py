"""Echte Uebersetzung (TranslateGemma 12B).

STATUS: nur Geruest. Keine GPU-Abhaengigkeiten importieren (Imports erst in load()).

TODO:
- Modell-ID kommt aus MT_MODEL_ID (unbekannt, nicht geraten). Lizenz/Nutzungsbedingungen pruefen.
- load(): Modell einmal laden; Laufzeit (z. B. Transformers, vLLM) offen - messen.
- translate(): de -> uk/ar/en/tr (fa optional). Unterstuetzung je Zielsprache ist UNBEKANNT -> testen.
- Mehrere Zielsprachen gleichzeitig: Batch pruefen (Messpunkt "mt" im Messprotokoll).
- Prompt: mt_prompt.build_prompt(src, tgt) (laut Plan belegt, Quelle Google-Blog/arXiv 2601.09012).
- Keine Texte loggen, keine Zwischenspeicherung.
"""
from __future__ import annotations

from ..config import Settings
from .mt_prompt import build_prompt   # empfohlener Prompt, z. B. build_prompt("de", "uk")


class RealMt:
    def __init__(self, settings: Settings):
        self._model_id = settings.mt_model_id

    async def load(self) -> None:
        raise NotImplementedError("TODO: TranslateGemma laden (MT_MODEL_ID setzen, GPU-Server noetig)")

    async def translate(self, text: str, src: str, tgt: str) -> str:
        raise NotImplementedError("TODO: Uebersetzung aufrufen")

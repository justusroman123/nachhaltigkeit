"""Echte Uebersetzung (TranslateGemma 12B ueber Transformers; Pakete optional, nicht in requirements.txt).

- Modell-ID oder lokaler Ordner aus MT_MODEL_ID (unbekannt, nicht geraten); Betrieb: lokaler Ordner, HF_HUB_OFFLINE=1.
- Format laut Modellkarte (Bericht aus dem Browser, 12.11.2026): eine Nutzer-Nachricht, content = Liste mit EINEM Eintrag
  {type: text, source_lang_code, target_lang_code, text}; geladen mit AutoProcessor und AutoModelForImageTextToText,
  Dekodierung ohne Sampling. Codes: ISO 639-1 oder mit Region (z. B. de-DE). Welche der Sprachen uk/ar/tr/fa/en wirklich
  unterstuetzt werden, steht nicht in der Karte (Fehler beim Template deutet auf einen nicht unterstuetzten Code).
- Modus "plain" (Plan-Prompt als Text) bleibt zum Vergleich und fuer Modelle ohne dieses Format.
- Greedy-Dekodierung, keine Zwischenspeicherung, keine Texte in Logs (Regel 1).
- Imports von torch/transformers erst in load(). Rechenzeit je Satz und Speicher: auf dem Server messen (bench_mt.py).
"""
from __future__ import annotations

import asyncio
from typing import Any, Optional

from ..config import ConfigError, Settings, parse_lang_codes
from .mt_prompt import build_prompt


class RealMt:
    def __init__(self, settings: Settings):
        self._s = settings
        self._model_id = settings.mt_model_id
        self._proc: Any = None
        self._model: Any = None
        self._torch: Any = None
        self._device = "cpu"
        self._lock: Optional[asyncio.Lock] = None
        self.prompt_mode = settings.mt_prompt_mode        # zur Laufzeit umschaltbar (Vergleich im Qualitaetslauf)
        self._codes = parse_lang_codes(settings.mt_lang_codes)

    async def load(self) -> None:
        if not self._model_id:
            raise ConfigError("MT_BACKEND=real braucht MT_MODEL_ID (Ordner oder Modell-ID; Wert ist unbekannt und nicht geraten)")
        try:
            import torch
            import transformers
            from transformers import AutoModelForCausalLM, AutoProcessor
        except ImportError as exc:
            raise ConfigError('Pakete "torch" und "transformers" fehlen (pip install -r requirements-mt.txt)') from exc
        s = self._s
        self._torch = torch
        self._device = ("cuda" if torch.cuda.is_available() else "cpu") if s.mt_device == "auto" else s.mt_device
        if self._device == "cuda" and not torch.cuda.is_available():
            raise ConfigError("MT_DEVICE=cuda, aber keine GPU verfuegbar")
        dtype = {"auto": "auto", "bfloat16": torch.bfloat16, "float16": torch.float16, "float32": torch.float32}[s.mt_dtype]

        def _load():
            proc = AutoProcessor.from_pretrained(self._model_id)      # faellt bei reinen Textmodellen auf den Tokenizer zurueck
            # device_map: Gewichte direkt aufs Geraet laden (nicht erst komplett in den Arbeitsspeicher; Team-Limit 8 GB RAM)
            try:                      # offizieller Weg laut Modellkarte
                model = transformers.AutoModelForImageTextToText.from_pretrained(
                    self._model_id, dtype=dtype, device_map=self._device)
            except (ValueError, KeyError):                            # reine Textmodelle (z. B. Ersatzmodell beim Testen)
                model = AutoModelForCausalLM.from_pretrained(self._model_id, dtype=dtype, device_map=self._device)
            model.eval()
            return proc, model
        self._proc, self._model = await asyncio.to_thread(_load)
        self._lock = asyncio.Lock()

    def build_messages(self, text: str, src: str, tgt: str) -> list:
        if self.prompt_mode == "structured":
            # Sprachcodes als Felder (Format der TranslateGemma-Modellkarte)
            return [{"role": "user", "content": [{"type": "text", "source_lang_code": self._codes.get(src, src),
                                                   "target_lang_code": self._codes.get(tgt, tgt), "text": text}]}]
        return [{"role": "user", "content": f"{build_prompt(src, tgt)}\n\n{text}"}]

    def _run(self, text: str, src: str, tgt: str) -> str:
        torch = self._torch
        messages = self.build_messages(text, src, tgt)
        inputs = self._proc.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_dict=True,
                                                return_tensors="pt").to(self._device)
        with torch.inference_mode():
            out = self._model.generate(**inputs, max_new_tokens=self._s.mt_max_new_tokens, do_sample=False)
        new = out[0][inputs["input_ids"].shape[1]:]
        return self._proc.decode(new, skip_special_tokens=True).strip()

    async def translate(self, text: str, src: str, tgt: str) -> str:
        if self._model is None or self._lock is None:
            raise ConfigError("RealMt.load() wurde nicht aufgerufen")
        if not text.strip():
            return ""
        build_prompt(src, tgt)                       # frueh pruefen: Sprache bekannt?
        async with self._lock:                       # ein Modell, eine Uebersetzung gleichzeitig
            return await asyncio.to_thread(self._run, text, src, tgt)

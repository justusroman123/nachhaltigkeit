"""Echte Uebersetzung (TranslateGemma 12B ueber Transformers; Pakete optional, nicht in requirements.txt).

- Modell-ID oder lokaler Ordner aus MT_MODEL_ID (unbekannt, nicht geraten); Betrieb: lokaler Ordner, HF_HUB_OFFLINE=1.
- Prompt laut Plan (mt_prompt.build_prompt), zusammen mit dem Text in EINER Nutzer-Nachricht (nicht als System-Rolle,
  weil Gemma-Vorlagen sie teils nicht kennen). OB das das offizielle TranslateGemma-Format ist, ist UNBEKANNT
  (Modellkarte gesperrt, nicht gelesen) -> auf dem Server mit dem Chat-Template des Modells pruefen.
- Greedy-Dekodierung, keine Zwischenspeicherung, keine Texte in Logs (Regel 1).
- Imports von torch/transformers erst in load(). Rechenzeit je Satz und Speicher: auf dem Server messen (bench_mt.py).
"""
from __future__ import annotations

import asyncio
from typing import Any, Optional

from ..config import ConfigError, Settings
from .mt_prompt import build_prompt


class RealMt:
    def __init__(self, settings: Settings):
        self._s = settings
        self._model_id = settings.mt_model_id
        self._tok: Any = None
        self._model: Any = None
        self._torch: Any = None
        self._device = "cpu"
        self._lock: Optional[asyncio.Lock] = None

    async def load(self) -> None:
        if not self._model_id:
            raise ConfigError("MT_BACKEND=real braucht MT_MODEL_ID (Ordner oder Modell-ID; Wert ist unbekannt und nicht geraten)")
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            raise ConfigError('Pakete "torch" und "transformers" fehlen (pip install -r requirements-mt.txt)') from exc
        s = self._s
        self._torch = torch
        self._device = ("cuda" if torch.cuda.is_available() else "cpu") if s.mt_device == "auto" else s.mt_device
        if self._device == "cuda" and not torch.cuda.is_available():
            raise ConfigError("MT_DEVICE=cuda, aber keine GPU verfuegbar")
        dtype = {"auto": "auto", "bfloat16": torch.bfloat16, "float16": torch.float16, "float32": torch.float32}[s.mt_dtype]

        def _load():
            tok = AutoTokenizer.from_pretrained(self._model_id)
            model = AutoModelForCausalLM.from_pretrained(self._model_id, dtype=dtype).to(self._device)
            model.eval()
            return tok, model
        self._tok, self._model = await asyncio.to_thread(_load)
        self._lock = asyncio.Lock()

    def _run(self, text: str, src: str, tgt: str) -> str:
        torch = self._torch
        messages = [{"role": "user", "content": f"{build_prompt(src, tgt)}\n\n{text}"}]
        inputs = self._tok.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt",
                                               return_dict=True).to(self._device)
        with torch.inference_mode():
            out = self._model.generate(**inputs, max_new_tokens=self._s.mt_max_new_tokens, do_sample=False)
        new = out[0][inputs["input_ids"].shape[1]:]
        return self._tok.decode(new, skip_special_tokens=True).strip()

    async def translate(self, text: str, src: str, tgt: str) -> str:
        if self._model is None or self._lock is None:
            raise ConfigError("RealMt.load() wurde nicht aufgerufen")
        if not text.strip():
            return ""
        build_prompt(src, tgt)                       # frueh pruefen: Sprache bekannt?
        async with self._lock:                       # ein Modell, eine Uebersetzung gleichzeitig
            return await asyncio.to_thread(self._run, text, src, tgt)

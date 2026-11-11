"""Empfohlener Uebersetzungs-Prompt fuer TranslateGemma (Quelle laut Plan: Google-Blog, arXiv 2601.09012).

Kein GPU-Import, daher auch in Messskripten und Tests nutzbar.
"""
from __future__ import annotations

LANG_NAMES = {"de": "German", "uk": "Ukrainian", "ar": "Arabic", "en": "English", "tr": "Turkish", "fa": "Persian"}

TEMPLATE = ("You are a professional {src_name} ({src}) to {tgt_name} ({tgt}) translator. "
            "Produce only the {tgt_name} translation, without any additional explanations or commentary.")


def build_prompt(src: str, tgt: str) -> str:
    try:
        return TEMPLATE.format(src_name=LANG_NAMES[src], src=src, tgt_name=LANG_NAMES[tgt], tgt=tgt)
    except KeyError as exc:
        raise ValueError(f"Sprache ohne Namen: {exc}") from None

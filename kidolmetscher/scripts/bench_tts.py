#!/usr/bin/env python3
"""Messung Sprachausgabe (Plan, Phase 2): Zeit bis Audio je Stimme. Aufruf: python3 scripts/bench_tts.py [--write]"""
import argparse
import asyncio
import time

from _common import build_pipeline, finish, load_settings, read_sentences
from app.benchmarks import fmt_ms, fmt_vram, md_table, median, stage_limit_ms, vram_used_mib


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--with-fa", action="store_true")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--force-mock", action="store_true")
    a = ap.parse_args()
    s = load_settings()
    pipe = build_pipeline(s)
    await pipe.mt.load()
    await pipe.tts.load()
    langs = ["uk", "ar", "en", "tr"] + (["fa"] if a.with_fa else [])
    lim = stage_limit_ms()
    rows = []
    for lang in langs:
        times, no_voice = [], 0
        for _, _, text in read_sentences():
            translated = await pipe.mt.translate(text, "de", lang)      # Text fuer die Stimme (nicht mitgemessen)
            t = time.perf_counter()
            res = await pipe.tts.synthesize(translated, lang)
            times.append((time.perf_counter() - t) * 1000)
            no_voice += res is None
        note = f"keine Stimme fuer {lang}" if no_voice == len(times) else ""
        rows.append(["TTS", lang, "-", fmt_ms(median(times), lim), fmt_ms(max(times, default=None), lim),
                     fmt_vram(vram_used_mib()), note])
    body = md_table(["Stufe", "Sprache", "Weg", "Median", "Maximum", "VRAM", "Hinweis"], rows)
    body += f"\n\nGrenze je Stufe {lim} ms ist eine ANNAHME. Hoerprobe je Stimme (Qualitaet) ist separat noetig."
    finish("Messlauf TTS", body, s, a.write, a.force_mock)


asyncio.run(main())

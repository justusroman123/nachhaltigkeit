#!/usr/bin/env python3
"""Lasttest (Plan, Phase 2): 4 Uebersetzungen und 4 Stimmen gleichzeitig; VRAM vorher/nachher.
Aufruf: python3 scripts/bench_load.py [--rounds 5] [--write]"""
import argparse
import asyncio
import time

from _common import build_pipeline, finish, load_settings, read_sentences
from app.benchmarks import TOTAL_BUDGET_MS, fmt_ms, fmt_vram, md_table, median, vram_used_mib

LANGS = ["uk", "ar", "en", "tr"]


async def one_lang(pipe, text, lang):
    t = time.perf_counter()
    out = await pipe.mt.translate(text, "de", lang)
    t_mt = (time.perf_counter() - t) * 1000
    t = time.perf_counter()
    await pipe.tts.synthesize(out, lang)
    return t_mt, (time.perf_counter() - t) * 1000


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=5)
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--force-mock", action="store_true")
    a = ap.parse_args()
    s = load_settings()
    pipe = build_pipeline(s)
    await pipe.mt.load()
    await pipe.tts.load()
    before = vram_used_mib()
    texts = [t for _, _, t in read_sentences()]
    walls, mts, ttss, peaks = [], [], [], []
    for i in range(a.rounds):
        text = texts[i % len(texts)]
        t = time.perf_counter()
        res = await asyncio.gather(*(one_lang(pipe, text, l) for l in LANGS))
        walls.append((time.perf_counter() - t) * 1000)
        mts += [r[0] for r in res]
        ttss += [r[1] for r in res]
        peaks.append(vram_used_mib())
    known = [p for p in peaks if p is not None]
    after = max(known) if known else None
    body = md_table(["Stufe", "Sprache", "Weg", "Median", "Maximum", "VRAM"], [
        ["MT (4 gleichzeitig)", "uk, ar, en, tr", "direkt", fmt_ms(median(mts)), fmt_ms(max(mts)), fmt_vram(after)],
        ["TTS (4 gleichzeitig)", "uk, ar, en, tr", "-", fmt_ms(median(ttss)), fmt_ms(max(ttss)), fmt_vram(after)],
        ["MT + TTS je Runde (Wanduhr)", "4 Sprachen", "-", fmt_ms(median(walls), TOTAL_BUDGET_MS), fmt_ms(max(walls), TOTAL_BUDGET_MS), fmt_vram(after)]])
    body += f"\n\nRunden: {a.rounds}. VRAM vor dem Test: {fmt_vram(before)}, danach (Spitze): {fmt_vram(after)}."
    body += "\nHinweis: ASR-Zeit kommt zur Summe hinzu (bench_asr.py). Go/No-Go laut Plan: Summe ASR+MT+TTS bei 4 Sprachen deutlich unter 5 s."
    finish("Lasttest 4 Sprachen", body, s, a.write, a.force_mock)


asyncio.run(main())

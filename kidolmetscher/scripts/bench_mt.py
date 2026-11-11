#!/usr/bin/env python3
"""Messung Uebersetzung (Plan, Phase 2): Zeit je Satz und Zielsprache, zwei Wege.

Weg "direkt": Deutsch -> X. Weg "Umweg": Deutsch -> Englisch -> X (nur fuer X != en).
Prompt (laut Plan belegt): siehe app/pipeline/mt_prompt.py. Aufruf: python3 scripts/bench_mt.py [--with-fa] [--write]
"""
import argparse
import asyncio
import time

from _common import build_pipeline, finish, load_settings, read_sentences
from app.benchmarks import fmt_ms, fmt_vram, md_table, median, stage_limit_ms, vram_used_mib
from app.pipeline.mt_prompt import build_prompt


async def timed(coro):
    t = time.perf_counter()
    r = await coro
    return r, (time.perf_counter() - t) * 1000


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--with-fa", action="store_true", help="Persisch mitmessen")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--force-mock", action="store_true")
    a = ap.parse_args()
    s = load_settings()
    pipe = build_pipeline(s)
    await pipe.mt.load()
    langs = ["uk", "ar", "en", "tr"] + (["fa"] if a.with_fa else [])
    sentences = read_sentences()
    lim = stage_limit_ms()
    rows = []
    for lang in langs:
        for weg in ("direkt", "Umweg ueber en"):
            if weg != "direkt" and lang == "en":
                continue
            times, vram = [], []
            for _, _, text in sentences:
                if weg == "direkt":
                    _, ms = await timed(pipe.mt.translate(text, "de", lang))
                else:
                    t = time.perf_counter()
                    mid = await pipe.mt.translate(text, "de", "en")
                    await pipe.mt.translate(mid, "en", lang)
                    ms = (time.perf_counter() - t) * 1000
                times.append(ms)
                vram.append(vram_used_mib())
            known = [v for v in vram if v is not None]
            rows.append(["MT", lang, weg, fmt_ms(median(times), lim), fmt_ms(max(times), lim),
                         fmt_vram(max(known) if known else None)])
    body = f"Saetze: {len(sentences)} (tests/audio/testsaetze.txt). Prompt-Beispiel: `{build_prompt('de', 'uk')}`\n\n"
    body += md_table(["Stufe", "Sprache", "Weg", "Median", "Maximum", "VRAM"], rows)
    body += f"\n\nGrenze je Stufe {lim} ms ist eine ANNAHME. Qualitaet wird hier NICHT gemessen (Muttersprachler-Bewertung, docs/bewertungsbogen.md)."
    finish("Messlauf MT", body, s, a.write, a.force_mock)


asyncio.run(main())

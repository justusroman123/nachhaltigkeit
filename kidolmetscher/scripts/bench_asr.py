#!/usr/bin/env python3
"""Messung Spracherkennung (Plan, Phase 2): Zeit bis erstes Wort, bis Satzende, Wortfehlerrate.

Eingabe: tests/audio/satzNN.wav (16 kHz, mono, 16 Bit) und tests/audio/testsaetze.txt als Referenz.
Standard: Wiedergabe in Echtzeit (nur so ist die Streaming-Latenz aussagekraeftig). --fast ueberspringt das Warten.
Aufruf: python3 scripts/bench_asr.py [--audio-dir DIR] [--fast] [--write]
"""
import argparse
import asyncio
import time
from pathlib import Path

from _common import ROOT, build_pipeline, finish, load_settings, read_sentences
from app.benchmarks import chunks, fmt_ms, fmt_vram, md_table, median, read_wav_pcm16, stage_limit_ms, vram_used_mib, wer
from app.pipeline.base import AudioChunk


async def run_one(asr, pcm: bytes, rate: int, fast: bool):
    stream = asr.new_stream()
    t0 = time.perf_counter()
    first = last = None
    texts = []
    now_ms = lambda: int(time.time() * 1000)
    for c in chunks(pcm, rate, 100):
        for seg in await stream.feed(AudioChunk(c, rate, now_ms())):
            if seg.final and seg.text.strip():
                first = first if first is not None else time.perf_counter() - t0
                last = time.perf_counter() - t0
                texts.append(seg.text)
        if not fast:
            await asyncio.sleep(len(c) / 2 / rate)
    for seg in await stream.flush():
        if seg.text.strip():
            first = first if first is not None else time.perf_counter() - t0
            last = time.perf_counter() - t0
            texts.append(seg.text)
    await stream.close()
    audio_s = len(pcm) / 2 / rate
    # "Zeit bis Satzende" = Ausgabe des letzten Textes nach dem Ende des Audios
    return first, None if last is None else max(0.0, last - audio_s), " ".join(texts)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio-dir", default=str(ROOT / "tests" / "audio"))
    ap.add_argument("--fast", action="store_true", help="nicht in Echtzeit abspielen (Latenzwerte dann ungueltig)")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--force-mock", action="store_true")
    a = ap.parse_args()
    s = load_settings()
    pipe = build_pipeline(s)
    await pipe.asr.load()
    v0 = vram_used_mib()
    rows, firsts, ends = [], [], []
    for name, kind, ref in read_sentences():
        wav = Path(a.audio_dir) / f"{name}.wav"
        if not wav.exists():
            rows.append([name, kind, "Datei fehlt", "-", "-"])
            continue
        first, end, hyp = await run_one(pipe.asr, read_wav_pcm16(str(wav), s.sample_rate), s.sample_rate, a.fast)
        firsts.append(first * 1000) if first is not None else None
        ends.append(end * 1000) if end is not None else None
        rows.append([name, kind, fmt_ms(None if first is None else first * 1000),
                     fmt_ms(None if end is None else end * 1000), f"{wer(ref, hyp):.0%}"])
    lim = stage_limit_ms()
    body = md_table(["Satz", "Art", "bis erstes Wort (ab Start)", "Ende-Verzoegerung (nach Audio-Ende)", "Wortfehlerrate"], rows)
    body += "\n\n" + md_table(["Stufe", "Sprache", "Weg", "Median", "Maximum", "VRAM"], [
        ["ASR (bis erstes Wort)", "de", "-", fmt_ms(median(firsts)), fmt_ms(max(firsts, default=None)), fmt_vram(vram_used_mib())],
        ["ASR (Ende-Verzoegerung)", "de", "-", fmt_ms(median(ends), lim), fmt_ms(max(ends, default=None), lim), fmt_vram(vram_used_mib())]])
    body += f"\n\nVRAM vor dem Laden/Messen: {fmt_vram(v0)}. Grenze je Stufe {lim} ms ist eine ANNAHME (5000 ms gleichmaessig auf drei Stufen)."
    if a.fast:
        body += "\n**--fast: Latenzwerte ungueltig.**"
    if not any(r[2] != "Datei fehlt" for r in rows):
        body += "\n\nKeine Audiodateien gefunden. Saetze einsprechen oder `python3 scripts/make_placeholder_audio.py` (nur Platzhalter) nutzen und --audio-dir setzen."
    finish("Messlauf ASR", body, s, a.write, a.force_mock)


asyncio.run(main())

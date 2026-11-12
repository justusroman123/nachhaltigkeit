#!/usr/bin/env python3
"""Rauchtest der Pipeline (Plan, Prompt B Punkt 5): laedt jede Stufe, verarbeitet einen erfundenen Satz,
gibt Zeit und VRAM aus. Backend je Stufe aus der Umgebung (ASR_BACKEND, MT_BACKEND, TTS_BACKEND)."""
import asyncio
import sys
import time

from _common import backend_label, build_pipeline, load_settings
from app.config import ConfigError
from app.benchmarks import fmt_ms, fmt_vram, md_table, vram_used_mib
from app.pipeline.base import AudioChunk

SATZ = "Dies ist ein Testsatz mit erfundenen Daten."


async def main() -> int:
    s = load_settings()
    pipe = build_pipeline(s)
    print(f"Backend: {backend_label(s)}")
    rows, ok = [], True

    async def step(name, coro):
        nonlocal ok
        t = time.perf_counter()
        try:
            await coro
            rows.append([name, "ok", fmt_ms((time.perf_counter() - t) * 1000), fmt_vram(vram_used_mib())])
        except NotImplementedError as exc:
            ok = False
            rows.append([name, f"nicht implementiert: {exc}", "-", fmt_vram(vram_used_mib())])
        except ConfigError as exc:                            # fehlende Einstellung/Paket/Datei: Hinweistext ist unkritisch
            ok = False
            rows.append([name, f"nicht startbar: {exc}", "-", fmt_vram(vram_used_mib())])
        except Exception as exc:
            ok = False
            rows.append([name, f"FEHLER {type(exc).__name__}", "-", fmt_vram(vram_used_mib())])

    await step("ASR laden", pipe.asr.load())
    await step("MT laden", pipe.mt.load())
    await step("TTS laden", pipe.tts.load())

    async def asr():
        stream = pipe.asr.new_stream()
        silence = b"\x00\x00" * (s.sample_rate // 10)
        for _ in range(30):                                   # 3 s Stille
            await stream.feed(AudioChunk(silence, s.sample_rate, int(time.time() * 1000)))
        await stream.flush()
        await stream.close()

    await step("ASR 3 s Stille", asr())
    result = {}

    async def mt():
        result["t"] = await pipe.mt.translate(SATZ, "de", "en")

    await step("MT de->en (1 Satz)", mt())
    await step("TTS en (1 Satz)", pipe.tts.synthesize(result.get("t", SATZ), "en"))
    print(md_table(["Schritt", "Ergebnis", "Zeit", "VRAM"], rows))
    print("\nErinnerung: GPU-Server nach dem Test beenden oder pausieren (Kosten laufen sonst weiter).")
    return 0 if ok else 1


sys.exit(asyncio.run(main()))

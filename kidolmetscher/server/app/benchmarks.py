"""Hilfen fuer die Messskripte (scripts/bench_*.py, smoke_test.py): Statistik, Tabellen, VRAM, Wortfehlerrate.

Kein Netzwerk, keine Modell-Imports. Gemessen wird nur, was die Pipeline-Schnittstellen hergeben.
"""
from __future__ import annotations

import re
import shutil
import statistics
import subprocess
from typing import Iterable, Optional, Sequence

TOTAL_BUDGET_MS = 5000      # Obergrenze des Ziels 3-5 s (Plan)


def normalize_words(text: str) -> list[str]:
    return re.findall(r"[\w'-]+", text.lower(), flags=re.UNICODE)


def wer(reference: str, hypothesis: str) -> float:
    """Wortfehlerrate (Levenshtein ueber Woerter, ohne Gross-/Kleinschreibung und Satzzeichen)."""
    ref, hyp = normalize_words(reference), normalize_words(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    prev = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        cur = [i]
        for j, h in enumerate(hyp, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h)))
        prev = cur
    return prev[-1] / len(ref)


def median(values: Sequence[float]) -> Optional[float]:
    return statistics.median(values) if values else None


def stage_limit_ms(total_ms: int = TOTAL_BUDGET_MS, stages: int = 3) -> int:
    """ANNAHME: Das Gesamtbudget wird gleichmaessig auf ASR, MT und TTS verteilt."""
    return total_ms // stages


def fmt_ms(value: Optional[float], limit_ms: Optional[float] = None) -> str:
    if value is None:
        return "unbekannt"
    text = f"{value:.0f} ms"
    return text + " ZU HOCH" if limit_ms is not None and value > limit_ms else text


def vram_used_mib() -> Optional[int]:
    """Belegter GPU-Speicher in MiB ueber nvidia-smi, sonst None (= unbekannt)."""
    exe = shutil.which("nvidia-smi")
    if not exe:
        return None
    try:
        out = subprocess.run([exe, "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                             capture_output=True, text=True, timeout=10, check=True).stdout
        return max(int(x) for x in out.split() if x.isdigit())
    except Exception:
        return None


def fmt_vram(value: Optional[int]) -> str:
    return "unbekannt" if value is None else f"{value} MiB"


def md_table(headers: Sequence[str], rows: Iterable[Sequence[object]]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    lines += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(lines)


def read_wav_pcm16(path: str, expect_rate: int = 16000) -> bytes:
    """Liest eine WAV-Datei (16 kHz, mono, 16 Bit) als rohe PCM-Bytes. Andere Formate: klarer Fehler."""
    import wave
    with wave.open(path, "rb") as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (expect_rate, 1, 2):
            raise ValueError(f"{path}: erwartet {expect_rate} Hz, mono, 16 Bit; "
                             f"gefunden {w.getframerate()} Hz, {w.getnchannels()} Kanal, {8 * w.getsampwidth()} Bit")
        return w.readframes(w.getnframes())


def chunks(pcm: bytes, rate: int = 16000, ms: int = 100):
    step = rate * ms // 1000 * 2
    for i in range(0, len(pcm), step):
        yield pcm[i:i + step]

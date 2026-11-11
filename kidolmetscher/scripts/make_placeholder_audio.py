#!/usr/bin/env python3
"""Erzeugt Platzhalter-WAVs (Rauschen/Ton, KEINE Sprache) aus tests/audio/testsaetze.txt.

Nur zum Testen der Messskripte, bis die Saetze eingesprochen sind (Plan, Prompt C, Punkt 1).
Ziel: tests/audio/platzhalter/ (nicht im Repository). Aufruf: python3 scripts/make_placeholder_audio.py
"""
import math
import random
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RATE = 16000
out = ROOT / "tests" / "audio" / "platzhalter"
out.mkdir(parents=True, exist_ok=True)
random.seed(1)
for line in (ROOT / "tests" / "audio" / "testsaetze.txt").read_text(encoding="utf-8").splitlines():
    if line.startswith("#") or "|" not in line:
        continue
    name, _, text = (p.strip() for p in line.split("|", 2))
    seconds = max(1.0, 0.35 * len(text.split()))       # grob: 0,35 s je Wort (nur Platzhalter-Laenge)
    frames = bytearray()
    for i in range(int(RATE * seconds)):
        v = 6000 * math.sin(2 * math.pi * 220 * i / RATE) + random.uniform(-1500, 1500)
        frames += struct.pack("<h", int(v))
    with wave.open(str(out / f"{name}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(bytes(frames))
    print(f"{name}.wav  {seconds:.1f} s")

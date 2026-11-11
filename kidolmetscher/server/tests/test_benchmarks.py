import os
import subprocess
import sys
import wave
from pathlib import Path

import pytest

from app.benchmarks import (chunks, fmt_ms, fmt_vram, md_table, median, normalize_words, read_wav_pcm16,
                            stage_limit_ms, vram_used_mib, wer)
from app.pipeline.mt_prompt import build_prompt

ROOT = Path(__file__).resolve().parents[2]


def test_wortfehlerrate():
    assert wer("das ist ein Test", "das ist ein Test") == 0
    assert wer("das ist ein Test", "Das ist ein Test!") == 0           # Gross-/Kleinschreibung, Satzzeichen egal
    assert wer("das ist ein Test", "das ist kein Test") == 0.25         # eine Ersetzung von vier Woertern
    assert wer("das ist ein Test", "das ist Test") == 0.25              # eine Auslassung
    assert wer("a b", "a b c d") == 1.0                                 # zwei Einfuegungen
    assert wer("", "") == 0 and wer("", "x") == 1


def test_normalisierung_behaelt_umlaute_und_zahlen():
    assert normalize_words("Die 85 Plätze, ÜBER 12,50 Euro.") == ["die", "85", "plätze", "über", "12", "50", "euro"]


def test_plan_prompt_ist_wortgleich_zum_plan():
    assert build_prompt("de", "uk") == (
        "You are a professional German (de) to Ukrainian (uk) translator. "
        "Produce only the Ukrainian translation, without any additional explanations or commentary.")
    assert "Arabic (ar)" in build_prompt("de", "ar") and "Turkish (tr)" in build_prompt("de", "tr")
    with pytest.raises(ValueError):
        build_prompt("de", "xx")


def test_grenze_je_stufe_ist_gleichverteilung_des_budgets():
    assert stage_limit_ms() == 1666 and stage_limit_ms(6000, 3) == 2000


def test_formatierung_und_median():
    assert fmt_ms(None) == "unbekannt" and fmt_ms(120) == "120 ms" and fmt_ms(2000, 1666).endswith("ZU HOCH")
    assert fmt_ms(1000, 1666) == "1000 ms"
    assert fmt_vram(None) == "unbekannt" and fmt_vram(512) == "512 MiB"
    assert median([1, 5, 3]) == 3 and median([]) is None
    t = md_table(["A", "B"], [[1, 2], ["x", "y"]])
    assert t.splitlines()[:3] == ["| A | B |", "|---|---|", "| 1 | 2 |"]


def test_vram_ohne_gpu_ist_unbekannt():
    if not any((Path(p) / "nvidia-smi").exists() for p in os.environ.get("PATH", "").split(os.pathsep)):
        assert vram_used_mib() is None


def _wav(path, rate, channels=1, seconds=0.3):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * int(rate * seconds) * channels)


def test_wav_format_wird_geprueft(tmp_path):
    ok, bad_rate, stereo = tmp_path / "ok.wav", tmp_path / "r.wav", tmp_path / "s.wav"
    _wav(ok, 16000); _wav(bad_rate, 44100); _wav(stereo, 16000, channels=2)
    pcm = read_wav_pcm16(str(ok))
    assert len(pcm) == 16000 * 0.3 * 2
    parts = list(chunks(pcm, 16000, 100))
    assert len(parts) == 3 and all(len(p) == 3200 for p in parts)       # 100 ms = 1600 Samples = 3200 Byte
    for bad in (bad_rate, stereo):
        with pytest.raises(ValueError, match="erwartet 16000 Hz"):
            read_wav_pcm16(str(bad))


def test_testsaetze_sind_vollstaendig_und_erfunden():
    lines = [l for l in (ROOT / "tests" / "audio" / "testsaetze.txt").read_text(encoding="utf-8").splitlines()
             if l and not l.startswith("#")]
    assert len(lines) == 8
    arten = {l.split("|")[1].strip() for l in lines}
    assert {"kurz", "lang", "Zahlen", "Eigennamen", "Fachwort"} <= arten      # Plan: kurz, lang, Zahlen, Eigennamen, Fachwort


def test_rauchtest_laeuft_mit_mock_und_meldet_echte_stufen_als_offen():
    env = {**os.environ, "ASR_BACKEND": "mock", "MT_BACKEND": "mock", "TTS_BACKEND": "mock"}
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "smoke_test.py")], capture_output=True, text=True,
                       env=env, timeout=60)
    assert r.returncode == 0 and "TTS en (1 Satz)" in r.stdout and "nicht implementiert" not in r.stdout
    env.update(ASR_BACKEND="real", MT_BACKEND="real", TTS_BACKEND="real")
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "smoke_test.py")], capture_output=True, text=True,
                       env=env, timeout=60)
    assert r.returncode == 1 and "nicht implementiert" in r.stdout       # Geruest: klarer Hinweis statt Absturz


def test_messskript_schreibt_mit_mock_nicht_ins_messprotokoll():
    before = (ROOT / "docs" / "messprotokoll.md").read_bytes()
    env = {**os.environ, "ASR_BACKEND": "mock", "MT_BACKEND": "mock", "TTS_BACKEND": "mock"}
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "bench_mt.py"), "--write"], capture_output=True,
                       text=True, env=env, timeout=60)
    assert r.returncode == 0 and "Nicht in docs/messprotokoll.md geschrieben" in r.stdout and "ACHTUNG" in r.stdout
    assert (ROOT / "docs" / "messprotokoll.md").read_bytes() == before

"""Gemeinsame Hilfen der Messskripte: Importpfad, Konfiguration, Testsaetze, Ausgabe."""
from __future__ import annotations

import datetime
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from app.config import Settings                      # noqa: E402
from app.pipeline import build_pipeline               # noqa: E402


def load_settings() -> Settings:
    return Settings.from_env(require_operator_key=False)


def backend_label(s: Settings) -> str:
    return f"ASR={s.asr_backend}, MT={s.mt_backend}, TTS={s.tts_backend}"


def is_mock(s: Settings) -> bool:
    return "mock" in (s.asr_backend, s.mt_backend, s.tts_backend)


def read_sentences(path: Path | None = None) -> list[tuple[str, str, str]]:
    path = path or ROOT / "tests" / "audio" / "testsaetze.txt"
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or "|" not in line:
            continue
        name, kind, text = (p.strip() for p in line.split("|", 2))
        out.append((name, kind, text))
    return out


def finish(title: str, body: str, s: Settings, write: bool, force_mock: bool = False) -> None:
    """Gibt den Bericht aus; mit --write wird er an docs/messprotokoll.md angehaengt (nicht bei Mocks)."""
    head = f"### {title} ({datetime.date.today():%d.%m.%Y})\nBackend: {backend_label(s)}"
    if is_mock(s):
        head += "\n**ACHTUNG: Attrappen (Mock) beteiligt. Diese Werte sagen nichts ueber das echte System aus.**"
    text = f"{head}\n\n{body}\n"
    print(text)
    if write:
        if is_mock(s) and not force_mock:
            print("Nicht in docs/messprotokoll.md geschrieben: Mock-Backend (mit --force-mock erzwingbar).")
            return
        with open(ROOT / "docs" / "messprotokoll.md", "a", encoding="utf-8") as f:
            f.write("\n" + text)
        print("An docs/messprotokoll.md angehaengt.")

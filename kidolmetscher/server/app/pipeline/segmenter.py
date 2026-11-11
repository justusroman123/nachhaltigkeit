"""Segmentierer: gibt nur stabile Teile an die Uebersetzung weiter (Plan, Phase 3).

Eingang: bestaetigte ASR-Textstuecke (final=True). Ausgang: Segmente, die an einem Satzende
oder spaetestens nach N Woertern enden (bevorzugt an Komma, Semikolon, Doppelpunkt).
Teilergebnisse (final=False) werden ignoriert. Zeitstempel: t_audio_in = Eingang des ersten
beteiligten Wortes, t_asr = Zeitpunkt, an dem das letzte Wort vorlag.
"""
from __future__ import annotations

import re
from typing import Optional

from .base import AsrSegment

SENTENCE_END = ".!?\u2026"
CLAUSE_END = ",;:"
_TRAIL = "\"'\u201c\u201d\u201e\u00bb\u00ab)]"
# Ordnungszahlen ("am 3. Mai") sind ein- bis zweistellig; "2024." beendet dagegen einen Satz.
# Abkuerzungen, nach denen ein Punkt kein Satzende ist (klein geschrieben, mit Punkt)
ABBREVIATIONS = {"z.", "b.", "z.b.", "d.", "h.", "d.h.", "u.a.", "ca.", "usw.", "bzw.", "nr.", "dr.",
                 "prof.", "str.", "vgl.", "ggf.", "evtl.", "inkl.", "max.", "min.", "tel.", "etc.",
                 "sog.", "ggü.", "s.", "o.", "u.", "v.", "ab."}


def ends_sentence(word: str) -> bool:
    w = word.rstrip(_TRAIL)
    if not w or w[-1] not in SENTENCE_END:
        return False
    if w[-1] == ".":
        if w.lower() in ABBREVIATIONS or re.fullmatch(r"\d{1,2}\.", w):   # "z. B.", Ordnungszahl "3."
            return False
    return True


class Segmenter:
    def __init__(self, max_words: int = 12):
        if max_words < 1:
            raise ValueError("max_words muss >= 1 sein")
        self.max_words = max_words
        self._words: list[tuple[str, int, int]] = []     # (Wort, t_audio_in, t_asr)

    def push(self, seg: AsrSegment) -> list[AsrSegment]:
        if not seg.final:
            return []
        out: list[AsrSegment] = []
        for w in seg.text.split():
            self._words.append((w, seg.t_audio_in, seg.t_asr))
            if ends_sentence(w):
                out.append(self._emit(len(self._words)))
            elif len(self._words) >= self.max_words:
                out.append(self._emit(self._cut_index()))
        return out

    def flush(self) -> list[AsrSegment]:
        return [self._emit(len(self._words))] if self._words else []

    def reset(self) -> None:
        self._words.clear()

    def _cut_index(self) -> int:
        """Schnitt bevorzugt hinter dem letzten Komma in der zweiten Haelfte des Puffers."""
        n = len(self._words)
        for i in range(n - 1, n // 2 - 1, -1):
            if self._words[i][0].rstrip(_TRAIL)[-1:] in tuple(CLAUSE_END) and i < n - 1:
                return i + 1
        return n

    def _emit(self, count: int) -> AsrSegment:
        taken, self._words = self._words[:count], self._words[count:]
        return AsrSegment(text=" ".join(w for w, _, _ in taken), final=True,
                          t_audio_in=min(t for _, t, _ in taken), t_asr=max(t for _, _, t in taken))

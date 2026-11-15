"""Entfernt Wiederholungsschleifen aus erkanntem oder uebersetztem Text (Whisper und kleine Modelle neigen dazu,
denselben Satz mehrfach auszugeben). Arbeitet nur auf dem uebergebenen Text, speichert nichts."""
import re
from typing import Tuple

_SATZ_ENDE = re.compile(r"(?<=[.!?…。؟])\s+")
_NICHT_WORT = re.compile(r"[\W_]+", re.UNICODE)


def _norm(s: str) -> str:
    return _NICHT_WORT.sub(" ", s.casefold()).strip()


def _doppelte_saetze(text: str) -> str:
    teile = [t for t in _SATZ_ENDE.split(text.strip()) if t]
    out: list[str] = []
    for t in teile:
        if out and _norm(t) and _norm(t) == _norm(out[-1]):
            continue
        out.append(t)
    return " ".join(out)


def _wortschleifen(text: str) -> str:
    """Gleiche Wortfolge (1 bis 12 Woerter) mehrfach direkt hintereinander: auf eine Folge kuerzen.
    Einzelwoerter erst ab 4 Wiederholungen, Folgen ab 2 (sonst werden absichtliche Doppelungen wie "sehr sehr" zerstoert)."""
    w = text.split()
    changed = True
    while changed:
        changed = False
        for n in range(12, 0, -1):
            mindest = 4 if n == 1 else 2
            i = 0
            while i + n * mindest <= len(w):
                blk = [_norm(x) for x in w[i:i + n]]
                if n > 1 and len(set(blk)) == 1:                 # nur ein Wort wiederholt: Sache der Einzelwort-Regel
                    i += 1
                    continue
                k = 1
                while i + n * (k + 1) <= len(w) and [_norm(x) for x in w[i + n * k:i + n * (k + 1)]] == blk:
                    k += 1
                if k >= mindest and any(blk):
                    del w[i + n:i + n * k]
                    changed = True
                i += 1
    return " ".join(w)


def entdoppeln(text: str) -> Tuple[str, bool]:
    """Liefert (bereinigter Text, wurde etwas entfernt)."""
    if not text:
        return text, False
    neu = _wortschleifen(_doppelte_saetze(text))
    return neu, neu != text.strip()


# Whisper erfindet bei Stille/Rauschen oft Abspann-Zeilen aus Untertitel-Trainingsdaten ("Untertitelung des BR 2018").
_SENDER = r"(?:ZDF|SWR|BR|WDR|NDR|MDR|ORF|SRF|RBB|HR)"
_FLOSKEL_UNTERTITEL = re.compile(
    r"(?i:untertitel(?:ung|ungen)?)[.:]?\s*(?:(?i:im auftrag|der|des|von|aufgrund der)\s+)?[^.!?]{0,60}?"
    r"(?:(?i:amara\.org)(?:-Community)?|\b" + _SENDER + r"\b)[^.!?\d]{0,20}(?:20\d\d)?[.:]?")
_FLOSKEL_SENDER_JAHR = re.compile(r"\b" + _SENDER + r"\s*,?\s*20\d\d\b[.:]?")
_NUR_UNTERTITEL = re.compile(r"^\s*(?i:untertitel(?:ung|ungen)?)[.!]?\s*$")


def entferne_floskeln(text: str) -> str:
    """Entfernt typische erfundene Abspann-Zeilen der Spracherkennung. Normaler Text bleibt unveraendert."""
    if not text or _NUR_UNTERTITEL.match(text):
        return ""
    neu = _FLOSKEL_SENDER_JAHR.sub(" ", _FLOSKEL_UNTERTITEL.sub(" ", text))
    return " ".join(neu.split())

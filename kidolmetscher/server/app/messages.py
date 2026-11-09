"""Nachrichtenformat und Zeitstempel (Regel 4).

Alle Zeitstempel sind Millisekunden seit Unix-Epoche, gemessen auf dem Server.
Reihenfolge: t_audio_in <= t_asr <= t_mt <= t_tts <= t_out.
Hinweis: t_audio_in ist der Server-Empfang des Audio-Blocks. Die Strecke
Mikrofon -> Browser -> Server ist darin NICHT enthalten (Messpunkt offen, siehe
docs/messprotokoll.md).
"""
from __future__ import annotations

import base64
import time
from dataclasses import dataclass
from typing import Any, Optional

PROTOCOL_VERSION = 1
SUPPORTED_LANGS = ("uk", "ar", "en", "tr", "fa")
RTL_LANGS = ("ar", "fa")
STAGE_FIELDS = ("t_audio_in", "t_asr", "t_mt", "t_tts", "t_out")

# WebSocket-Schliesscodes (4xxx = anwendungsspezifisch)
WS_BAD_REQUEST = 4400
WS_UNAUTHORIZED = 4401
WS_NOT_FOUND = 4404
WS_EXPIRED = 4408
WS_CONFLICT = 4409
WS_FULL = 4429


def now_ms() -> int:
    return time.time_ns() // 1_000_000


class MessageError(ValueError):
    """Nachricht ist ungueltig."""


@dataclass
class Timestamps:
    t_audio_in: int
    t_asr: Optional[int] = None
    t_mt: Optional[int] = None
    t_tts: Optional[int] = None   # None, wenn TTS aus ist
    t_out: Optional[int] = None

    def validate(self) -> "Timestamps":
        values = []
        for name in STAGE_FIELDS:
            v = getattr(self, name)
            if v is None:
                if name in ("t_audio_in", "t_asr", "t_mt", "t_out"):
                    raise MessageError(f"{name} fehlt")
                continue
            if isinstance(v, bool) or not isinstance(v, int) or v < 0:
                raise MessageError(f"{name} muss eine ganze Zahl >= 0 sein (ms)")
            values.append((name, v))
        for (n1, v1), (n2, v2) in zip(values, values[1:]):
            if v2 < v1:
                raise MessageError(f"Zeitstempel nicht monoton: {n2} < {n1}")
        return self

    def to_dict(self) -> dict[str, Optional[int]]:
        return {name: getattr(self, name) for name in STAGE_FIELDS}

    def deltas(self) -> dict[str, Optional[int]]:
        """Dauer je Stufe in ms (None, wenn Stufe nicht lief)."""
        def d(a: Optional[int], b: Optional[int]) -> Optional[int]:
            return None if a is None or b is None else b - a
        tts_base = self.t_tts if self.t_tts is not None else self.t_mt
        return {
            "asr": d(self.t_audio_in, self.t_asr),
            "mt": d(self.t_asr, self.t_mt),
            "tts": d(self.t_mt, self.t_tts),
            "out": d(tts_base, self.t_out),
            "total": d(self.t_audio_in, self.t_out),
        }


@dataclass
class AudioPayload:
    data: bytes
    sample_rate: int
    fmt: str = "wav"

    def to_dict(self) -> dict[str, Any]:
        return {
            "format": self.fmt,
            "sample_rate": self.sample_rate,
            "data_b64": base64.b64encode(self.data).decode("ascii"),
        }


@dataclass
class TranslationMessage:
    seq: int
    lang: str
    text: str
    text_src: str
    t: Timestamps
    final: bool = True
    audio: Optional[AudioPayload] = None

    def validate(self) -> "TranslationMessage":
        if isinstance(self.seq, bool) or not isinstance(self.seq, int) or self.seq < 0:
            raise MessageError("seq muss eine ganze Zahl >= 0 sein")
        if self.lang not in SUPPORTED_LANGS:
            raise MessageError(f"Sprache nicht unterstuetzt: {self.lang}")
        if not isinstance(self.text, str):
            raise MessageError("text muss ein String sein")
        self.t.validate()
        return self

    def to_dict(self, for_listener: bool = True) -> dict[str, Any]:
        """Zuhoerer bekommen nur die Uebersetzung, der Bedienplatz auch den Quelltext."""
        self.validate()
        out: dict[str, Any] = {
            "type": "translation",
            "v": PROTOCOL_VERSION,
            "seq": self.seq,
            "lang": self.lang,
            "text": self.text,
            "final": self.final,
            "audio": self.audio.to_dict() if self.audio else None,
            "t": self.t.to_dict(),
        }
        if not for_listener:
            out["text_src"] = self.text_src
        return out


def control_message(kind: str, **fields: Any) -> dict[str, Any]:
    """Steuernachricht ohne Inhalt, z. B. ready, session_end, token_expired, error."""
    return {"type": kind, "v": PROTOCOL_VERSION, **fields}

"""Konfiguration aus Umgebungsvariablen (Regel 2/3). Keine Geheimnisse im Code."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional

from .messages import SUPPORTED_LANGS

BACKENDS = ("mock", "real")
MIN_OPERATOR_KEY_LEN = 16


class ConfigError(ValueError):
    pass


def _bool(v: str) -> bool:
    return v.strip().lower() in ("1", "true", "yes", "ja", "on")


@dataclass(frozen=True)
class Settings:
    operator_key: str = ""
    host: str = "127.0.0.1"
    port: int = 8000
    web_dir: Path = Path(__file__).resolve().parents[2] / "web"

    asr_backend: str = "mock"
    mt_backend: str = "mock"
    tts_backend: str = "mock"
    tts_enabled: bool = True

    source_lang: str = "de"
    target_langs: tuple[str, ...] = ("uk", "ar", "en", "tr")
    sample_rate: int = 16000

    listener_ttl_s: int = 3600
    min_listener_ttl_s: int = 60
    max_listener_ttl_s: int = 28800
    room_ttl_s: int = 43200
    max_listeners_per_room: int = 100      # Platzhalter, nicht gemessen
    ring_buffer_size: int = 5

    mock_asr_segment_s: float = 2.0
    mock_delay_ms: int = 0

    # Echte Stufen: Werte unbekannt, kommen aus der Umgebung
    asr_model: str = "large-v3"
    mt_model_id: str = ""
    tts_voice_dir: str = ""

    def validate(self, require_operator_key: bool = True) -> "Settings":
        if require_operator_key and len(self.operator_key) < MIN_OPERATOR_KEY_LEN:
            raise ConfigError(
                f"OPERATOR_KEY fehlt oder ist kuerzer als {MIN_OPERATOR_KEY_LEN} Zeichen")
        for name in ("asr_backend", "mt_backend", "tts_backend"):
            if getattr(self, name) not in BACKENDS:
                raise ConfigError(f"{name.upper()} muss {BACKENDS} sein")
        if not self.target_langs:
            raise ConfigError("TARGET_LANGS ist leer")
        bad = [x for x in self.target_langs if x not in SUPPORTED_LANGS]
        if bad:
            raise ConfigError(f"Nicht unterstuetzte Sprachen: {bad}")
        if not (1 <= self.min_listener_ttl_s <= self.listener_ttl_s <= self.max_listener_ttl_s):
            raise ConfigError("Es muss gelten: MIN_LISTENER_TTL_S <= LISTENER_TTL_S <= MAX_LISTENER_TTL_S")
        if self.room_ttl_s < 1 or self.max_listeners_per_room < 1 or self.ring_buffer_size < 0:
            raise ConfigError("ROOM_TTL_S, MAX_LISTENERS_PER_ROOM oder RING_BUFFER_SIZE ungueltig")
        if self.mock_asr_segment_s <= 0 or self.mock_delay_ms < 0:
            raise ConfigError("MOCK_ASR_SEGMENT_S/MOCK_DELAY_MS ungueltig")
        return self

    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None,
                 require_operator_key: bool = True) -> "Settings":
        e = os.environ if env is None else env
        d = cls()

        def get(name: str, default):
            return e.get(name, default)

        try:
            s = cls(
                operator_key=get("OPERATOR_KEY", ""),
                host=get("HOST", d.host),
                port=int(get("PORT", d.port)),
                web_dir=Path(get("WEB_DIR", str(d.web_dir))).resolve(),
                asr_backend=get("ASR_BACKEND", d.asr_backend),
                mt_backend=get("MT_BACKEND", d.mt_backend),
                tts_backend=get("TTS_BACKEND", d.tts_backend),
                tts_enabled=_bool(get("TTS_ENABLED", "true")),
                target_langs=tuple(x.strip() for x in get("TARGET_LANGS", ",".join(d.target_langs)).split(",") if x.strip()),
                listener_ttl_s=int(get("LISTENER_TTL_S", d.listener_ttl_s)),
                min_listener_ttl_s=int(get("MIN_LISTENER_TTL_S", d.min_listener_ttl_s)),
                max_listener_ttl_s=int(get("MAX_LISTENER_TTL_S", d.max_listener_ttl_s)),
                room_ttl_s=int(get("ROOM_TTL_S", d.room_ttl_s)),
                max_listeners_per_room=int(get("MAX_LISTENERS_PER_ROOM", d.max_listeners_per_room)),
                ring_buffer_size=int(get("RING_BUFFER_SIZE", d.ring_buffer_size)),
                mock_asr_segment_s=float(get("MOCK_ASR_SEGMENT_S", d.mock_asr_segment_s)),
                mock_delay_ms=int(get("MOCK_DELAY_MS", d.mock_delay_ms)),
                asr_model=get("ASR_MODEL", d.asr_model),
                mt_model_id=get("MT_MODEL_ID", d.mt_model_id),
                tts_voice_dir=get("TTS_VOICE_DIR", d.tts_voice_dir),
            )
        except ValueError as exc:   # z. B. int("abc")
            raise ConfigError(f"Ungueltiger Konfigurationswert: {exc}") from exc
        return s.validate(require_operator_key)

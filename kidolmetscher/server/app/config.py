"""Konfiguration aus Umgebungsvariablen (Regel 2/3). Keine Geheimnisse im Code."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional

from .messages import SUPPORTED_LANGS

BACKENDS = ("mock", "real")
MIN_OPERATOR_KEY_LEN = 16
LOOPBACK_HOSTS = ("127.0.0.1", "localhost", "::1")


class ConfigError(ValueError):
    pass


def _bool(v: str) -> bool:
    return v.strip().lower() in ("1", "true", "yes", "ja", "on")


def parse_tts_voices(raw: str) -> dict[str, tuple[str, Optional[int]]]:
    """'uk=uk_UA-ukrainian_tts-medium:0,en=en_GB-alba-medium' -> {'uk': ('uk_UA-...', 0), 'en': ('en_GB-...', None)}."""
    out: dict[str, tuple[str, Optional[int]]] = {}
    for part in (x.strip() for x in raw.split(",") if x.strip()):
        lang, sep, voice = part.partition("=")
        lang, voice = lang.strip(), voice.strip()
        speaker: Optional[int] = None
        if ":" in voice:
            voice, _, sp = voice.partition(":")
            try:
                speaker = int(sp)
            except ValueError:
                raise ConfigError(f"TTS_VOICES: Sprecher-Nummer ungueltig in '{part}'") from None
            if speaker < 0:
                raise ConfigError(f"TTS_VOICES: Sprecher-Nummer ungueltig in '{part}'")
        # Stimmenname wird zum Dateinamen: keine Pfadanteile zulassen
        if not sep or lang not in SUPPORTED_LANGS or not re.fullmatch(r"[A-Za-z0-9_.-]+", voice) or ".." in voice:
            raise ConfigError(f"TTS_VOICES: erwartet 'sprache=stimme[:sprecher]', unzulaessig: '{part}'")
        out[lang] = (voice, speaker)
    return out


@dataclass(frozen=True)
class Settings:
    operator_key: str = ""
    host: str = "127.0.0.1"
    port: int = 8000
    web_dir: Path = Path(__file__).resolve().parents[2] / "web"
    allow_no_key: bool = False    # Demo ohne Bedienschluessel, nur zusammen mit HOST=127.0.0.1 (nur dieser Rechner)
    origin_check: bool = True     # WebSocket-Herkunftspruefung; nur fuer Vorschau-Tests hinter Zwischenservern abschalten
    public_url: str = ""          # optional: Adresse, unter der Zuhoerer den Server erreichen (fuer Link/QR)

    asr_backend: str = "mock"
    mt_backend: str = "mock"
    tts_backend: str = "mock"
    tts_enabled: bool = True

    source_lang: str = "de"
    target_langs: tuple[str, ...] = ("uk", "ar", "en", "tr", "fa")   # waehlbar (fa optional)
    default_langs: tuple[str, ...] = ("uk", "ar", "en", "tr")        # vorab angehakt
    sample_rate: int = 16000

    listener_ttl_s: int = 3600
    min_listener_ttl_s: int = 60
    max_listener_ttl_s: int = 28800
    room_ttl_s: int = 43200
    max_listeners_per_room: int = 100      # Platzhalter, nicht gemessen
    ring_buffer_size: int = 5

    segment_max_words: int = 12            # Segmentierer: hoechstens so viele Woerter je Uebersetzung
    lang_queue_max: int = 8                # Warteschlange je Sprache; darueber werden aelteste Segmente verworfen
    tts_skip_backlog: int = 2              # ab so vielen wartenden Segmenten entfaellt der Ton, Untertitel bleiben
    server_hourly_eur: float = 0.0         # optional, netto; 0 = unbekannt
    budget_eur: float = 0.0                # optional; 0 = keine Grenze

    mock_asr_segment_s: float = 2.0
    mock_delay_ms: int = 0

    # Echte Stufen: Werte unbekannt, kommen aus der Umgebung
    asr_model: str = "large-v3"
    mt_model_id: str = ""
    tts_voice_dir: str = ""
    tts_voices: str = ""                   # z. B. "uk=uk_UA-ukrainian_tts-medium:0,en=en_GB-alba-medium"

    def validate(self, require_operator_key: bool = True) -> "Settings":
        if self.allow_no_key and not self.operator_key:
            if self.host not in LOOPBACK_HOSTS:
                raise ConfigError("ALLOW_NO_KEY ohne OPERATOR_KEY ist nur mit HOST=127.0.0.1 (nur dieser Rechner) erlaubt")
        elif require_operator_key and len(self.operator_key) < MIN_OPERATOR_KEY_LEN:
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
        if self.public_url and not self.public_url.startswith(("http://", "https://")):
            raise ConfigError("PUBLIC_URL muss mit http:// oder https:// beginnen")
        if not self.default_langs or any(x not in self.target_langs for x in self.default_langs):
            raise ConfigError("DEFAULT_LANGS muss nicht leer und Teilmenge von TARGET_LANGS sein")
        if not (1 <= self.min_listener_ttl_s <= self.listener_ttl_s <= self.max_listener_ttl_s):
            raise ConfigError("Es muss gelten: MIN_LISTENER_TTL_S <= LISTENER_TTL_S <= MAX_LISTENER_TTL_S")
        if self.room_ttl_s < 1 or self.max_listeners_per_room < 1 or self.ring_buffer_size < 0:
            raise ConfigError("ROOM_TTL_S, MAX_LISTENERS_PER_ROOM oder RING_BUFFER_SIZE ungueltig")
        if self.segment_max_words < 1 or self.lang_queue_max < 1 or self.tts_skip_backlog < 1:
            raise ConfigError("SEGMENT_MAX_WORDS, LANG_QUEUE_MAX, TTS_SKIP_BACKLOG muessen >= 1 sein")
        if self.server_hourly_eur < 0 or self.budget_eur < 0:
            raise ConfigError("SERVER_HOURLY_EUR und BUDGET_EUR duerfen nicht negativ sein")
        parse_tts_voices(self.tts_voices)       # wirft ConfigError bei falschem Format
        if self.mock_asr_segment_s <= 0 or self.mock_delay_ms < 0:
            raise ConfigError("MOCK_ASR_SEGMENT_S/MOCK_DELAY_MS ungueltig")
        return self

    @classmethod
    def from_env(cls, env: Optional[Mapping[str, str]] = None,
                 require_operator_key: bool = True) -> "Settings":
        e = os.environ if env is None else env
        d = cls()
        targets = tuple(x.strip() for x in e.get("TARGET_LANGS", ",".join(d.target_langs)).split(",") if x.strip())
        defaults_raw = e.get("DEFAULT_LANGS")
        defaults = (tuple(x.strip() for x in defaults_raw.split(",") if x.strip()) if defaults_raw is not None
                    else tuple(x for x in targets if x != "fa"))     # Persisch nur auf Wunsch

        def get(name: str, default):
            return e.get(name, default)

        try:
            s = cls(
                operator_key=get("OPERATOR_KEY", ""),
                host=get("HOST", d.host),
                port=int(get("PORT", d.port)),
                web_dir=Path(get("WEB_DIR", str(d.web_dir))).resolve(),
                allow_no_key=_bool(get("ALLOW_NO_KEY", "false")),
                origin_check=_bool(get("ORIGIN_CHECK", "true")),
                public_url=get("PUBLIC_URL", "").strip().rstrip("/"),
                asr_backend=get("ASR_BACKEND", d.asr_backend),
                mt_backend=get("MT_BACKEND", d.mt_backend),
                tts_backend=get("TTS_BACKEND", d.tts_backend),
                tts_enabled=_bool(get("TTS_ENABLED", "true")),
                target_langs=targets,
                default_langs=defaults,
                listener_ttl_s=int(get("LISTENER_TTL_S", d.listener_ttl_s)),
                min_listener_ttl_s=int(get("MIN_LISTENER_TTL_S", d.min_listener_ttl_s)),
                max_listener_ttl_s=int(get("MAX_LISTENER_TTL_S", d.max_listener_ttl_s)),
                room_ttl_s=int(get("ROOM_TTL_S", d.room_ttl_s)),
                max_listeners_per_room=int(get("MAX_LISTENERS_PER_ROOM", d.max_listeners_per_room)),
                ring_buffer_size=int(get("RING_BUFFER_SIZE", d.ring_buffer_size)),
                segment_max_words=int(get("SEGMENT_MAX_WORDS", d.segment_max_words)),
                lang_queue_max=int(get("LANG_QUEUE_MAX", d.lang_queue_max)),
                tts_skip_backlog=int(get("TTS_SKIP_BACKLOG", d.tts_skip_backlog)),
                server_hourly_eur=float(get("SERVER_HOURLY_EUR", d.server_hourly_eur)),
                budget_eur=float(get("BUDGET_EUR", d.budget_eur)),
                mock_asr_segment_s=float(get("MOCK_ASR_SEGMENT_S", d.mock_asr_segment_s)),
                mock_delay_ms=int(get("MOCK_DELAY_MS", d.mock_delay_ms)),
                asr_model=get("ASR_MODEL", d.asr_model),
                mt_model_id=get("MT_MODEL_ID", d.mt_model_id),
                tts_voice_dir=get("TTS_VOICE_DIR", d.tts_voice_dir),
                tts_voices=get("TTS_VOICES", d.tts_voices).strip(),
            )
        except ValueError as exc:   # z. B. int("abc")
            raise ConfigError(f"Ungueltiger Konfigurationswert: {exc}") from exc
        return s.validate(require_operator_key)

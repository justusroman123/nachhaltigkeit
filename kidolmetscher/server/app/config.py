"""Konfiguration aus Umgebungsvariablen (Regel 2/3). Keine Geheimnisse im Code."""
from __future__ import annotations

import ipaddress
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


def parse_lang_codes(raw: str) -> dict[str, str]:
    """'ar=ar-SA,uk=uk-UA' -> {'ar': 'ar-SA', 'uk': 'uk-UA'} (Sprachcode fuer die Uebersetzung)."""
    out: dict[str, str] = {}
    for part in (x.strip() for x in raw.split(",") if x.strip()):
        lang, sep, code = (p.strip() for p in part.partition("="))
        if not sep or lang not in (*SUPPORTED_LANGS, "de") or not re.fullmatch(r"[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,4})?", code):
            raise ConfigError(f"MT_LANG_CODES: erwartet 'sprache=code' (z. B. ar=ar-SA), unzulaessig: '{part}'")
        out[lang] = code
    return out


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
        if not sep or lang not in (*SUPPORTED_LANGS, "de") or not re.fullmatch(r"[A-Za-z0-9_.-]+", voice) or ".." in voice:
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
    max_guests: int = 3                    # Gespraechsmodus: so viele Gaeste gleichzeitig (Vorgabe des Nutzers)
    auth_max_fails: int = 10               # falsche Bedienschluessel je Absender, dann Sperre (Schutz gegen Raten; Annahme)
    auth_window_s: float = 600.0           # ... innerhalb dieser Zeit
    auth_block_s: float = 900.0            # Dauer der Sperre
    turn_idle_s: float = 120.0             # Gespraech: so lange ohne hoerbare Sprache, dann endet die Aussage von selbst; Redezeit ist NICHT begrenzt (Annahme, im Test pruefen)
    turn_pickup_s: float = 30.0            # Gespraech: so lange auf die Bestaetigung einer automatisch uebergebenen Wortmeldung warten (Annahme)
    turn_process_max_s: float = 90.0       # Gespraech: laengste Verarbeitung nach einer Aussage, dann geht es weiter (Annahme, messen)
    turn_play_max_s: float = 15.0          # Gespraech: Mindest-Wartezeit auf "fertig" der Geraete (dazu kommt die Tonlaenge; Annahme)
    turn_grace_s: float = 0.5              # Gespraech: kurze Schonfrist nach "alle fertig" (Annahme)
    trusted_proxies: tuple[str, ...] = ("127.0.0.1", "::1")   # nur von diesen Adressen/Netzen wird X-Forwarded-For geglaubt (Caddy auf demselben Rechner)
    host_check: bool = True                # Demo ohne Schluessel: nur Host-Namen dieses Rechners zulassen (Schutz gegen DNS-Rebinding)
    ring_buffer_size: int = 40             # letzte Untertitel fuer spaet verbundene Zuhoerer (nur Text, ohne Ton)
    history_s: float = 120.0               # Verlauf: aeltere Untertitel werden geloescht (Zuhoerer-Seite und Server)

    segment_max_words: int = 40            # Segmentierer: hoechstens so viele Woerter je Uebersetzung (Saetze werden am Satzende getrennt)
    segment_tail_hold_ms: int = 2200       # Rest ohne Satzzeichen so lange auf die Fortsetzung warten, dann trotzdem uebersetzen (0 = sofort)
    stage_timeout_s: float = 60.0          # eine MT-/TTS-Stufe laenger als das: Satz als Problem melden statt alles zu blockieren
    lang_queue_max: int = 500              # Warteschlange je Sprache; Vollstaendigkeit geht vor (frueher 8: verwarf Saetze)
    tts_skip_backlog: int = 100000         # ab so vielen wartenden Segmenten entfaellt der Ton; praktisch aus (frueher 2: Ton fehlte bei Untertiteln)
    server_hourly_eur: float = 0.0         # optional, netto; 0 = unbekannt
    budget_eur: float = 0.0                # optional; 0 = keine Grenze

    mock_asr_segment_s: float = 2.0
    mock_delay_ms: int = 0

    # Echte Stufen: Werte unbekannt, kommen aus der Umgebung
    asr_model: str = "large-v3"            # Name oder lokaler Ordner (Betrieb: lokaler Ordner, HF_HUB_OFFLINE=1)
    asr_device: str = "auto"               # auto | cuda | cpu
    asr_compute_type: str = "default"      # z. B. float16 (GPU), int8 (CPU)
    asr_beam_size: int = 5
    asr_silence_ms: int = 800              # Pause, nach der ein Abschnitt an die Erkennung geht (Annahme, messen); Satzteile werden spaeter im Segmentierer zusammengehalten
    asr_max_utterance_s: float = 8.0       # laengster Abschnitt ohne Pause, danach Schnitt an der leisesten Stelle (Annahme, messen)
    asr_min_speech_ms: int = 300           # kuerzere Abschnitte werden verworfen
    asr_vad_rms: int = 400                 # Lautstaerke-Schwelle (RMS, 16-Bit-Skala) fuer "es wird gesprochen" (Annahme, messen)
    mt_model_id: str = ""
    mt_device: str = "auto"                # auto | cuda | cpu
    mt_dtype: str = "auto"                 # auto | bfloat16 | float16 | float32
    mt_max_new_tokens: int = 1024
    debug_fehler: bool = False             # Testphase: Fehlermeldung (gekuerzt) mitloggen; kann Textteile enthalten, im Betrieb AUS
    mt_prompt_mode: str = "structured"     # structured = Format laut TranslateGemma-Modellkarte | plain = Plan-Prompt als Text
    mt_lang_codes: str = ""                # Sprachcode-Ueberschreibungen, z. B. "ar=ar-SA,uk=uk-UA" (Standard: eigener Code, ISO 639-1)
    tts_voice_dir: str = ""
    tts_voices: str = ""                   # z. B. "uk=uk_UA-ukrainian_tts-medium:0,en=en_GB-alba-medium"

    def fehler(self, exc: BaseException) -> str:
        """Text fuer Fehler-Logzeilen: nur der Typ; mit DEBUG_FEHLER zusaetzlich die gekuerzte Meldung (Testphase)."""
        return f"{type(exc).__name__}: {str(exc)[:200]}" if self.debug_fehler else type(exc).__name__

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
        if self.auth_max_fails < 1 or self.auth_window_s <= 0 or self.auth_block_s <= 0:
            raise ConfigError("AUTH_MAX_FAILS, AUTH_WINDOW_S und AUTH_BLOCK_S muessen positiv sein")
        if not (10 <= self.turn_idle_s <= 3600):
            raise ConfigError("TURN_IDLE_S muss zwischen 10 und 3600 Sekunden liegen")
        if min(self.turn_pickup_s, self.turn_process_max_s, self.turn_play_max_s) <= 0 or self.turn_grace_s < 0:
            raise ConfigError("TURN_PICKUP_S, TURN_PROCESS_MAX_S und TURN_PLAY_MAX_S muessen positiv, TURN_GRACE_S >= 0 sein")
        for net in self.trusted_proxies:
            try:
                ipaddress.ip_network(net, strict=False)
            except ValueError:
                raise ConfigError(f"TRUSTED_PROXIES: keine gueltige Adresse oder kein Netz: '{net}'") from None
        if self.room_ttl_s < 1 or self.max_listeners_per_room < 1 or self.ring_buffer_size < 0 or self.history_s <= 0 or self.max_guests < 1:
            raise ConfigError("ROOM_TTL_S, MAX_LISTENERS_PER_ROOM oder RING_BUFFER_SIZE ungueltig")
        if self.segment_max_words < 1 or self.lang_queue_max < 1 or self.tts_skip_backlog < 1:
            raise ConfigError("SEGMENT_MAX_WORDS, LANG_QUEUE_MAX, TTS_SKIP_BACKLOG muessen >= 1 sein")
        if self.server_hourly_eur < 0 or self.budget_eur < 0:
            raise ConfigError("SERVER_HOURLY_EUR und BUDGET_EUR duerfen nicht negativ sein")
        if (self.asr_device not in ("auto", "cuda", "cpu") or self.mt_device not in ("auto", "cuda", "cpu")
                or self.mt_dtype not in ("auto", "bfloat16", "float16", "float32")
                or self.mt_prompt_mode not in ("plain", "structured")):
            raise ConfigError("ASR_DEVICE/MT_DEVICE: auto|cuda|cpu, MT_DTYPE: auto|bfloat16|float16|float32, MT_PROMPT_MODE: plain|structured")
        if (self.asr_beam_size < 1 or self.asr_silence_ms < 100 or self.asr_max_utterance_s < 2
                or self.asr_min_speech_ms < 0 or self.asr_vad_rms < 1 or self.mt_max_new_tokens < 1):
            raise ConfigError("ASR_BEAM_SIZE, ASR_SILENCE_MS (>=100), ASR_MAX_UTTERANCE_S (>=2), ASR_MIN_SPEECH_MS, "
                              "ASR_VAD_RMS oder MT_MAX_NEW_TOKENS ungueltig")
        parse_lang_codes(self.mt_lang_codes)
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
                history_s=float(get("HISTORY_S", d.history_s)),
                turn_idle_s=float(get("TURN_IDLE_S", d.turn_idle_s)),
                turn_pickup_s=float(get("TURN_PICKUP_S", d.turn_pickup_s)),
                turn_process_max_s=float(get("TURN_PROCESS_MAX_S", d.turn_process_max_s)),
                turn_play_max_s=float(get("TURN_PLAY_MAX_S", d.turn_play_max_s)),
                turn_grace_s=float(get("TURN_GRACE_S", d.turn_grace_s)),
                trusted_proxies=tuple(x.strip() for x in get("TRUSTED_PROXIES", ",".join(d.trusted_proxies)).split(",") if x.strip()),
                host_check=_bool(get("HOST_CHECK", "true")),
                auth_max_fails=int(get("AUTH_MAX_FAILS", d.auth_max_fails)),
                auth_window_s=float(get("AUTH_WINDOW_S", d.auth_window_s)),
                auth_block_s=float(get("AUTH_BLOCK_S", d.auth_block_s)),
                max_guests=int(get("MAX_GUESTS", d.max_guests)),
                segment_max_words=int(get("SEGMENT_MAX_WORDS", d.segment_max_words)),
                segment_tail_hold_ms=int(get("SEGMENT_TAIL_HOLD_MS", d.segment_tail_hold_ms)),
                stage_timeout_s=float(get("STAGE_TIMEOUT_S", d.stage_timeout_s)),
                lang_queue_max=int(get("LANG_QUEUE_MAX", d.lang_queue_max)),
                tts_skip_backlog=int(get("TTS_SKIP_BACKLOG", d.tts_skip_backlog)),
                server_hourly_eur=float(get("SERVER_HOURLY_EUR", d.server_hourly_eur)),
                budget_eur=float(get("BUDGET_EUR", d.budget_eur)),
                mock_asr_segment_s=float(get("MOCK_ASR_SEGMENT_S", d.mock_asr_segment_s)),
                mock_delay_ms=int(get("MOCK_DELAY_MS", d.mock_delay_ms)),
                asr_model=get("ASR_MODEL", d.asr_model),
                asr_device=get("ASR_DEVICE", d.asr_device),
                asr_compute_type=get("ASR_COMPUTE_TYPE", d.asr_compute_type),
                asr_beam_size=int(get("ASR_BEAM_SIZE", d.asr_beam_size)),
                asr_silence_ms=int(get("ASR_SILENCE_MS", d.asr_silence_ms)),
                asr_max_utterance_s=float(get("ASR_MAX_UTTERANCE_S", d.asr_max_utterance_s)),
                asr_min_speech_ms=int(get("ASR_MIN_SPEECH_MS", d.asr_min_speech_ms)),
                asr_vad_rms=int(get("ASR_VAD_RMS", d.asr_vad_rms)),
                mt_model_id=get("MT_MODEL_ID", d.mt_model_id),
                mt_device=get("MT_DEVICE", d.mt_device),
                mt_dtype=get("MT_DTYPE", d.mt_dtype),
                mt_max_new_tokens=int(get("MT_MAX_NEW_TOKENS", d.mt_max_new_tokens)),
                debug_fehler=_bool(get("DEBUG_FEHLER", "false")),
                mt_prompt_mode=get("MT_PROMPT_MODE", d.mt_prompt_mode),
                mt_lang_codes=get("MT_LANG_CODES", d.mt_lang_codes).strip(),
                tts_voice_dir=get("TTS_VOICE_DIR", d.tts_voice_dir),
                tts_voices=get("TTS_VOICES", d.tts_voices).strip(),
            )
        except ValueError as exc:   # z. B. int("abc")
            raise ConfigError(f"Ungueltiger Konfigurationswert: {exc}") from exc
        return s.validate(require_operator_key)

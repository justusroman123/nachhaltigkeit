"""Echte Spracherkennung mit faster-whisper (Whisper large-v3, MIT-Lizenz; Paket optional, nicht in requirements.txt).

Weg "pausenbasiert" (nicht SimulStreaming/WhisperLiveKit; Entscheidung E9 bleibt offen und ist auf der GPU zu messen):
Die Anwendung erkennt Sprechpausen an der Lautstaerke, sammelt je Raum den Abschnitt im Arbeitsspeicher und laesst
Whisper den fertigen Abschnitt erkennen. Die Verzoegerung ist damit Abschnittslaenge + Erkennungszeit (Messpunkt
t_asr - t_audio_in). Abschnitte werden nach ASR_MAX_UTTERANCE_S auch ohne Pause abgeschlossen.

- Audio nur im RAM, nie auf Platte; close() loescht den Puffer (Regel 1).
- Schwellen (ASR_SILENCE_MS, ASR_MAX_UTTERANCE_S, ASR_VAD_RMS) sind Annahmen, an echten Aufnahmen zu messen.
- Imports von numpy/faster_whisper erst in load().
"""
from __future__ import annotations

import asyncio
import logging
import math
from collections import deque
from typing import Any, Callable, Optional

from ..config import ConfigError, Settings
from ..messages import now_ms
from .base import AsrSegment, AsrStream, AudioChunk

from .text_clean import entdoppeln, entferne_floskeln
log = logging.getLogger("kidolmetscher.pipeline")
PEGEL_ALLE_BLOECKE = 100     # Pegel-Logzeile etwa alle 5 s (nur Zahlen, keine Inhalte)
TAIL_KEEP_MS = 600        # so viel Stille bleibt hinter dem letzten lauten Block erhalten (leise Wortenden nicht abschneiden)
VAD_OFF_FACTOR = 0.6      # innerhalb einer Aussage zaehlt ab 60 % der Start-Schwelle noch als Sprache (Hysterese, Annahme)
PREROLL_MS = 200          # Audio vor dem ersten lauten Block, damit der Wortanfang nicht fehlt


def pcm16_rms(pcm: bytes) -> float:
    """Effektivwert eines PCM16-Blocks (ohne numpy, ein Block hat nur ca. 800 Werte)."""
    n = len(pcm) // 2
    if n == 0:
        return 0.0
    import array
    a = array.array("h")
    a.frombytes(pcm[: n * 2])
    return math.sqrt(sum(x * x for x in a) / n)


class RealAsrStream:
    """Sammelt je Sprecher den Abschnitt (pausenbasiert). Nichts wird stillschweigend verworfen:
    - Beginn mit Vorlauf, Ende erst nach laengerer Pause (Schwellen mit Hysterese: leise Wortenden zaehlen noch als Sprache);
    - ist die Hoechstlaenge erreicht, wird an der leisesten Stelle geschnitten, der Rest bleibt fuer den naechsten Abschnitt;
    - nicht erkannte Abschnitte werden gemeldet (pop_notice)."""

    def __init__(self, owner: "RealAsr", clock: Callable[[], int], lang: Optional[str] = None):
        self._o = owner
        self._lang = lang
        self._clock = clock
        self._pre: deque[AudioChunk] = deque()
        self._pre_ms = 0.0
        self._n = self._laut_n = self._rms_max = 0
        self._notice: Optional[str] = None
        self._reset()

    def _reset(self) -> None:
        self._buf: list[bytes] = []
        self._rmsl: list[float] = []              # Pegel je Block (zum Finden der leisesten Schnittstelle)
        self._msl: list[float] = []               # Dauer je Block in ms
        self._tin: list[int] = []                 # Eingangszeit je Block
        self._rate = 16000
        self._speech_ms = 0.0
        self._silence_ms = 0.0
        self._total_ms = 0.0
        self._first_in: Optional[int] = None
        self._active = False

    def pop_notice(self) -> Optional[str]:
        n, self._notice = self._notice, None
        return n

    def _quiet_split(self) -> int:
        """Index des ersten Blocks NACH der leisesten Stelle im hinteren Teil des Puffers (letztes Viertel, 0,5 bis 3 s).
        Bei gleich lauten Stellen gewinnt die spaeteste (der Abschnitt wird nicht unnoetig kurz)."""
        n = len(self._buf)
        if n < 4:
            return n
        window_ms, acc, start = min(3000.0, max(500.0, self._total_ms / 4)), 0.0, n - 1
        while start > 1 and acc < window_ms:
            acc += self._msl[start]
            start -= 1
        best = min(range(start, n - 1), key=lambda i: (self._rmsl[i], -i), default=n - 2)
        return best + 1

    async def _finish(self, keep_from: Optional[int] = None) -> list[AsrSegment]:
        s = self._o.settings
        head = self._buf[:keep_from] if keep_from is not None else self._buf
        tail = (self._buf[keep_from:], self._rmsl[keep_from:], self._msl[keep_from:], self._tin[keep_from:]) if keep_from is not None else None
        pcm, first_in, rate = b"".join(head), self._first_in, self._rate
        speech_ms = sum(m for m, r in zip(self._msl[:len(head)], self._rmsl[:len(head)]) if r >= s.asr_vad_rms * VAD_OFF_FACTOR)
        silence_tail = 0.0
        for m, r in zip(reversed(self._msl[:len(head)]), reversed(self._rmsl[:len(head)])):
            if r >= s.asr_vad_rms * VAD_OFF_FACTOR:
                break
            silence_tail += m
        ueberhang_ms = silence_tail - TAIL_KEEP_MS          # Stille am Ende kuerzen (dort halluziniert Whisper gern), Wortende bleibt
        self._reset()
        if tail is not None:                                # Rest des Puffers beginnt den naechsten Abschnitt
            self._buf, self._rmsl, self._msl, self._tin = (list(x) for x in tail)
            self._active = bool(self._buf)
            self._total_ms = sum(self._msl)
            self._speech_ms = sum(m for m, r in zip(self._msl, self._rmsl) if r >= s.asr_vad_rms * VAD_OFF_FACTOR)
            self._first_in = self._tin[0] if self._tin else None
            self._rate = rate
        if ueberhang_ms > 0:
            pcm = pcm[: max(0, len(pcm) - int(rate * ueberhang_ms / 1000) * 2)]
        if not pcm or speech_ms < s.asr_min_speech_ms:
            return []
        text = await self._o.transcribe(pcm, rate, self._lang)
        text, bereinigt = entdoppeln(text)
        log.info("asr_abschnitt sprach_ms=%d erkannt=%s bereinigt=%s", speech_ms, bool(text), bereinigt)
        if not text:
            self._notice = "nicht_erkannt"                   # Sprache war da, es kam aber kein Text heraus: dem Sprecher melden
            return []
        return [AsrSegment(text=text, final=True, t_audio_in=first_in if first_in is not None else self._clock(),
                           t_asr=self._clock())]

    async def feed(self, chunk: AudioChunk) -> list[AsrSegment]:
        s = self._o.settings
        ms = chunk.duration_s * 1000
        self._rate = chunk.sample_rate
        rms = pcm16_rms(chunk.pcm)
        on = s.asr_vad_rms
        loud = rms >= (on * VAD_OFF_FACTOR if self._active else on)     # Hysterese: leise Wortenden gehoeren noch zur Sprache
        self._n += 1
        self._laut_n += loud
        self._rms_max = max(self._rms_max, int(rms))
        if self._n >= PEGEL_ALLE_BLOECKE:        # Diagnose: kommt Sprache an, und ueberschreitet sie die Schwelle?
            log.info("asr_pegel rms_max=%d schwelle=%d laut_prozent=%d", self._rms_max, s.asr_vad_rms,
                     100 * self._laut_n // self._n)
            self._n = self._laut_n = self._rms_max = 0
        if not self._active:
            if not loud:                                   # Stille: nur kurzen Vorlauf merken
                self._pre.append(chunk)
                self._pre_ms += ms
                while self._pre and self._pre_ms - self._pre[0].duration_s * 1000 >= PREROLL_MS:
                    self._pre_ms -= self._pre.popleft().duration_s * 1000
                return []
            self._active = True
            self._first_in = chunk.t_audio_in
            for c in self._pre:
                self._buf.append(c.pcm); self._rmsl.append(0.0); self._msl.append(c.duration_s * 1000); self._tin.append(c.t_audio_in)
                self._total_ms += c.duration_s * 1000
            self._pre.clear()
            self._pre_ms = 0.0
        self._buf.append(chunk.pcm); self._rmsl.append(rms); self._msl.append(ms); self._tin.append(chunk.t_audio_in)
        self._total_ms += ms
        if loud:
            self._speech_ms += ms
            self._silence_ms = 0.0
        else:
            self._silence_ms += ms
        if self._silence_ms >= s.asr_silence_ms:
            return await self._finish()
        if self._total_ms >= s.asr_max_utterance_s * 1000:
            return await self._finish(keep_from=self._quiet_split())      # nicht mitten im Wort schneiden
        return []

    async def flush(self) -> list[AsrSegment]:
        return await self._finish() if self._active else []

    async def close(self) -> None:
        self._reset()
        self._pre.clear()
        self._pre_ms = 0.0


class RealAsr:
    def __init__(self, settings: Settings, clock: Callable[[], int] = now_ms):
        self.settings = settings
        self._clock = clock
        self._model: Any = None
        self._np: Any = None
        self._lock: Optional[asyncio.Lock] = None

    async def load(self) -> None:
        try:
            import numpy
            from faster_whisper import WhisperModel          # optional, MIT
        except ImportError as exc:
            raise ConfigError('Paket "faster-whisper" ist nicht installiert (pip install -r requirements-asr.txt)') from exc
        s = self.settings
        self._np = numpy
        self._model = await asyncio.to_thread(
            lambda: WhisperModel(s.asr_model, device=s.asr_device, compute_type=s.asr_compute_type))
        self._lock = asyncio.Lock()

    def new_stream(self, lang: Optional[str] = None) -> AsrStream:
        if self._model is None:
            raise ConfigError("RealAsr.load() wurde nicht aufgerufen")
        return RealAsrStream(self, self._clock, lang)

    def _run(self, pcm: bytes, rate: int, lang: Optional[str] = None) -> str:
        audio = self._np.frombuffer(pcm, dtype=self._np.int16).astype(self._np.float32) / 32768.0
        if rate != 16000:
            raise ValueError("ASR erwartet 16 kHz")
        segments, _ = self._model.transcribe(
            audio, language=lang or self.settings.source_lang, beam_size=self.settings.asr_beam_size,
            vad_filter=True, vad_parameters={"threshold": 0.3, "min_silence_duration_ms": 1500, "speech_pad_ms": 600},
            condition_on_previous_text=False,
            no_speech_threshold=0.8, log_prob_threshold=-1.5, compression_ratio_threshold=3.0)
        teile = []
        for seg in segments:
            if getattr(seg, "no_speech_prob", 0.0) > 0.85 and getattr(seg, "avg_logprob", 0.0) < -1.5:
                continue                                      # sehr wahrscheinlich keine Sprache (nur dann verwerfen)
            t = entferne_floskeln(seg.text.strip())
            if t:
                teile.append(t)
        return " ".join(teile).strip()

    async def transcribe(self, pcm: bytes, rate: int, lang: Optional[str] = None) -> str:
        assert self._lock is not None
        async with self._lock:                               # ein Modell, eine Erkennung gleichzeitig
            return await asyncio.to_thread(self._run, pcm, rate, lang)

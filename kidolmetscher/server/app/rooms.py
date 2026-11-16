"""Raeume, Zuhoerer-Token mit Ablaufzeit, Puffer (Regel 1).

Alles nur im Arbeitsspeicher. Tokens werden nur als SHA-256-Hash gehalten.
Beim Schliessen eines Raums werden Tokens, Zuhoerer und Puffer geloescht.
"""
from __future__ import annotations

import asyncio
import hashlib
import itertools
import secrets
import time
from collections import Counter, deque
from dataclasses import dataclass
from typing import Callable, Optional

from .config import Settings
from .messages import SUPPORTED_LANGS, control_message
from .turns import FREI, FlowTracker, TurnLimits, TurnManager

MODES = ("vortrag", "gespraech")   # genau zwei Betriebsarten (Vorgabe des Nutzers): durchgehend sprechen / abwechselnd mit Sperre


class RoomError(Exception):
    pass


class TokenError(RoomError):
    """Token unbekannt, abgelaufen oder Raum geschlossen."""


class RoomFullError(RoomError):
    pass


class LanguageError(RoomError):
    """Sprache nicht angeboten oder nicht erlaubt."""


END = object()   # Marker in Zuhoererwarteschlange: Sitzung beendet


def _audio_seconds(message: dict) -> float:
    """Ungefaehre Laenge des Tons einer Nachricht in Sekunden (WAV, 16 Bit mono); 0, wenn kein Ton."""
    a = message.get("audio")
    if not isinstance(a, dict) or not a.get("data_b64") or not a.get("sample_rate"):
        return 0.0
    return max(0.0, (len(a["data_b64"]) * 3 / 4 - 44) / (2 * float(a["sample_rate"])))


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass
class TokenInfo:
    lang: Optional[str]          # None = Sammel-Link: Zuhoerer waehlt die Sprache selbst
    expires_at: float


class Listener:
    """Ein verbundener Zuhoerer. Langsame Clients verlieren alte Nachrichten, nie der Server."""
    def __init__(self, fixed_lang: Optional[str], expires_at: float, maxsize: int = 500):
        self.id = secrets.token_hex(4)          # zufaellig (kein globaler Zaehler): verraet weder Reihenfolge noch Anzahl
        self.fixed_lang = fixed_lang     # Sprache des Links (falls festgelegt)
        self.lang: Optional[str] = fixed_lang   # aktuell gewaehlte Sprache, None bis zur Auswahl
        self.expires_at = expires_at
        self.queue: asyncio.Queue = asyncio.Queue(maxsize)
        self.dropped = 0

    def push(self, item) -> None:
        if self.queue.full():
            try:
                self.queue.get_nowait()
                self.dropped += 1
            except asyncio.QueueEmpty:
                pass
        self.queue.put_nowait(item)


class Room:
    def __init__(self, room_id: str, settings: Settings, clock: Callable[[], float],
                 langs: Optional[tuple] = None, mode: str = "vortrag"):
        if mode not in MODES:
            raise RoomError(f"Betriebsart unbekannt: {mode}")
        self.id = room_id
        self.mode = mode
        self.strict = mode == "gespraech"                        # echte Sperre: erst weitersprechen, wenn alles angekommen ist
        self._operator_q: asyncio.Queue = asyncio.Queue(2000)   # Nachrichten an den Bedienplatz (Gast-Aussagen, Zustand)
        self.turns = TurnManager(limits=TurnLimits(idle_s=settings.turn_idle_s), on_change=self._turn_changed)  # Sperre im Gespraechsmodus
        self.flow = FlowTracker(on_change=self._flow_changed)   # Vortrag: nur Anzeige, ob noch etwas laeuft
        self._delivery: dict[tuple[int, str], dict] = {}        # (seq, sprache) -> wer hat es bekommen/angezeigt/gesprochen (nur Zaehler, keine Inhalte)
        self.settings = settings
        self.langs: tuple[str, ...] = tuple(langs) if langs else tuple(settings.default_langs)
        self._clock = clock
        self.created_at = clock()
        self.expires_at = self.created_at + settings.room_ttl_s
        self.closed = False
        self.operator_active = False
        self.counters: Counter = Counter()      # nur Zaehler, nie Inhalte
        self._tokens: dict[str, TokenInfo] = {}
        self._listeners: dict[int, Listener] = {}
        self._ring: dict[str, deque] = {}
        self._seq = itertools.count(0)

    # --- Tokens ---
    def create_listener_token(self, lang: Optional[str] = None,
                              ttl_s: Optional[int] = None) -> tuple[str, float]:
        """lang=None erzeugt einen Sammel-Link (alle Sprachen des Raums, Auswahl durch den Zuhoerer)."""
        self._ensure_open()
        s = self.settings
        if lang is not None and (lang not in SUPPORTED_LANGS or lang not in self.langs):
            raise RoomError(f"Sprache nicht aktiviert: {lang}")
        ttl = s.listener_ttl_s if ttl_s is None else ttl_s
        if not (s.min_listener_ttl_s <= ttl <= s.max_listener_ttl_s):
            raise RoomError(f"ttl_s muss zwischen {s.min_listener_ttl_s} und {s.max_listener_ttl_s} liegen")
        now = self._clock()
        expires_at = min(now + ttl, self.expires_at)
        token = secrets.token_urlsafe(24)       # 192 Bit Zufall
        self._tokens[_hash(token)] = TokenInfo(lang, expires_at)
        return token, expires_at

    def _resolve(self, token: str) -> TokenInfo:
        if self.closed:
            raise TokenError("Raum geschlossen")
        info = self._tokens.get(_hash(token))
        if info is None:
            raise TokenError("Token unbekannt")
        if self._clock() >= info.expires_at:
            self._tokens.pop(_hash(token), None)
            raise TokenError("Token abgelaufen")
        return info

    def has_token(self, token: str) -> bool:
        try:
            self._resolve(token)
            return True
        except TokenError:
            return False

    # --- Zuhoerer ---
    def attach_listener(self, token: str) -> Listener:
        info = self._resolve(token)
        if len(self._listeners) >= self.settings.max_listeners_per_room:
            raise RoomFullError("Zu viele Zuhoerer")
        if self.mode == "gespraech" and len(self._listeners) >= self.settings.max_guests:
            raise RoomFullError("Zu viele Gaeste")
        lst = Listener(info.lang, info.expires_at)
        while lst.id in self._listeners:           # Kennung ist zufaellig: bei (sehr unwahrscheinlicher) Doppelung neu ziehen
            lst = Listener(info.lang, info.expires_at)
        self._listeners[lst.id] = lst
        self.counters["listeners_total"] += 1
        self.counters["listeners_peak"] = max(self.counters["listeners_peak"], len(self._listeners))
        return lst

    def select_language(self, listener: Listener, lang: str) -> None:
        """Zuhoerer waehlt oder wechselt die Sprache (nur bei Sammel-Link)."""
        if self.closed or listener.id not in self._listeners:
            raise RoomError("Zuhoerer nicht mehr verbunden")
        if lang not in self.langs:
            raise LanguageError(f"Sprache nicht angeboten: {lang}")
        if listener.fixed_lang is not None and lang != listener.fixed_lang:
            raise LanguageError("Dieser Link gilt nur fuer eine Sprache")
        listener.lang = lang

    def detach_listener(self, listener: Listener) -> None:
        self._listeners.pop(listener.id, None)

    def listener_counts(self) -> dict[str, int]:
        c = Counter(l.lang for l in self._listeners.values() if l.lang is not None)
        return dict(c)

    def active_languages(self) -> list[str]:
        """Nur Sprachen mit mindestens einem Zuhoerer werden uebersetzt (spart GPU)."""
        return sorted({l.lang for l in self._listeners.values() if l.lang is not None})

    def replay(self, lang: str) -> list[dict]:
        """Letzte Untertitel der Sprache, hoechstens HISTORY_S alt (aeltere werden hier geloescht); mit age_s."""
        ring = self._ring.get(lang)
        if not ring:
            return []
        now = self._clock()
        while ring and now - ring[0][0] > self.settings.history_s:
            ring.popleft()
        return [{**m, "age_s": round(now - t, 1)} for t, m in ring]

    # --- Nachrichten ---
    def next_seq(self) -> int:
        return next(self._seq)

    def publish(self, lang: str, message: dict) -> int:
        """Verteilt an alle Zuhoerer der Sprache. Gibt die Anzahl Empfaenger zurueck."""
        if self.closed:
            return 0
        n = self.settings.ring_buffer_size
        if n > 0:
            ring = self._ring.setdefault(lang, deque(maxlen=n))
            ring.append((self._clock(), {**message, "audio": None, "replay": True}))   # ohne Audio
        delivered = 0
        devices: list[str] = []
        for l in self._listeners.values():
            if l.lang == lang:
                l.push(message)
                delivered += 1
                if isinstance(message.get("seq"), int):
                    self.tracker.expect_playback(message["seq"], f"gast:{l.id}", _audio_seconds(message))   # Geraet muss "fertig" melden
                    devices.append(f"gast:{l.id}")
        self.counters["messages_out"] += delivered
        if devices and isinstance(message.get("seq"), int):
            self._delivery[(message["seq"], lang)] = {"exp": set(devices), "shown": set(), "played": set(), "audio": bool(message.get("audio"))}
            while len(self._delivery) > 100:
                self._delivery.pop(next(iter(self._delivery)))
            self._push_delivery(message["seq"], lang)
        return delivered

    # --- Gespraechsmodus ---
    def _turn_changed(self, snapshot: dict) -> None:
        """Zustand der Sperre an alle Geraete verteilen (nur Zustand und Rolle, keine Inhalte)."""
        msg = control_message("turn", **snapshot)
        self.push_operator(msg)
        for l in self._listeners.values():
            l.push(msg)

    @property
    def tracker(self):
        """Gespraech: TurnManager (echte Sperre), Vortrag: FlowTracker (nur Zaehler fuer die Anzeige)."""
        return self.turns if self.strict else self.flow

    def _flow_changed(self, snapshot: dict) -> None:
        self.push_operator(control_message("flow", **snapshot))

    def _push_delivery(self, seq: int, lang: str) -> None:
        d = self._delivery.get((seq, lang))
        if d is not None:
            self.push_operator(control_message("delivery", seq=seq, lang=lang, expected=len(d["exp"]), shown=len(d["shown"]),
                                                 played=len(d["played"]), audio=d["audio"]))

    def ack(self, device: str, seq: int, kind: str) -> None:
        """Zuhoerer-Geraet meldet "angezeigt" (shown) oder "fertig gesprochen" (played) fuer eine Nachricht."""
        for (s, lang), d in list(self._delivery.items()):
            if s == seq and device in d["exp"]:
                d["shown"].add(device)
                if kind == "played":
                    d["played"].add(device)
                self._push_delivery(s, lang)
        if kind == "played":
            self.tracker.playback_done(seq, device)

    def push_operator(self, message: dict) -> None:
        if self.closed:
            return
        if self._operator_q.full():
            try:
                self._operator_q.get_nowait()
            except asyncio.QueueEmpty:
                pass
        self._operator_q.put_nowait(message)

    async def next_operator_message(self, timeout: float) -> Optional[dict]:
        try:
            return await asyncio.wait_for(self._operator_q.get(), timeout)
        except asyncio.TimeoutError:
            return None

    # --- Lebenszyklus ---
    def close(self) -> None:
        """Sitzungsende: alles loeschen, Zuhoerer benachrichtigen."""
        if self.closed:
            return
        self.closed = True
        for l in list(self._listeners.values()):
            l.push(END)
        self._listeners.clear()
        self._tokens.clear()
        self._ring.clear()
        self._delivery.clear()
        self.turns.release()
        self.operator_active = False

    def _ensure_open(self) -> None:
        if self.closed:
            raise RoomError("Raum geschlossen")

    def stats(self) -> dict:
        return {
            "room_open": not self.closed,
            "langs": list(self.langs),
            "mode": self.mode,
            "turn": self.turns.snapshot(),
            "listeners_connected": len(self._listeners),
            "operator_active": self.operator_active,
            "listeners": self.listener_counts(),
            "counters": dict(self.counters),
        }


class RoomManager:
    def __init__(self, settings: Settings, clock: Callable[[], float] = time.time):
        self.settings = settings
        self._clock = clock
        self._rooms: dict[str, Room] = {}

    def create_room(self, langs: Optional[list] = None, mode: Optional[str] = None) -> Room:
        if langs is not None:
            bad = [l for l in langs if l not in self.settings.target_langs]
            if bad or not langs:
                raise LanguageError(f"Sprachen nicht erlaubt oder leer: {bad or langs}")
        room = Room(secrets.token_urlsafe(12), self.settings, self._clock, langs, mode or "vortrag")
        self._rooms[room.id] = room
        return room

    def get(self, room_id: str) -> Optional[Room]:
        r = self._rooms.get(room_id)
        return r if r and not r.closed else None

    def close_room(self, room_id: str) -> bool:
        r = self._rooms.pop(room_id, None)
        if r is None:
            return False
        r.close()
        return True

    def attach_listener(self, token: str) -> tuple[Room, Listener]:
        for room in list(self._rooms.values()):
            if room.closed:
                continue
            if room.has_token(token):
                return room, room.attach_listener(token)
        raise TokenError("Token ungueltig")

    def purge_expired(self) -> int:
        """Schliesst Raeume nach ROOM_TTL_S. Gibt die Anzahl geschlossener Raeume zurueck."""
        now = self._clock()
        expired = [rid for rid, r in self._rooms.items() if r.closed or now >= r.expires_at]
        for rid in expired:
            self.close_room(rid)
        return len(expired)

    def __len__(self) -> int:
        return len(self._rooms)

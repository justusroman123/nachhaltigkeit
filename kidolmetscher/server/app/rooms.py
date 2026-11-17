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
    return hashlib.sha256(token.encode("utf-8", "surrogatepass")).hexdigest()     # auch Muell wie ein einzelnes Surrogat darf nicht abstuerzen


class MsgQueue:
    """Begrenzte Nachrichtenschlange. Bei Ueberlauf fliegt zuerst der aelteste reine Zustandswert (turn/delivery/flow/pong) raus,
    Inhalte (Untertitel, Gast-Aussagen) nur, wenn nichts anderes mehr da ist; jede Verwerfung wird gezaehlt (nie still)."""
    SOFT = ("turn", "delivery", "flow", "pong", "operator")

    def __init__(self, maxsize: int):
        self._d: deque = deque()
        self._max = maxsize
        self._ev = asyncio.Event()
        self.dropped = 0              # verworfene Nachrichten insgesamt
        self.lost_content = 0         # davon Inhalte (seit der letzten Abfrage mit take_lost)

    def put_nowait(self, item) -> None:
        if len(self._d) >= self._max:
            for i, x in enumerate(self._d):
                if isinstance(x, dict) and x.get("type") in self.SOFT:
                    del self._d[i]
                    break
            else:
                self._d.popleft()
                self.lost_content += 1
            self.dropped += 1
        self._d.append(item)
        self._ev.set()

    async def get(self):
        while not self._d:
            self._ev.clear()
            await self._ev.wait()
        item = self._d.popleft()
        if not self._d:
            self._ev.clear()
        return item

    def get_nowait(self):
        if not self._d:
            raise asyncio.QueueEmpty
        return self._d.popleft()

    def clear(self) -> None:
        self._d.clear()
        self._ev.clear()

    def qsize(self) -> int:
        return len(self._d)

    def full(self) -> bool:
        return len(self._d) >= self._max

    def take_lost(self) -> int:
        n, self.lost_content = self.lost_content, 0
        return n


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
        self.queue = MsgQueue(maxsize)

    @property
    def dropped(self) -> int:
        return self.queue.dropped

    def push(self, item) -> None:
        self.queue.put_nowait(item)


class Room:
    def __init__(self, room_id: str, settings: Settings, clock: Callable[[], float],
                 langs: Optional[tuple] = None, mode: str = "vortrag", turn_clock: Optional[Callable[[], float]] = None):
        if mode not in MODES:
            raise RoomError(f"Betriebsart unbekannt: {mode}")
        self.id = room_id
        self.mode = mode
        self.strict = mode == "gespraech"                        # echte Sperre: erst weitersprechen, wenn alles angekommen ist
        self._operator_q = MsgQueue(2000)                       # Nachrichten an den Bedienplatz (Gast-Aussagen, Zustand)
        limits = TurnLimits(idle_s=settings.turn_idle_s, pickup_s=settings.turn_pickup_s, process_max_s=settings.turn_process_max_s,
                            play_max_s=settings.turn_play_max_s, grace_s=settings.turn_grace_s)
        tkw = {"clock": turn_clock} if turn_clock else {}       # Uhr der Sperre: Standard monotonic (Tests koennen eine eigene einspeisen)
        self.turns = TurnManager(limits=limits, on_change=self._turn_changed, **tkw)  # Sperre im Gespraechsmodus
        self.flow = FlowTracker(on_change=self._flow_changed)   # Vortrag: nur Anzeige, ob noch etwas laeuft
        self._delivery: dict[tuple[int, str], dict] = {}        # (seq, sprache) -> wer hat es bekommen/angezeigt/gesprochen (nur Zaehler, keine Inhalte)
        self.settings = settings
        self.langs: tuple[str, ...] = tuple(langs) if langs else tuple(settings.default_langs)
        self._clock = clock
        self.created_at = clock()
        self.expires_at = self.created_at + settings.room_ttl_s
        self.closed = False
        self._operator_active = False
        self._operator_seen = clock()           # Zeitpunkt, zu dem zuletzt ein Bedienplatz verbunden war (oder der Raum entstand)
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
        self.purge_tokens()
        if len(self._tokens) >= s.max_tokens_per_room:
            raise RoomError(f"Zu viele Zuhoerer-Links in diesem Raum (hoechstens {s.max_tokens_per_room})")
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

    def purge_tokens(self) -> int:
        """Abgelaufene Zuhoerer-Links entfernen (nur Hashes, aber nichts muss laenger als noetig im Speicher stehen)."""
        now = self._clock()
        gone = [h for h, t in self._tokens.items() if now >= t.expires_at]
        for h in gone:
            self._tokens.pop(h, None)
        return len(gone)

    def purge_history(self) -> None:
        """Verlauf aktiv kuerzen: Untertitel aelter als history_s werden geloescht, auch wenn niemand sie abruft (Datenminimierung)."""
        now = self._clock()
        for lang, ring in list(self._ring.items()):
            while ring and now - ring[0][0] > self.settings.history_s:
                ring.popleft()
            if not ring:
                self._ring.pop(lang, None)

    def idle_s(self) -> float:
        """Wie lange ist kein Bedienplatz verbunden (0, solange einer verbunden ist)."""
        return 0.0 if self._operator_active else max(0.0, self._clock() - self._operator_seen)

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
        # Der Link gilt nur zum BEITRETEN (_resolve prueft das). Wer verbunden ist, bleibt bis zum Ende der Sitzung verbunden:
        # ein Gespraech oder Vortrag wird nicht mitten im Satz abgeschnitten, nur weil die Gueltigkeit des Links abgelaufen ist.
        lst = Listener(info.lang, self.expires_at)
        while lst.id in self._listeners:           # Kennung ist zufaellig: bei (sehr unwahrscheinlicher) Doppelung neu ziehen
            lst = Listener(info.lang, self.expires_at)
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

    @property
    def operator_active(self) -> bool:
        return self._operator_active

    @operator_active.setter
    def operator_active(self, value: bool) -> None:
        """Bedienplatz verbunden/getrennt. Die Zuhoerer erfahren es (Anzeige "Mitarbeiter nicht verbunden")."""
        value = bool(value)
        if value == self._operator_active:
            return
        self._operator_active = value
        self._operator_seen = self._clock()
        if not self.closed and self.mode == "gespraech":
            msg = control_message("operator", online=value)
            for l in self._listeners.values():
                l.push(msg)

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
                before = (len(d["shown"]), len(d["played"]))
                d["shown"].add(device)
                if kind == "played":
                    d["played"].add(device)
                if (len(d["shown"]), len(d["played"])) != before:      # nur echte Aenderungen weitergeben (kein Fluten durch Wiederholungen)
                    self._push_delivery(s, lang)
        if kind == "played":
            self.tracker.playback_done(seq, device)

    def push_operator(self, message: dict) -> None:
        if self.closed:
            return
        self._operator_q.put_nowait(message)

    async def next_operator_message(self, timeout: float) -> Optional[dict]:
        try:
            return await asyncio.wait_for(self._operator_q.get(), timeout)
        except asyncio.TimeoutError:
            return None

    def take_lost_operator_messages(self) -> int:
        """Inhalte fuer den Bedienplatz, die wegen Ueberlaufs verworfen wurden (seit der letzten Abfrage); sie werden gezaehlt und gemeldet."""
        n = self._operator_q.take_lost()
        if n:
            self.counters["operator_messages_lost"] += n
        return n

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
        self._operator_q.clear()               # deutscher Quelltext, Gast-Aussagen und Sprachausgabe fuer den Bedienplatz: weg
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
            "counters": {**self.counters, "operator_queue_dropped": self._operator_q.dropped,
                         "listener_queue_dropped": sum(l.dropped for l in self._listeners.values())},
        }


class RoomManager:
    def __init__(self, settings: Settings, clock: Callable[[], float] = time.time,
                 turn_clock: Optional[Callable[[], float]] = None):
        self.settings = settings
        self._clock = clock
        self._turn_clock = turn_clock
        self._rooms: dict[str, Room] = {}

    def create_room(self, langs: Optional[list] = None, mode: Optional[str] = None) -> Room:
        if langs is not None:
            bad = [l for l in langs if l not in self.settings.target_langs]
            if bad or not langs:
                raise LanguageError(f"Sprachen nicht erlaubt oder leer: {bad or langs}")
        if len(self.all_rooms()) >= self.settings.max_rooms:
            raise RoomError(f"Zu viele offene Raeume (hoechstens {self.settings.max_rooms}); bitte eine Sitzung beenden")
        room = Room(secrets.token_urlsafe(12), self.settings, self._clock, langs, mode or "vortrag", self._turn_clock)
        self._rooms[room.id] = room
        return room

    def get(self, room_id: str) -> Optional[Room]:
        r = self._rooms.get(room_id)
        return r if r and not r.closed else None

    def all_rooms(self) -> list[Room]:
        return [r for r in list(self._rooms.values()) if not r.closed]

    def room_ids(self) -> list[str]:
        return list(self._rooms)

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
        expired = [rid for rid, r in self._rooms.items()
                   if r.closed or now >= r.expires_at or r.idle_s() >= self.settings.room_idle_s]    # auch: lange ohne Bedienplatz
        for rid in expired:
            self.close_room(rid)
        for r in self._rooms.values():
            r.purge_tokens()
        return len(expired)

    def __len__(self) -> int:
        return len(self._rooms)

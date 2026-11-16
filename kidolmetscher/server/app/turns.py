"""Sperrlogik fuer den Gespraechsmodus: immer nur EINE Person spricht, solange gesprochen, uebersetzt oder
vorgelesen wird, ist das Sprechen fuer alle anderen gesperrt. Reine Logik ohne Netz und ohne Inhalte (nur Zustaende,
Zaehler und Geraete-Kennungen); die Uhr ist austauschbar fuer Tests.

Zustaende: frei -> spricht -> uebersetzt -> wiedergabe -> frei
  frei        niemand spricht; jeder darf "Sprechen" antippen (wer zuerst kommt)
  spricht     eine Person spricht, so lange sie moechte (Ende: "Fertig", Stopp durch den Mitarbeiter oder lange Stille)
  uebersetzt  der Server verarbeitet noch Abschnitte der Aussage
  wiedergabe  Ergebnisse sind verteilt; wartet, bis alle Empfaenger "fertig" melden (Ton zu Ende / Text angezeigt)
Sprechen wird nie zeitlich begrenzt. Nur lange STILLE gibt das Wort frei (idle_s). Zeitgrenzen in uebersetzt/wiedergabe
verhindern, dass ein haengendes Geraet alle blockiert; "freigeben" (Mitarbeiter) beendet alles sofort.
Vorrang: Der Mitarbeiter ("staff") kann jede andere Person sofort stoppen (take_over); Gaeste koennen niemanden stoppen,
sondern sich nur melden (request): der Sprechende wird benachrichtigt, nicht unterbrochen, und der Naechste bekommt das Wort
automatisch, sobald alles fertig ist.
"""
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

FREI, SPRICHT, UEBERSETZT, WIEDERGABE = "frei", "spricht", "uebersetzt", "wiedergabe"


@dataclass
class TurnLimits:
    idle_s: float = 120.0           # so lange ohne hoerbare Sprache, dann gibt der Server das Wort frei; Redezeit ist NICHT begrenzt (Annahme, im Test pruefen)
    pickup_s: float = 30.0          # automatisch uebernommene Wortmeldung: so lange darauf warten, dass das Geraet "Sprechen" bestaetigt (Annahme)
    process_max_s: float = 90.0     # laengste Verarbeitung nach dem Sprechen; Vollstaendigkeit geht vor (Annahme, messen)
    play_max_s: float = 15.0        # Mindest-Wartezeit auf "fertig" der Geraete; dazu kommt die Laenge des erwarteten Tons (Annahme)
    grace_s: float = 0.5            # kurze Schonfrist nach "alle fertig", bevor frei gemeldet wird (Annahme)


@dataclass
class TurnManager:
    limits: TurnLimits = field(default_factory=TurnLimits)
    clock: Callable[[], float] = time.monotonic
    on_change: Optional[Callable[[dict], None]] = None

    def __post_init__(self) -> None:
        self.state = FREI
        self.who: Optional[str] = None          # "staff" oder "gast:<kennung>"
        self.pending = 0                         # Abschnitte, die noch verarbeitet werden
        self.awaiting: set[tuple[int, str]] = set()   # (seq, geraet): noch kein "fertig"
        self._play_s: dict[str, float] = {}      # je Geraet: Summe der erwarteten Tonlaenge in s
        self._deadline: Optional[float] = None
        self._free_at: Optional[float] = None    # Schonfrist laeuft bis dahin
        self._pickup = False                     # Wort wurde automatisch uebergeben, Geraet hat noch nicht bestaetigt
        self.waiting: list[str] = []             # Wortmeldungen in Reihenfolge; wer dran ist, bekommt das Wort automatisch

    # ---------- Hilfen ----------
    def _set(self, state: str, who: Optional[str], limit_s: Optional[float], reason: str = "") -> None:
        self.state, self.who = state, who
        self._deadline = self.clock() + limit_s if limit_s else None
        self._free_at = None
        self._pickup = False
        if state == FREI:
            self.pending = 0
            self.awaiting.clear()
            self._play_s.clear()
            if self.waiting:                     # naechste Wortmeldung bekommt das Wort sofort (kein Dazwischenfunken)
                nxt = self.waiting.pop(0)
                self.state, self.who = SPRICHT, nxt
                self._deadline = self.clock() + self.limits.pickup_s
                self._pickup = True
                reason = "naechster"
        if self.on_change:
            self.on_change(self.snapshot(reason))

    def snapshot(self, reason: str = "") -> dict:
        return {"state": self.state, "who": self.who, "reason": reason, "waiting": list(self.waiting)}

    # ---------- Ablauf ----------
    def claim(self, who: str) -> tuple[bool, str]:
        """Jemand moechte sprechen. Nur im Zustand frei; wer zuerst kommt, bekommt das Wort."""
        self.tick()
        if self.state == SPRICHT and self.who == who:         # schon dran (z. B. nach Wortmeldung automatisch uebernommen)
            if self._pickup:
                self._pickup = False
                self._deadline = self.clock() + self.limits.idle_s
            return True, ""
        if self.state != FREI:
            return False, "busy"
        self._set(SPRICHT, who, self.limits.idle_s)
        return True, ""

    def touch(self, who: str) -> None:
        """Hoerbare Sprache des Sprechenden: verschiebt die Frist der Freigabe bei Stille (Redezeit bleibt unbegrenzt)."""
        if self.state == SPRICHT and self.who == who:
            self._pickup = False
            self._deadline = self.clock() + self.limits.idle_s

    def take_over(self, who: str) -> tuple[bool, str]:
        """Vorrang des Mitarbeiters ("Stopp"): sofort das Wort, auch wenn eine andere Person spricht oder noch uebersetzt bzw.
        vorgelesen wird. Rueckgabe (ok, Kennung der unterbrochenen Person oder ""). Laeuft noch die eigene Aussage des
        Mitarbeiters (Verteilung an die Gaeste), wird sie nicht abgebrochen: (False, "eigene_aussage")."""
        if who != "staff":                                       # Vorrang gibt es nur fuer den Mitarbeiter, Gaeste koennen sich nur melden
            return False, "nicht_erlaubt"
        ok, _ = self.claim(who)                                  # frei oder schon dran
        if ok:
            return True, ""
        if self.who == who:
            return False, "eigene_aussage"
        prev = self.who or ""
        self.awaiting = {a for a in self.awaiting if a[1] != who}     # was dem Mitarbeiter noch vorgelesen werden sollte, entfaellt
        self._play_s.pop(who, None)
        if who in self.waiting:
            self.waiting.remove(who)
        self._set(SPRICHT, who, self.limits.idle_s, "unterbrochen")   # noch laufende Verarbeitung der Aussage davor bleibt erhalten (pending)
        return True, prev

    def request(self, who: str) -> str:
        """Wortmeldung: "Ich moechte auch sprechen". Ist frei, bekommt man das Wort sofort; sonst wird man vorgemerkt,
        der Sprechende wird nur benachrichtigt (keine Unterbrechung). Rueckgabe: "dran" | "vorgemerkt" """
        ok, _ = self.claim(who)
        if ok:
            return "dran"
        if who not in self.waiting:
            self.waiting.append(who)
            if self.on_change:
                self.on_change(self.snapshot("wortmeldung"))
        return "vorgemerkt"

    def cancel_request(self, who: str) -> None:
        if who in self.waiting:
            self.waiting.remove(who)
            if self.on_change:
                self.on_change(self.snapshot("wortmeldung_zurueck"))

    def end_speaking(self, who: str) -> None:
        """Aussage zu Ende ("Fertig", lange Stille oder Geraet weg)."""
        if self.state == SPRICHT and self.who == who:
            self._set(UEBERSETZT, who, self.limits.process_max_s)
            self._advance()

    def segment_started(self) -> None:
        if self.state in (SPRICHT, UEBERSETZT):
            self.pending += 1

    def segment_done(self) -> None:
        if self.pending > 0:
            self.pending -= 1
        self._advance()

    def expect_playback(self, seq: int, device: str, audio_s: float = 0.0) -> None:
        """Eine Ausgabe wurde an ein Geraet geschickt; es muss "fertig" melden. audio_s: Laenge des Tons (verlaengert die Zeitgrenze)."""
        if self.state != FREI:
            self.awaiting.add((seq, device))
            self._play_s[device] = self._play_s.get(device, 0.0) + max(0.0, audio_s)

    def playback_done(self, seq: int, device: str) -> None:
        self.awaiting.discard((seq, device))
        self._advance()

    def device_left(self, device: str) -> None:
        """Geraet getrennt: nicht mehr warten; spricht es gerade, gilt die Aussage als beendet."""
        self.awaiting = {a for a in self.awaiting if a[1] != device}
        self.cancel_request(device)
        if self.who == device and self.state == SPRICHT:
            self.end_speaking(device)
        self._advance()

    def release(self) -> None:
        """Notbremse (Mitarbeiter): sofort wieder frei; auch Wortmeldungen werden zurueckgesetzt."""
        self.waiting.clear()
        if self.state != FREI:
            self._set(FREI, None, None, "freigegeben")

    def _advance(self) -> None:
        if self.state == UEBERSETZT and self.pending == 0:
            play = max(self._play_s.values(), default=0.0)       # laengster erwarteter Ton eines Geraets
            self._set(WIEDERGABE, self.who, max(self.limits.play_max_s, play + 8.0))
        if self.state == WIEDERGABE and not self.awaiting and self._free_at is None:
            self._free_at = self.clock() + self.limits.grace_s

    def tick(self) -> None:
        """Zeitgrenzen pruefen; regelmaessig aufrufen (z. B. alle 200 ms und vor jeder Anfrage)."""
        now = self.clock()
        if self.state == FREI:
            return
        if self.state == WIEDERGABE and self._free_at is not None and now >= self._free_at:
            return self._set(FREI, None, None)
        if self._deadline is not None and now >= self._deadline:
            if self.state == SPRICHT:
                self._set(UEBERSETZT, self.who, self.limits.process_max_s, "inaktiv")        # lange Stille (keine Redezeit-Grenze)
                self._advance()
            elif self.state == UEBERSETZT:
                self.pending = 0
                self._set(WIEDERGABE, self.who, self.limits.play_max_s, "zeitgrenze_uebersetzung")
                self._advance()
            else:
                self._set(FREI, None, None, "zeitgrenze_wiedergabe")


@dataclass
class FlowTracker:
    """Vortrag: keine Sperre, aber der Bedienplatz erfaehrt, ob noch etwas verarbeitet wird oder noch nicht alle Geraete
    "fertig" gemeldet haben (Anzeige STOPP bis alles angekommen ist). Gleiche Schnittstelle wie TurnManager."""
    clock: Callable[[], float] = time.monotonic
    on_change: Optional[Callable[[dict], None]] = None
    ack_base_s: float = 15.0         # Mindest-Wartezeit auf "fertig" je Ausgabe; dazu kommt die Tonlaenge (Annahme)

    def __post_init__(self) -> None:
        self.pending = 0
        self.awaiting: dict[tuple[int, str], float] = {}     # (seq, geraet) -> Zeitgrenze
        self._dev_audio: dict[str, float] = {}
        self._busy = False
        self.timeouts = 0

    @property
    def busy(self) -> bool:
        return self.pending > 0 or bool(self.awaiting)

    def snapshot(self) -> dict:
        return {"busy": self.busy, "pending": self.pending, "awaiting": len(self.awaiting)}

    def _notify(self) -> None:
        if self.busy != self._busy:
            self._busy = self.busy
            if self.on_change:
                self.on_change(self.snapshot())

    def segment_started(self) -> None:
        self.pending += 1
        self._notify()

    def segment_done(self) -> None:
        self.pending = max(0, self.pending - 1)
        self._notify()

    def expect_playback(self, seq: int, device: str, audio_s: float = 0.0) -> None:
        self._dev_audio[device] = self._dev_audio.get(device, 0.0) + max(0.0, audio_s)
        self.awaiting[(seq, device)] = self.clock() + self.ack_base_s + self._dev_audio[device]
        self._notify()

    def playback_done(self, seq: int, device: str) -> None:
        self.awaiting.pop((seq, device), None)
        if not any(d == device for _, d in self.awaiting):
            self._dev_audio.pop(device, None)
        self._notify()

    def device_left(self, device: str) -> None:
        self.awaiting = {k: v for k, v in self.awaiting.items() if k[1] != device}
        self._dev_audio.pop(device, None)
        self._notify()

    def tick(self) -> int:
        """Abgelaufene Erwartungen entfernen (Geraet meldet nie "fertig"); gibt deren Anzahl zurueck."""
        now = self.clock()
        expired = [k for k, v in self.awaiting.items() if now >= v]
        for k in expired:
            self.awaiting.pop(k, None)
        if expired:
            self.timeouts += len(expired)
            self._notify()
        return len(expired)

"""Sperrlogik fuer den Gespraechsmodus: immer nur EINE Person spricht, solange gesprochen, uebersetzt oder
vorgelesen wird, ist das Sprechen fuer alle anderen gesperrt. Reine Logik ohne Netz und ohne Inhalte (nur Zustaende,
Zaehler und Geraete-Kennungen); die Uhr ist austauschbar fuer Tests.

Zustaende: frei -> spricht -> uebersetzt -> wiedergabe -> frei
  frei        niemand spricht; jeder darf "Sprechen" antippen (wer zuerst kommt)
  spricht     eine Person spricht (Ende: Pause, Antippen oder Zeitgrenze)
  uebersetzt  der Server verarbeitet noch Abschnitte der Aussage
  wiedergabe  Ergebnisse sind verteilt; wartet, bis alle Empfaenger "fertig" melden (Ton zu Ende / Text angezeigt)
Zeitgrenzen verhindern, dass ein haengendes Geraet alle blockiert; "freigeben" (Mitarbeiter) beendet alles sofort.
"""
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

FREI, SPRICHT, UEBERSETZT, WIEDERGABE = "frei", "spricht", "uebersetzt", "wiedergabe"


@dataclass
class TurnLimits:
    speak_max_s: float = 120.0      # laengste Aussage am Stueck (Annahme, messen)
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

    # ---------- Hilfen ----------
    def _set(self, state: str, who: Optional[str], limit_s: Optional[float], reason: str = "") -> None:
        self.state, self.who = state, who
        self._deadline = self.clock() + limit_s if limit_s else None
        self._free_at = None
        if state == FREI:
            self.pending = 0
            self.awaiting.clear()
            self._play_s.clear()
        if self.on_change:
            self.on_change(self.snapshot(reason))

    def snapshot(self, reason: str = "") -> dict:
        return {"state": self.state, "who": self.who, "reason": reason}

    # ---------- Ablauf ----------
    def claim(self, who: str) -> tuple[bool, str]:
        """Jemand moechte sprechen. Nur im Zustand frei; wer zuerst kommt, bekommt das Wort."""
        self.tick()
        if self.state != FREI:
            return False, "busy"
        self._set(SPRICHT, who, self.limits.speak_max_s)
        return True, ""

    def end_speaking(self, who: str) -> None:
        """Aussage zu Ende (Pause erkannt, Antippen oder Zeitgrenze)."""
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
        if self.who == device and self.state == SPRICHT:
            self.end_speaking(device)
        self._advance()

    def release(self) -> None:
        """Notbremse (Mitarbeiter): sofort wieder frei."""
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
                self._set(UEBERSETZT, self.who, self.limits.process_max_s, "zeitgrenze_sprechen")
                self._advance()
            elif self.state == UEBERSETZT:
                self.pending = 0
                self._set(WIEDERGABE, self.who, self.limits.play_max_s, "zeitgrenze_uebersetzung")
                self._advance()
            else:
                self._set(FREI, None, None, "zeitgrenze_wiedergabe")

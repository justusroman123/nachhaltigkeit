"""Sperrlogik fuer den Gespraechsmodus: immer nur EINE Person spricht, solange gesprochen, uebersetzt oder
vorgelesen wird, ist das Sprechen fuer alle anderen gesperrt. Reine Logik ohne Netz und ohne Inhalte (nur Zustaende,
Zaehler und Geraete-Kennungen); die Uhr ist austauschbar fuer Tests.

Zustaende: frei -> spricht -> uebersetzt -> wiedergabe -> frei
  frei        niemand spricht; jeder darf "Sprechen" antippen (wer zuerst kommt)
  spricht     eine Person spricht, so lange sie moechte (Ende: "Fertig" oder Stopp durch den Mitarbeiter; eine Stille-Frist ist
              nur auf Wunsch eingeschaltet, idle_s > 0)
  uebersetzt  der Server verarbeitet noch Abschnitte der Aussage
  wiedergabe  Ergebnisse sind verteilt; wartet, bis alle Empfaenger "fertig" melden (Ton zu Ende / Text angezeigt)
Sprechen wird nie zeitlich begrenzt, auch Pausen nicht (idle_s = 0, Standard). Nur wenn idle_s > 0 gesetzt wird, gibt lange STILLE das Wort
frei. Zeitgrenzen in uebersetzt/wiedergabe
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
    idle_s: float = 0.0             # 0 = aus (Standard): nichts beendet eine Aussage von selbst, nur "Fertig" oder Stopp. > 0: so lange ohne hoerbare Sprache, dann gibt der Server das Wort frei
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
        self.pending = 0                         # Arbeiten der laufenden Runde, die noch nicht fertig sind (Abschnitte, offene Erkennungsstroeme)
        self.gen = 0                             # Runde: steigt bei jedem Wechsel nach "frei" und bei einer Zeitgrenze; spaete Meldungen aelterer Runden werden ignoriert
        self.utterance = 0                       # laufende Nummer der Aussagen (jede Wortuebergabe zaehlt); schuetzt vor verspaeteten Abschluessen
        self.awaiting: set[tuple[int, str]] = set()   # (seq, geraet): noch kein "fertig"
        self._play: dict[tuple[int, str], float] = {}  # erwartete Tonlaenge in s je (seq, geraet), solange "fertig" aussteht
        self._deadline: Optional[float] = None
        self._free_at: Optional[float] = None    # Schonfrist laeuft bis dahin
        self._pickup = False                     # Wort wurde automatisch uebergeben, Geraet hat noch nicht bestaetigt
        self.waiting: list[str] = []             # Wortmeldungen in Reihenfolge; wer dran ist, bekommt das Wort automatisch

    # ---------- Hilfen ----------
    def _idle_deadline(self) -> Optional[float]:
        """Frist der Stille-Frist; None, wenn sie ausgeschaltet ist (idle_s = 0)."""
        return self.clock() + self.limits.idle_s if self.limits.idle_s > 0 else None

    def _set(self, state: str, who: Optional[str], limit_s: Optional[float], reason: str = "") -> None:
        self.state, self.who = state, who
        self._deadline = self.clock() + limit_s if limit_s else None
        self._free_at = None
        self._pickup = False
        if state == SPRICHT:
            self.utterance += 1
        if state == FREI:
            self.pending = 0
            self.gen += 1                        # alles Laufende gehoert jetzt zu einer beendeten Runde
            self.awaiting.clear()
            self._play.clear()
            if self.waiting:                     # naechste Wortmeldung bekommt das Wort sofort (kein Dazwischenfunken)
                nxt = self.waiting.pop(0)
                self.state, self.who = SPRICHT, nxt
                self.utterance += 1
                self._deadline = self.clock() + self.limits.pickup_s
                self._pickup = True
                reason = "naechster"
        if self.on_change:
            self.on_change(self.snapshot(reason))

    def snapshot(self, reason: str = "") -> dict:
        return {"state": self.state, "who": self.who, "reason": reason, "waiting": list(self.waiting), "utterance": self.utterance}

    def _play_total(self, device: str) -> float:
        return sum(s for (_, d), s in self._play.items() if d == device)

    def _play_limit(self) -> float:
        """Wartezeit auf "fertig": mindestens play_max_s, bei erwartetem Ton die laengste noch offene Tonlaenge eines Geraets plus Reserve."""
        total = max((self._play_total(d) for d in {d for _, d in self._play}), default=0.0)
        return self.limits.play_max_s if total <= 0 else max(self.limits.play_max_s, total + 8.0)

    # ---------- Ablauf ----------
    def claim(self, who: str) -> tuple[bool, str]:
        """Jemand moechte sprechen. Nur im Zustand frei; wer zuerst kommt, bekommt das Wort."""
        self.tick()
        if self.state == SPRICHT and self.who == who:         # schon dran (z. B. nach Wortmeldung automatisch uebernommen)
            if self._pickup:
                self._pickup = False
                self._deadline = self._idle_deadline()
            return True, ""
        if self.state != FREI:
            return False, "busy"
        self._set(SPRICHT, who, self.limits.idle_s)
        return True, ""

    def touch(self, who: str) -> None:
        """Hoerbare Sprache des Sprechenden: verschiebt die Frist der Freigabe bei Stille (Redezeit bleibt unbegrenzt; ohne Stille-Frist gibt es keine Frist)."""
        if self.state == SPRICHT and self.who == who:
            self._pickup = False
            self._deadline = self._idle_deadline()

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
        self._play = {k: v for k, v in self._play.items() if k[1] != who}
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
        """Wortmeldung zurueckziehen. Wurde das Wort in diesem Moment schon uebergeben (noch nicht bestaetigt), geht es sofort zurueck."""
        if who in self.waiting:
            self.waiting.remove(who)
            if self.on_change:
                self.on_change(self.snapshot("wortmeldung_zurueck"))
        elif self.state == SPRICHT and self.who == who and self._pickup:
            self.end_speaking(who)

    def end_speaking(self, who: str, utterance: Optional[int] = None) -> None:
        """Aussage zu Ende ("Fertig", lange Stille oder Geraet weg). `utterance`: Nummer der Aussage, die enden soll; ein
        verspaeteter Abschluss einer frueheren Aussage beendet die neue nicht."""
        if self.state == SPRICHT and self.who == who and (utterance is None or utterance == self.utterance):
            self._set(UEBERSETZT, who, self.limits.process_max_s)
            self._advance()

    def segment_started(self) -> int:
        """Eine Arbeit beginnt (Abschnitt wird uebersetzt, Erkennungsstrom ist offen). Rueckgabe: Marke der Runde fuer segment_done()."""
        self.pending += 1
        return self.gen

    def segment_done(self, token: Optional[int] = None) -> None:
        """Arbeit beendet. Mit Marke zaehlt nur, was zur laufenden Runde gehoert (Spaetmeldungen frueherer Runden werden ignoriert)."""
        if token is not None and token != self.gen:
            return
        if self.pending > 0:
            self.pending -= 1
        self._advance()

    def expect_playback(self, seq: int, device: str, audio_s: float = 0.0) -> None:
        """Eine Ausgabe wurde an ein Geraet geschickt; es muss "fertig" melden. audio_s: Laenge des Tons (verlaengert die Zeitgrenze)."""
        if self.state == FREI:
            return
        self.awaiting.add((seq, device))
        self._play[(seq, device)] = max(0.0, audio_s)
        if self.state == WIEDERGABE:             # neue Ausgabe nach dem Wechsel: Schonfrist zuruecknehmen, Zeitgrenze neu setzen
            self._free_at = None
            self._deadline = max(self._deadline or 0.0, self.clock() + self._play_limit())

    def playback_done(self, seq: int, device: str) -> None:
        self.awaiting.discard((seq, device))
        self._play.pop((seq, device), None)
        self._advance()

    def device_left(self, device: str) -> None:
        """Geraet getrennt: nicht mehr warten; spricht es gerade, gilt die Aussage als beendet."""
        self.awaiting = {a for a in self.awaiting if a[1] != device}
        self._play = {k: v for k, v in self._play.items() if k[1] != device}
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
            self._set(WIEDERGABE, self.who, self._play_limit())
        if self.state == WIEDERGABE and not self.awaiting and self.pending == 0 and self._free_at is None:
            self._free_at = self.clock() + self.limits.grace_s

    def tick(self) -> None:
        """Zeitgrenzen pruefen; regelmaessig aufrufen (z. B. alle 200 ms und vor jeder Anfrage)."""
        now = self.clock()
        if self.state == FREI:
            return
        if self.state == WIEDERGABE and self._free_at is not None and now >= self._free_at:
            if not self.awaiting and self.pending == 0:
                return self._set(FREI, None, None)
            self._free_at = None                 # inzwischen ist wieder etwas offen: weiter warten
        if self._deadline is not None and now >= self._deadline:
            if self.state == SPRICHT:
                self._set(UEBERSETZT, self.who, self.limits.process_max_s, "inaktiv")        # nur mit eingeschalteter Stille-Frist (idle_s > 0); keine Redezeit-Grenze
                self._advance()
            elif self.state == UEBERSETZT:
                self.pending = 0
                self.gen += 1                    # haengende Verarbeitung der alten Runde zaehlt nicht mehr mit
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

    def segment_started(self) -> int:
        self.pending += 1
        self._notify()
        return 0

    def segment_done(self, token: Optional[int] = None) -> None:
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

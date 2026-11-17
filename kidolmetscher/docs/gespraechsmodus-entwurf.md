# Entwurf: Betriebsarten „Vortrag“ und „Gespräch“ (Stand 15.11.2026) – Historie, überholt seit 15.11.2026

> **Historie, überholt seit 15.11.2026.** Dieser Entwurf bleibt als Geschichte erhalten. **Maßgeblich sind Abschnitt 27 des Protokolls (genau ZWEI Betriebsarten: Vortrag ohne Sperre, Gespräch mit Sperre), die Abschnitte 29, 30 und 32 sowie der Code (`server/app/turns.py`, `server/app/config.py`, `server/app/main.py`).** Andere Betriebsarten, Schalter, Zeiten und Abläufe in diesem Entwurf gelten nicht mehr.

## Entwurf und aktueller Stand (Code, 17.11.2026)

Alle aktuellen Zeiten sind **Annahmen und nicht gemessen** (Einstellungen mit Standardwert in `server/app/config.py`).

| Punkt | Entwurf (überholt) | Aktuell |
| --- | --- | --- |
| Ende einer Aussage | nach ca. 2 s Pause oder erneutem Tippen; Zeitgrenze 60 s | **keine Redezeit-Grenze.** Ende durch „Fertig“, Stopp des Mitarbeiters, Trennung des Geräts oder **120 s ohne hörbare Sprache** (`TURN_IDLE_S`) |
| Zustand „uebersetzt“, Zeitgrenze | 20 s | höchstens **90 s** (`TURN_PROCESS_MAX_S`) |
| Zustand „wiedergabe“, Zeitgrenze | 15 s | mindestens **15 s, bei Ton Tonlänge + 8 s** (`TURN_PLAY_MAX_S`); danach Schonfrist 0,5 s (`TURN_GRACE_S`) |
| Gast verlässt die Seite mitten im Satz | Sperre löst sich nach ca. 3 s ohne Audio | Die Aussage endet **sofort** bei Verbindungsende; der offene Rest wird abgeschlossen, übersetzt und dem Mitarbeiter zugestellt; die **Sperre hält, bis der Rest übersetzt ist** (Protokoll Abschnitt 32) |
| Stille oder Rauschen nach dem Tippen | Aussage wird verworfen, Sperre löst sich sofort | Die Sperre **bleibt bis „Fertig“ oder 120 s Stille** (abgeleitet aus `turns.py`, nicht gemessen) |
| Sehr lange Aussagen | Zeitgrenze 60 s | keine Grenze (siehe oben) |
| Tippen statt Sprechen, Nachricht `{"type":"text"}` | geplant | **nicht gebaut** |
| Notbremse | „Freigeben“ am Bedienplatz | „Freigeben“ bleibt; zusätzlich **Vorrang des Mitarbeiters** („Stopp – ich spreche jetzt“, Nachricht `takeover`) und **Wortmeldung** der Gäste mit automatischer Übergabe (Protokoll Abschnitte 29, 30) |
| Übernahme einer Wortmeldung | nicht vorgesehen | Bestätigung des Geräts höchstens 30 s (`TURN_PICKUP_S`) |
| Deutsche Stimme am Bedienplatz | optional per Schalter; Modellkarte nach Suchergebnis CC0, Drittseite widerspricht | Piper `de_DE-thorsten-medium` wird mitgeladen und am Bedienplatz vorgelesen; Modellkarte am 16.11.2026 selbst gelesen: **CC0** (Protokoll Abschnitt 30) |
| TranslateGemma | 4B/12B offen | **4B** im Einsatz (A4000); Qualität gegenüber 12B unbekannt |
| GPU-Preis | A4000 zuletzt 0,2652 € pro Stunde netto | unverändert; Ada-Konfiguration 1,2641 € pro Stunde netto (Quelle `docs/kosten.md`) |
| Nur der Mitarbeiter bekommt die Übersetzung (Annahme) | Annahme | **stimmt mit dem Code überein** |
| Offene Punkte (Abschnitt 9) | vier Fragen an den Nutzer | beantwortet durch die Abschnitte 27 bis 30 des Protokolls (u. a. Gast-Antworten werden laut gelesen, kein automatisches Ende nach 2 s Pause) |

Aufgenommen aus den Wünschen des Nutzers vom 15.11.2026. **Stand 15.11. abends: Server, Bedienplatz und Gast-Seite sind gebaut (siehe Protokoll Abschnitt 23); offen: Tippen statt Sprechen, Ton am Bedienplatz, GPU-Test.** *Überholt: Ton am Bedienplatz ist seit 16.11.2026 gebaut (Abschnitt 30); Tippen statt Sprechen bleibt nicht gebaut.* Zahlen mit „Annahme“ sind nicht gemessen.

## 0. Vorgaben des Nutzers
- **Alles per Sprache.** Optional zusätzlich Tippen (z. B. laute Umgebung). Es muss **super einfach** bleiben, wie die bisherige Bedienung.
- **Zwei Betriebsarten:** Vortrag (einseitig) und Gespräch (zweiseitig).
- **Sperren:** Spricht jemand oder wird übersetzt oder vorgelesen, ist das Sprechen **für alle** gesperrt. Alles muss logisch und eindeutig sein.
- **Der Gast sieht seine eigenen Aussagen nicht** (kein Nutzen).
- **Bis zu 3 Gäste**, zuerst **Ukrainisch und Englisch**.
- **Keine Lizenzkosten**, möglichst Open Source.
- **Alles protokollieren.**

## 1. Betriebsarten
| | Vortrag (vorhanden) | Gespräch (neu) |
| --- | --- | --- |
| Sprecher | nur der Bedienplatz, Deutsch | Bedienplatz (Deutsch) und Gäste (ihre Sprache), abwechselnd |
| Zuhörer/Gäste | wählen ihre Sprache, hören/lesen | wählen ihre Sprache, hören/lesen **und können sprechen** |
| Sperre | nur Anzeige am Bedienplatz (vorhanden) | **echte Sperre für alle** (siehe 3) |
| Auswahl | beim Start der Sitzung am Bedienplatz: zwei große Knöpfe „Vortrag“ / „Gespräch“ |

## 2. Bedienung (so einfach wie möglich)
**Bedienplatz (Mitarbeiter):** Beim Start „Vortrag“ oder „Gespräch“ wählen. Im Gespräch steht **ein großer Knopf „Sprechen“**. Tippen = Aussage beginnt; sie endet **automatisch nach ca. 2 Sekunden Pause** oder durch erneutes Tippen. Die Anzeige hat drei Zustände wie heute: grün „SPRECHEN MÖGLICH“, orange „Übersetzung läuft“, rot „STOPP: <wer> spricht / wird vorgelesen“. Der Knopf ist gesperrt, solange nicht grün. **„Freigeben“-Knopf** (klein) als Notbremse. Antworten der Gäste erscheinen als **deutscher Text** (optional Ton, Schalter).

**Gast-Tablet:** Der Gast scannt den QR-Code oder öffnet den Link, wählt **zuerst seine Sprache** (vorhanden), sieht danach Untertitel (und hört den Ton) wie heute. Zusätzlich unten **ein großer Knopf „Sprechen“** (in seiner Sprache beschriftet). Tippen = sprechen; nach ca. 2 Sekunden Pause endet die Aussage automatisch. Oben dieselbe dreifarbige Statusleiste in seiner Sprache. Eigene Aussagen werden **nicht** angezeigt; nach dem Sprechen zeigt die Leiste „Bitte warten“, bis es wieder frei ist.
**Tippen statt Sprechen:** Unter dem Knopf eine einklappbare Zeile „Tippen“. Der Text läuft durch dieselbe Übersetzung und dieselbe Sperre (kein Ton-Mikrofon).

**Warum Tippen zum Sprechen und nicht Dauer-Mikrofon:** Verhindert Rückkopplung (Tablet spielt Ton, Mikrofon hört ihn), Dauer-Streaming von Hintergrundgeräuschen und Datenschutz-Bedenken (Mikrofon nur bewusst offen), und es spart Datenvolumen.

## 3. Sperrlogik (Zustandsautomat, gebaut in `server/app/turns.py`, 8 Tests)
**Zustände:** `frei` → `spricht` → `uebersetzt` → `wiedergabe` → `frei`.
- **frei:** jeder darf „Sprechen“ antippen. **Wer zuerst kommt, bekommt das Wort**; alle anderen bekommen „busy“ (Knopf bleibt grau mit Erklärung).
- **spricht:** Ende durch Pause (ca. 2 s, Annahme), Antippen oder **Zeitgrenze 60 s** (Annahme). Spricht jemand mit getrenntem Gerät weiter: Aussage gilt als beendet.
- **uebersetzt:** solange noch Abschnitte der Aussage verarbeitet werden. **Zeitgrenze 20 s** (Annahme).
- **wiedergabe:** Ergebnisse sind verteilt. Jedes Empfängergerät meldet **„fertig“** (Ton zu Ende gespielt, bei stumm/ohne Stimme: Untertitel angezeigt). Wenn alle fertig sind, folgt eine **Schonfrist 0,5 s**, dann `frei`. **Zeitgrenze 15 s**, damit ein ausgeschaltetes Gerät nicht blockiert.
- **Notbremse:** „Freigeben“ am Bedienplatz setzt sofort auf `frei`.
- Die Sperre gilt für **alle** Geräte einschließlich des Bedienplatzes. Der Server entscheidet (nicht die Browser), damit zwei gleichzeitige Tipper eindeutig sind.
- Im **Vortrag** läuft nur die Anzeige am Bedienplatz (kein Sperren der Zuhörer, es sprechen keine).

## 4. Technik (Bauplan, Aufwand unbekannt)
1. **Fertig:** `turns.py` (Zustandsautomat) mit Tests.
2. **Raum-Art:** `mode` = `vortrag|gespraech` beim Anlegen des Raums; `max_gaeste=3`; Gäste bekommen Kennung `gast:<n>` nach Beitrittsreihenfolge.
3. **Spracherkennung je Strom mit Quellsprache** (heute fest `de`): `new_stream(lang)` mit `language=lang` (Ukrainisch, Englisch zuerst). **Whisper-Qualität für Ukrainisch ist unbekannt** (messen mit eigenen Sätzen).
4. **Rückrichtung:** Gast-Text → TranslateGemma `lang→de` → Bedienplatz (Text, optional Ton). Nur der Mitarbeiter bekommt die Übersetzung (Annahme; andere Gäste sehen nur „Gast spricht“).
5. **Deutsche Stimme** für den Ton am Bedienplatz (optional, Schalter): Piper `de_DE-thorsten-medium`; die Modellkarte nennt laut Suchergebnis **CC0**, eine Drittseite behauptet „nur nichtkommerziell“ (Widerspruch). **Vor Einsatz Modellkarte selbst lesen.** *Überholt seit 16.11.2026: Modellkarte gelesen, CC0; die Drittseite ist damit nicht bestätigt.*
6. **Protokoll (JSON):**
   - Zuhörer-Seite → Server: `{"type":"talk","on":true|false}`, Binär-Audio (PCM16, 16 kHz) während `on`, `{"type":"text","text":"…"}` (max. 500 Zeichen), `{"type":"played","seq":n}` („fertig“).
   - Server → alle: `{"type":"turn","state":"frei|spricht|uebersetzt|wiedergabe","who":"staff|gast:n","reason":""}` bei jeder Änderung; Fehler `busy`.
   - Server → Bedienplatz: `{"type":"guest_message","seq","lang","text_de","audio?","t":{t_audio_in,t_asr,t_mt,t_tts,t_out}}` (Zeitstempel wie Regel 4).
7. **Oberflächen:** Bedienplatz: Moduswahl, großer Sprechen-Knopf, Statusleiste, „Freigeben“. Zuhörer-Seite: Sprechen-Knopf, Statusleiste, Tippen-Zeile, Texte in Ukrainisch/Englisch (`strings.js`).
8. **Tests:** Attrappen (Mock-ASR/MT/TTS) für den ganzen Ablauf, simulierte Geräte (zwei Gäste drücken gleichzeitig, Gerät bricht ab, Zeitgrenzen). **Danach GPU-Test** mit echtem Gast-Tablet.

## 5. Randfälle (zu berücksichtigen)
- Zwei tippen gleichzeitig: Server nimmt den ersten, der zweite bekommt „busy“ und eine klare Anzeige.
- Gast verlässt die Seite mitten im Satz: Sperre löst sich nach ca. 3 s ohne Audio (Annahme) bzw. durch `device_left`.
- Netz bricht ab (Mobilfunk): Geräte verbinden sich neu; die Zeitgrenzen verhindern Dauer-Sperren.
- Ein Gast wechselt die Sprache: gilt ab der nächsten Aussage.
- Gast spricht eine andere Sprache als gewählt: Erkennung wird schlecht; Hinweis „Bitte Sprache prüfen“ nur, wenn `no_speech`/leerer Text mehrfach (Annahme).
- Stille/Rauschen nach dem Tippen: Aussage wird verworfen, Sperre löst sich sofort (kein Text).
- Sehr lange Aussagen: Zeitgrenze 60 s, danach Übersetzung der bisherigen Abschnitte.
- Mehrere Gäste mit verschiedenen Sprachen: Aussage des Mitarbeiters geht an alle Sprachen; Aussage eines Gastes nur an den Mitarbeiter.

## 6. Datenschutz
Mikrofon nur nach Tippen offen; Audio und Text nur im Arbeitsspeicher, nichts wird gespeichert, keine Inhalte in Logs (nur Zähler und Zeiten); Einwilligungshinweis auf der Gast-Seite („Ihre Stimme wird zum Übersetzen an den Server gesendet und nicht gespeichert“); Zufalls-Link mit Ablauf. **Rechtliche Fragen bei Behörden (Auftragsverarbeitung, Folgenabschätzung): zurückgestellt**, vor Echtbetrieb klären (keine Rechtsberatung).

## 7. Lizenzen und Kosten (Anforderung: keine Lizenzkosten)
| Baustein | Lizenz (laut `lizenzen-recherche.md` und Suche vom 15.11.) | Kosten |
| --- | --- | --- |
| faster-whisper, CTranslate2, Whisper large-v3 | MIT bzw. Apache-2.0 (large-v3: Apache-2.0) | keine |
| TranslateGemma 4B/12B | Gemma-Nutzungsbedingungen: **kostenlos, aber keine Open-Source-Lizenz im üblichen Sinn**; als gehosteter Dienst gilt es laut Bedingungen als „Distribution“ (Auflagen weitergeben); Prohibited-Use-Policy **nicht ausgewertet** | keine Lizenzgebühr gefunden; Auflagen rechtlich klären |
| Piper (`piper-tts`) | Original MIT (archiviert), Nachfolger **GPL-3.0**; für Betrieb als eigener Dienst ohne Weitergabe der Software meist unkritisch, **rechtlich klären** | keine |
| Piper-Stimmen | je Stimme eigene Karte: `uk_UA-ukrainian_tts` CC0 laut früherer Lesung; `en_GB-alba` CC BY 4.0; `de_DE-thorsten` CC0 laut Modellkarte (Widerspruch einer Drittseite) | keine, aber Namensnennung bei CC BY |
| Caddy, Let's Encrypt, Ubuntu, FastAPI | Apache-2.0 / kostenlos / frei / MIT | keine |
| **Echte Kosten** | GPU-Server bei centron (A4000 zuletzt 0,2652 € pro Stunde netto) | nur Miete |
Keine Rechtsberatung; Lizenzprüfung vor Echtbetrieb wiederholen.

## 8. Reihenfolge der nächsten Arbeitsschritte
(a) Entscheidung des Nutzers zu offenen Punkten (unten), (b) Raum-Art und Sperr-Integration im Server (Attrappen-Test), (c) Spracherkennung mit Quellsprache und Rückübersetzung, (d) Bedienplatz-Oberfläche, (e) Gast-Oberfläche (Ukrainisch/Englisch), (f) Test mit zwei echten Geräten auf der GPU, (g) Messwerte und Qualität (Muttersprachler) für Ukrainisch und Englisch.

## 9. Offene Punkte für den Nutzer
1. Sprechen per **Antippen mit automatischem Ende nach Pause** (Empfehlung) oder Halten des Knopfes?
2. Soll der Mitarbeiter die Gäste-Antwort **nur lesen** oder auch **hören** (deutsche Stimme)? Empfehlung: lesen, Ton per Schalter.
3. Sollen sich **Gäste untereinander** übersetzt hören (nur der Mitarbeiter ist Annahme)?
4. Ist **ca. 2 Sekunden Pause** als Ende der Aussage in Ordnung?

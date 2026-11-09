# Messprotokoll (Stand 09.11.2026)

Regel: Was nicht gemessen ist, steht als „unbekannt“. Messwerte nie ohne Datum, Gerät und Aufbau eintragen.
Keine Inhalte aus Gesprächen eintragen, nur Zahlen.

## A. Mikrofon-Test (Etappe 0) – vom Betreiber auszufüllen

Gerät: ASUS Chromebook Plus CX34, Mikrofon DJI Mic Mini (USB-C-Empfänger). Seite: `web/mic-test.html`.

| Größe | Wert (Datum) | Bemerkung |
| --- | --- | --- |
| `AudioContext.sampleRate` | unbekannt | |
| `track.getSettings().sampleRate` | unbekannt | |
| Kanäle (`channelCount`) | unbekannt | Mono/Stereo des Empfängers |
| Echo-Unterdrückung (Standard) | unbekannt | |
| Rauschunterdrückung (Standard) | unbekannt | |
| Pegelregelung (Standard) | unbekannt | |
| Sprechpegel RMS / Spitze (dBFS) | unbekannt | normale Sprechlautstärke, 1 m / Ansteckposition |
| Übersteuerung bei lautem Sprechen | unbekannt | |
| Qualität der Aufnahme mit allen Filtern aus vs. an | unbekannt | Höreindruck |

## B. Testlauf Entwicklungs-Container (Etappe 1, nur Attrappen)

Aufbau: Cloud-Container, Chromium mit Fake-Mikrofon (Testton), Mock-Stufen, Mock-ASR-Segment 1 s.
**Diese Werte sagen nichts über das echte System aus**; sie belegen nur, dass die Zeitstempel erzeugt und angezeigt werden.

| Größe | Wert | Bemerkung |
| --- | --- | --- |
| Mic-Test Fake-Gerät: AudioContext / Track | 44100 Hz / 48000 Hz, 1 Kanal | Fake-Gerät des Browsers, nicht DJI |
| Mock-Stufen MT / TTS / Ausgabe | 4 ms / 4 ms / 0 ms (ein Lauf) | Attrappen ohne Rechenaufwand |
| Mock-ASR | 939 ms | entspricht der eingestellten Segmentlänge von 1 s, keine Erkennungszeit |

## C. Offene Messpunkte (Pipeline mit GPU)

| Messpunkt | Wie messen | Wert |
| --- | --- | --- |
| ASR-Dauer (`t_asr − t_audio_in`) | Zeitstempel in Nachricht | unbekannt |
| MT-Dauer je Sprache (`t_mt − t_asr`) | Zeitstempel | unbekannt |
| MT bei 4 Sprachen gleichzeitig | Zeitstempel, 4 Zuhörer | unbekannt |
| TTS-Dauer (`t_tts − t_mt`) | Zeitstempel | unbekannt |
| Gesamt serverseitig (`t_out − t_audio_in`) | Zeitstempel | unbekannt |
| Strecke Mikrofon -> Server | **Messpunkt fehlt**: Client-Zeitstempel im Audio-Block, Uhrenabgleich nötig | unbekannt |
| Strecke Server -> Zuhörer-Lautsprecher | **Messpunkt fehlt**: Rückmeldung des Clients bei Wiedergabebeginn | unbekannt |
| Ende-zu-Ende (Sprecher -> Ohr) | externe Messung (z. B. Klatsch-Test mit Stoppuhr/Video), Methode noch festlegen | unbekannt |
| GPU-Speicher und -Auslastung | `nvidia-smi` während des Betriebs | unbekannt |
| Maximale Zuhörerzahl je Raum | Lasttest | unbekannt |

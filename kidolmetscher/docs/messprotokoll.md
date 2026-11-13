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

## D. Zielwerte aus dem Plan (Abschnitt 5)

| Messpunkt | Zielwert laut Plan | Ergebnis |
| --- | --- | --- |
| t1 Audio im Browser bis Server | unter 0,3 s | unbekannt (Schätzung am Bedienplatz: halber Ping + 50 ms Blockgröße + Eingangslatenz; keine Messung der echten Strecke) |
| t2 Spracherkennung (Satzteil stabil) | offen | unbekannt |
| t3 Übersetzung je Sprache | offen | unbekannt |
| t4 Sprachausgabe je Sprache | offen | unbekannt |
| Gesamt Sprecher bis Untertitel (t1 bis t3) | 3–5 s | unbekannt |
| Gesamt Sprecher bis Ton (t1 bis t4) | nahe 5 s | unbekannt |
| VRAM belegt bei 4 Sprachen | unter 48 GB mit Reserve | unbekannt |
| Qualität uk / ar / en / tr (Muttersprachler, Skala 1–5) | mindestens 4 | unbekannt (Bogen: `docs/bewertungsbogen.md`) |
| Direkt vs. Umweg über Englisch | besserer Weg je Sprache | unbekannt (`scripts/bench_mt.py`) |
| Ausfälle in 10 Minuten | 0 | unbekannt |

Annahme der Skripte: Das Gesamtbudget von 5000 ms wird gleichmäßig auf ASR, MT und TTS verteilt (je 1666 ms). Das ist **keine Planvorgabe**, nur ein Markierungs-Schwellenwert („ZU HOCH“).

## E. Messwerkzeuge (Plan, Prompt C)

| Skript | Misst | Hinweis |
| --- | --- | --- |
| `scripts/bench_asr.py` | Zeit bis erstes Wort, Ende-Verzögerung, Wortfehlerrate je Testsatz | Echtzeit-Wiedergabe als Standard; `--fast` macht Latenzwerte ungültig |
| `scripts/bench_mt.py` | Zeit je Satz und Sprache, Wege direkt und über Englisch | Qualität wird nicht gemessen |
| `scripts/bench_tts.py` | Zeit bis Audio je Stimme | Hörprobe separat |
| `scripts/bench_load.py` | 4 Übersetzungen und 4 Stimmen gleichzeitig, VRAM vorher/nachher | |
| `scripts/smoke_test.sh` | lädt jede Stufe, verarbeitet einen Satz | |
| `scripts/fake_speaker.py` | speist eine WAV-Datei wie ein Mikrofon ein, zeigt Zeitstempel | Rundlauf siehe Testbericht |

Ergebnisse der Skripte mit echtem Backend lassen sich mit `--write` an dieses Protokoll anhängen. Bisher wurde **nichts** mit echtem Backend gemessen.


## Nachtrag 12.11.2026: Sprachausgabe auf der CPU der Entwicklungsumgebung (keine Servermessung)

Piper 1.8.0, `uk_UA-ukrainian_tts-medium` (Sprecher 0) und `en_GB-alba-medium`, je drei erfundene Sätze nach einem Aufwärmlauf, Rechenzeit pro Satz. **Nicht der gemietete Server, Wert ist eine Orientierung.** Ladezeit beider Stimmen: 3,6 s.

| Sprache | Rechenzeit je Satz | Länge des Audios |
| --- | --- | --- |
| uk | 71 ms, 158 ms, 132 ms | 2,3 s, 4,1 s, 4,1 s |
| en | 75 ms, 168 ms, 121 ms | 1,9 s, 4,9 s, 3,5 s |

Qualität (Klang) habe ich nicht beurteilt; das ist eine Hörprobe (`docs/bewertungsbogen.md`).


## 13.11.2026: Einrichtung auf der GPU-VM (centron, RTX 6000 Ada, Ubuntu 26.04)

| Schritt | Messung |
| --- | --- |
| `server_setup.sh` gesamt (Pakete, Whisper large-v3, 2 Stimmen, ohne TranslateGemma) | **2 min 10 s** (real), user 50,6 s, sys 19,7 s |
| Whisper large-v3 laden (Hugging Face, 7 Dateien) | ca. 15 s |
| GPU-Prüfung | PyTorch 2.15.0+cu132 CUDA True; CTranslate2 4.9.0, 1 Gerät, float16 möglich; Whisper auf der GPU geladen, 436 MiB von 49.140 MiB belegt (Wert wirkt niedrig, nicht weiter geprüft) |
| Treiber `nvidia-driver-595-open` (apt, DKMS) mit Neustart | Dauer nicht gemessen |
| TranslateGemma 12B laden | noch nicht gemessen |

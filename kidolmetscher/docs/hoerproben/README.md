# Hörproben der Piper-Stimmen (Stand 11.11.2026)

Zum Anhören und Vergleichen, **nicht** als Qualitätsurteil von mir: Ich kann die Audiodateien nicht hören. Bewerten Sie sie selbst oder mit Muttersprachlern
(`docs/bewertungsbogen.md`, Teil B). Die WAV-Dateien sind **nicht im Repository** (`.gitignore`), weil einige Stimmen nicht-kommerzielle Lizenzen haben. Erzeugt mit
`piper-tts` 1.8.0 (GPL-3.0-or-later) auf CPU in der Entwicklungsumgebung; Modelle von `rhasspy/piper-voices`.

Gesprochener Text (erfunden): Begrüßung, Hinweis „Übersetzung wird von KI erzeugt und kann Fehler enthalten“, Termin „14. März, 9:30 Uhr, Raum 204“ (Zahlen ausgeschrieben).

| Datei | Stimme | Qualitätsstufe laut Piper | Lizenz laut MODEL_CARD | Kommerziell laut Karte? |
| --- | --- | --- | --- | --- |
| `uk_UA-lada-x_low.wav` | lada | x_low (niedrigste Stufe) | Apache 2.0 | Lizenz erlaubt es |
| `uk_UA-ukrainian_tts-medium-sprecher0/1/2.wav` | ukrainian_tts (3 Sprecher) | medium | CC0 | ja nach Karte |
| `uk_UA-mykyta-high.wav` | mykyta | high | Apache 2.0 (Datensatz); Training laut Karte extern, nicht gelesen | Basis ungeprüft |
| `uk_UA-oleksa-high.wav` | oleksa | high | dto. | dto. |
| `uk_UA-tetiana-high.wav` | tetiana | high | dto. | dto. |
| `en_GB-alba-medium.wav` | alba | medium | CC BY 4.0 (Namensnennung nötig) | Lizenz erlaubt es |
| `en_US-amy-medium.wav` | amy | medium | „See URL“ | ungeklärt |
| `en_US-ryan-high.wav` | ryan | high | CC BY-NC-SA 4.0 | **nein** (nur zum Vergleich) |
| `en_US-lessac-high.wav` | lessac | high | eigene Forschungslizenz (nicht gelesen) | laut Piper-Projekt nur Forschung (nur zum Vergleich) |

Hinweise:
- „Qualitätsstufe“ beschreibt die Modellgröße und Abtastrate (x_low, low, medium, high), **nicht** automatisch, wie natürlich die Stimme klingt.
- Die Rechenzeit der Hörproben (0,3 bis 3,4 s je Satz auf CPU) ist **keine Messung** für den GPU-Server.
- Piper meldete bei den ukrainischen Stimmen insgesamt 12 „unbekannte Zeichen“ (ein kombinierendes Sonderzeichen). Wie stark das hörbar ist, habe ich nicht beurteilt.
- Die Stimme `ukrainian_tts` kennt nur Kleinbuchstaben; der Text wurde dafür in Kleinbuchstaben umgewandelt.
- Tragen Sie Ihre Eindrücke in den Bewertungsbogen ein. Erst danach lohnt sich die Entscheidung 3 des Plans.

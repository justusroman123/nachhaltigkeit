# Sprachausgabe für Arabisch und Türkisch: Kandidaten (Stand 12.11.2026)

Ausgangslage: Piper hat für Türkisch nur eine nicht-kommerzielle Stimme (`tr_TR-dfki`), für Arabisch nur eine mit ungeklärter Lizenz (`ar_JO-kareem`). Gesucht: Sprachausgabe auf dem eigenen Server (kein Cloud-Dienst) mit freier Lizenz.

Quelle: Modellkarten auf huggingface.co, gelesen am 12.11.2026 (Lizenz laut Karte). **Gehört, ausprobiert oder gemessen habe ich keinen der Kandidaten.** Die Lizenz der Trainingsdaten ist nicht geprüft.

| Modell | Lizenz laut Karte | Arabisch | Türkisch | Ukrainisch | Persisch | Angaben zu Tempo und Speicher |
| --- | --- | --- | --- | --- | --- | --- |
| VoxCPM2 (openbmb/VoxCPM2) | Apache-2.0 | ja | ja | nicht genannt | nicht genannt | ca. 8 GB VRAM; RTF ca. 0,30 auf RTX 4090 (1 s Ton braucht 0,3 s Rechenzeit, laut Karte); Streaming vorhanden |
| MOSS-TTS (OpenMOSS-Team/MOSS-TTS-Local-Transformer) | Apache-2.0 | ja | ja | nicht genannt | ja | in der gelesenen Karte keine Zahlen; es gibt eine „Realtime“-Variante (1,7B) |
| Chatterbox Multilingual V3 (ResembleAI/chatterbox) | MIT | ja | ja | nicht genannt | nicht genannt | Größe 0,5B; Zahlen zu Tempo nicht gelesen |
| XTTS-v2 (coqui/XTTS-v2) | Coqui Public Model License | ja | ja | nicht genannt | nicht genannt | **nicht-kommerziell, ausgeschlossen** |
| OmniVoice (k2-fsa/OmniVoice) | Modell CC-BY-NC | (600+ Sprachen) | | | | **nicht-kommerziell, ausgeschlossen** |

**Ukrainisch** steht bei keinem der freien Kandidaten in der Sprachliste; dafür bleibt Piper (`ukrainian_tts`, CC0, bzw. die `high`-Stimmen mit offener Datenlage).

## Empfehlung

1. Beim ersten Servertest **VoxCPM2** für Arabisch und Türkisch hören (Apache-2.0, nach Karte etwa 8 GB VRAM und schnell genug, wenn die Zahl auf unserer Karte ähnlich ausfällt: **unbekannt**). Danach MOSS-TTS und Chatterbox als Alternativen.
2. Wichtige Einschränkung: Diese Modelle sind auf Stimmklonen und freie Stimmen ausgelegt. Ohne Referenzstimme klingt die Stimme je Satz womöglich anders; es braucht eine feste Stimme (Stimmbeschreibung oder eine eigene, lizenzfreie Referenzaufnahme). **Stimmen echter Personen nicht klonen.**
3. Verzögerung: Zusätzliche Rechenzeit der Sprachausgabe geht vom Budget (3 bis 5 s gesamt) ab; vier Sprachen laufen auf derselben GPU.
4. Einbau erst nach dem Hörvergleich. Die Sprachausgabe-Stufe ist heute nur für Piper umgesetzt; die Anbindung eines zweiten Modells (je Sprache wählbar) ist noch nicht geschrieben.

## Hörvergleich auf dem Server (vorbereitet)

`scripts/tts_candidate_try.py` erzeugt für VoxCPM2 je Sprache einige Sätze aus den Qualitätssätzen und misst Rechenzeit und Speicher (Beispielaufruf aus der Modellkarte; **nicht getestet**, da hier keine GPU).

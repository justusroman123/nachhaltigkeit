# Lizenz-Recherche (Plan, Prompt E) – Stand 11.11.2026

Nur lesend, ohne Anmeldung. Quellen sind Projektseiten auf GitHub (Sekundärquellen). **Die MODEL_CARDs auf Hugging Face, die
Gemma-Bedingungen und die Anbieterseiten waren aus dieser Sitzung nicht erreichbar** (Domains nicht freigegeben). Keine Rechtsberatung.

## Gelesen (GitHub)

| Thema | Fund | URL | Offene Frage |
| --- | --- | --- | --- |
| SimulStreaming: Lizenz | MIT | https://github.com/ufal/SimulStreaming | – |
| SimulStreaming: Hinweis an kommerzielle Nutzer | Autoren bitten um das Ausfüllen eines Fragebogens (nicht geöffnet) | dto. | Gilt das für unseren Einsatz? |
| SimulStreaming: Deutsch, Hardware | `de` als Quellsprache wählbar; empfohlen mindestens 10 GB GPU-Speicher; Hinweis zu deutscher Längenschwelle | dto. | Latenzzahlen in Sekunden: nicht angegeben |
| SimulStreaming: Übersetzung | nutzt EuroLLM-9B-Instruct (laut Seite Zugang beschränkt); Lizenz dort nicht genannt | dto. | Für uns nicht relevant, wenn TranslateGemma übersetzt |
| WhisperLiveKit: Lizenz | Apache-2.0 | https://github.com/QuentinFuxa/WhisperLiveKit | – |
| WhisperLiveKit: Deutsch | in gelesenem Text nicht ausdrücklich bestätigt (Sprachliste in `docs/supported_languages.md`, nicht gelesen) | dto. | Deutsch unterstützt? |
| Piper (Original) | MIT, **archiviert seit 06.10.2025**, Entwicklung verlegt | https://github.com/rhasspy/piper | – |
| Piper (Nachfolger) | GPL-3.0 (Repo-Seite) bzw. GPL-3.0-or-later (LICENSING.md); „Looking for Maintainers“ | https://github.com/OHF-Voice/piper1-gpl | Pflichten der GPL für unseren Einsatz (rechtlich klären) |
| Piper-Stimmenlizenzen | LICENSING.md: Piper erteilt **keine Lizenz an Stimmenmodellen**; maßgeblich ist die MODEL_CARD je Stimme | https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/LICENSING.md | – |

## Stimmen laut Projektliste „kommerzielle Nutzung“ (COMMERCIAL_USE.md, Zusammenfassung des Lesers)

| Stimme | Lizenz laut Projektdokument | Kommerziell | Hinweis |
| --- | --- | --- | --- |
| uk_UA lada | Apache 2.0 | ja (laut Liste) | Lizenzhinweise beibehalten |
| uk_UA ukrainian_tts | CC0 | ja (laut Liste) | – |
| uk_UA mykyta/oleksa/tetiana (high) | „permissiv“, Basis unbekannt | nicht geklärt | Trainingskette erfragen |
| en_GB alba | CC BY 4.0 | ja (laut Liste) | Namensnennung nötig |
| de_DE thorsten (medium) | CC0 | ja (laut Liste), nur medium | andere Qualitäten: nicht-kommerziell |
| en_US ryan, lessac; de_DE thorsten (andere Qualitäten) | nicht-kommerziell / Forschung | **nein** | Datensatz-Abstammung laut Projekt |
| en_US amy | keine dokumentierte Lizenz | nicht angegeben | – |
| ar_JO kareem, tr_TR (dfki, fahrettin, fettah), en_GB alan, de_DE eva_k | in den gelesenen Dokumenten **nicht genannt** | nicht angegeben | MODEL_CARD lesen. Der Plan nennt dazu eine Drittquelle (tts.ai): arabisch/türkisch nur nicht-kommerziell – ungeprüft. |

Hinweis des Lesers: Das Projekt schreibt, viele Stimmen seien neu trainiert worden; eine ältere Kopie kann eine andere Lizenzkette haben.
Für die verwendete Kopie zählt deren MODEL_CARD.

## Nicht herausgefunden (Netzsperre)

- Lizenz, Zugangsbeschränkung, Sprachen, Prompt-Format, Quantisierungen von `google/translategemma-12b-it` (huggingface.co); Gemma-Nutzungsbedingungen (ai.google.dev).
- Lizenz NLLB-200 (600M, 1.3B) und `openai/whisper-large-v3` (huggingface.co).
- MODEL_CARDs von `rhasspy/piper-voices` (huggingface.co).
- centron: Preise, Zuschläge, Kosten pausierter Server, Standort, Zertifizierungen, AVV; STACKIT: L40S, Region, AVV, C5 (stackit.de).

**Wiederholung möglich**, sobald die Domains `huggingface.co`, `ai.google.dev`, `www.centron.de` und `www.stackit.de` für die Sitzung freigegeben sind.
Für die Entscheidung 3 des Plans („Piper-Stimmen mit Einschränkung?“) genügt dieser Stand **nicht**: Arabisch und Türkisch sind ungeklärt.

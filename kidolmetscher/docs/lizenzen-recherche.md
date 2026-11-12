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

---

# Ergänzung nach Netzfreigabe (11.11.2026, gleicher Tag)

Nach der Freigabe der Domains wurden die Seiten **von mir selbst über den Proxy gelesen** (nur lesen, ohne Anmeldung). Die Abrufwerkzeuge der Unter-Agenten griffen die Freigabe nicht auf.
Quellen: Hugging-Face-Programmschnittstelle (Metadaten) und die MODEL_CARD-Dateien im Repository `rhasspy/piper-voices`; Gemma-Nutzungsbedingungen; centron-Seiten.
Keine Rechtsberatung. **Der vorherige Abschnitt „Nicht herausgefunden (Netzsperre)“ ist damit teilweise überholt.**

## Piper-Stimmen: MODEL_CARDs (gelesen)

| Stimme | Datensatz | Lizenz laut MODEL_CARD | Herkunft des Trainings | Kommerziell? |
| --- | --- | --- | --- | --- |
| uk_UA lada (x_low) | egorsmkv/ukrainian-tts-datasets (lada) | Apache 2.0 | von Grund auf | nach Karte: Lizenz erlaubt es; Karte sagt nichts Weiteres |
| uk_UA ukrainian_tts (medium, 3 Sprecher) | OHF-Voice/voice-datasets | CC0 | von Grund auf | nach Karte ja |
| uk_UA mykyta, oleksa, tetiana (high) | egorsmkv/ukrainian-tts-datasets | Apache 2.0 (Datensatz) | „siehe“ externes Repository (RomanStasyshyn); nicht gelesen | Datensatz-Lizenz erlaubt es; Trainingsbasis ungeprüft |
| **ar_JO kareem** (low, medium) | github.com/AliMokhammad/arabicttstrain | **„See URL“** (Seite aus der Sitzung nicht abrufbar: 403) | **feinabgestimmt von der Stimme en_US lessac** | **ungeklärt**; Basis lessac hat eine eigene Lizenz (siehe unten) |
| **tr_TR dfki** (medium; einzige türkische Stimme im Repository) | marytts/dfki-ot-data | **CC BY-NC-SA 4.0** | feinabgestimmt von lessac | **nein** (NC = nicht kommerziell) |
| en_US ryan (low, medium, high) | ryanspeech (Kaggle) | CC BY-NC-SA 4.0 | high/low von Grund auf, medium von lessac | **nein** |
| en_US lessac (medium) | Blizzard 2013 (CSTR) | eigene Lizenzseite (cstr.ed.ac.uk, nicht lesbar: Host nicht freigegeben) | von Grund auf | nach Aussage des Piper-Projekts nur Forschung (Sekundärquelle) |
| en_US amy (low, medium) | MycroftAI/mimic3-voices | „See URL“ | medium von hifi_tts_92 (Hi-Fi TTS), low von ryan | **ungeklärt** |
| en_GB alan (medium) | MycroftAI/mimic3-voices (apope_low) | „See URL“ | feinabgestimmt von lessac | **ungeklärt** |
| en_GB alba (medium) | datashare.ed.ac.uk | CC BY 4.0 | von hifi_tts_92 (Hi-Fi TTS) | Karte: Lizenz erlaubt es, **Namensnennung nötig** |
| de_DE thorsten (medium) | Thorsten-Voice | CC0 | von rdh-Basismodell (CC0) | nach Karte ja |
| de_DE thorsten (high) | Thorsten-Voice | CC0 | feinabgestimmt von lessac | wegen Basis lessac **ungeklärt** |
| de_DE eva_k (x_low) | M-AILABS | „See URL“ | von Grund auf | ungeklärt |

Hinweise:
- Die in der Aufgabe genannten türkischen Stimmen **fahrettin** und **fettah** gibt es im Repository **nicht** (Verzeichnis `tr_TR` enthält nur `dfki`).
- „Kommerziell?“ ist keine Rechtsauskunft, sondern meine Zusammenfassung der Karten. Maßgeblich sind die verlinkten Lizenztexte.
- **Für Arabisch und Türkisch gibt es im Repository je nur eine Stimme, und beide sind lizenzseitig für eine kommerzielle Vorführung nicht unbedenklich** (Türkisch ausdrücklich nicht-kommerziell, Arabisch ungeklärt und von lessac abgeleitet).
  Für Ukrainisch (lada, ukrainian_tts) und Englisch (alba mit Namensnennung) gibt es Stimmen mit freundlicherer Karte.
  Das betrifft Entscheidung 3 des Plans.

## Modelle (gelesen, Hugging-Face-Metadaten vom 11.11.2026)

| Modell | Lizenz laut Metadaten | Zugang | Anmerkung |
| --- | --- | --- | --- |
| google/translategemma-12b-it (auch 4b, 27b) | **gemma** (Gemma-Nutzungsbedingungen) | **beschränkt, manuelle Freigabe** (`gated: manual`) | Modellkarte ohne Anmeldung nicht lesbar (HTTP 401): **unterstützte Sprachen und Prompt-Format unbekannt**; die Gewichte können nur mit freigegebenem Konto geladen werden (macht laut Plan Jonas) |
| openai/whisper-large-v3 | **Apache-2.0** | offen | (frühere Annahme „MIT“ war falsch) |
| facebook/nllb-200-distilled-600M und nllb-200-1.3B | **CC-BY-NC-4.0** | offen | **nicht kommerziell**; relevant, falls die NLLB-Übersetzung von WhisperLiveKit genutzt würde |

## Gemma-Nutzungsbedingungen (Fassung vom 1. April 2026 laut Seite), Zusammenfassung des Gelesenen

Quelle: https://ai.google.dev/gemma/terms (gelesen 11.11.2026). Die Prohibited Use Policy (https://ai.google.dev/gemma/prohibited_use_policy) wurde abgerufen, aber **nicht ausgewertet**.

- „Distribution“ umfasst ausdrücklich auch, **Gemma oder seine Funktion als gehosteten Dienst über API, Web oder andere Fernzugriffe bereitzustellen**. Ein Übersetzungsdienst für Zuhörer könnte darunter fallen (rechtlich klären).
- Bei Distribution: Nutzungseinschränkungen der Prohibited Use Policy als durchsetzbare Bedingung in die Nutzungsbedingungen aufnehmen und Nachfolgende darauf hinweisen; Kopie der Bedingungen weitergeben; geänderte Dateien kennzeichnen; außer bei gehosteten Diensten eine „Notice“-Datei beilegen.
- Ausgaben (Outputs): Google beansprucht keine Rechte; Nutzer sind für Ausgaben verantwortlich.
- Google kann bei Verstoß kündigen; dann müssen alle Kopien gelöscht werden.
- Ein ausdrückliches Verbot kommerzieller Nutzung wurde in den gelesenen Stellen **nicht gefunden** (Suche nach „commercial“ ohne Treffer). Das ist keine Freigabe: vollständiger Text und Policy sind rechtlich zu prüfen.

## centron (gelesen: www.centron.de, 11.11.2026)

| Thema | Fund | URL | Offene Frage |
| --- | --- | --- | --- |
| Preis RTX 6000 Ada 48 GB | **1,1919 € pro Stunde netto**, 858,19 € pro Monat bei Dauerbetrieb; „alle Preise netto“ | https://www.centron.de/en/produkte/cloud-gpu | – |
| Zuschläge | „vCPU, RAM und NVMe-Speicher kommen zu den ccloud³-Ressourcenpreisen hinzu“; Preise dafür nicht gelesen | dto. | Gesamtpreis der Konfiguration (8 vCPU/32 GB/100 GB): **unbekannt** |
| Abrechnung | stündlich, jede angefangene Stunde, **ab Erstellung bis zum Löschen** | dto. | – |
| **Gestoppte/pausierte Instanz** | Seite sagt „**Gebühren fallen an, solange die Instanz existiert, auch wenn sie gestoppt ist**“; an anderer Stelle wird mit Start/Pause und „hourly billing with no fixed costs“ geworben. Die Seite widerspricht sich in der Aussage, was „pausiert“ kostet. | dto. | Beim Anbieter klären; für die Budgetplanung vorsichtig annehmen, dass **nur Löschen** die Kosten beendet |
| Standort | eigenes Rechenzentrum in Hallstadt bei Bamberg, „Ihre Daten verlassen Deutschland nicht“ | https://www.centron.de/ | – |
| Zertifizierungen | „ISO 27001 auf Basis IT-Grundschutz · BSI C5:2020 Typ 1 · ISO 9001 · ISO 14001“; „C5-testiert“ | dto. | Gilt das auch für die GPU-Instanzen? |
| Eigentümer | „inhabergeführtes deutsches Unternehmen ohne ausländische Konzernmutter“ (Angabe von centron) | dto. | – |
| Startguthaben | „200 € in den ersten 60 Tagen“ für neue Konten | dto. | Bedingungen nicht gelesen; Konto anlegen macht laut Plan Jonas |
| **AVV (Art. 28 DSGVO)** | auf den gelesenen Seiten **nicht angegeben** (Seite „Datenschutz“ nicht gelesen) | – | Schriftlich anfragen (Fragenliste in `docs/kosten.md`) |

## STACKIT
Nicht gelesen: `www.stackit.de` leitet auf `stackit.com` weiter, diese Adresse ist in der Sitzung nicht freigegeben. Nur nötig, falls centron keinen AVV liefert (Plan).

## Weiterhin ungeklärt
Sprachen und Prompt-Format von TranslateGemma (Modellkarte gesperrt); Lizenz des arabischen Datensatzes (GitHub 403); lessac-Lizenztext; Inhalt der Gemma-Prohibited-Use-Policy; centron-AVV und Kosten der Zusatz-Ressourcen; STACKIT.

## Nachtrag 12.11.2026: Welche Piper-Stimmen es überhaupt gibt (voices.json im Repository rhasspy/piper-voices)

- Türkisch: nur `tr_TR-dfki-medium` (laut früherer Lesung CC BY-NC-SA 4.0, nicht kommerziell).
- Arabisch: nur `ar_JO-kareem` (low, medium); Lizenz ungeklärt (siehe oben).
- Persisch: `fa_IR-amir`, `ganji`, `ganji_adabi`, `gyro`, `reza_ibrahim` (alle medium); **Lizenzen nicht gelesen**.
- Ukrainisch: `lada` (x_low), `mykyta`, `oleksa`, `tetiana` (high), `ukrainian_tts` (medium, 3 Sprecher).

**Folge:** Für Türkisch und Arabisch gibt es in Piper keine Stimme mit geklärter freier Lizenz. Für Ton in diesen Sprachen wäre ein anderes Sprachausgabe-Modell nötig (noch nicht recherchiert). Bis dahin: nur Untertitel.

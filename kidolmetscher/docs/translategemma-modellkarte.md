# TranslateGemma 12B: Angaben aus der Modellkarte (Stand 12.11.2026)

Quelle: Bericht des Browser-Plugins aus dem eingeloggten Hugging-Face-Konto (Zugriff erteilt, Karte gelesen, **von mir nicht selbst geprüft**; für mich bleibt die Seite gesperrt). Modell: `google/translategemma-12b-it`, Lizenz „gemma“.

| Punkt | Angabe |
| --- | --- |
| Sprachen | „55 languages“; **keine Liste** in der Karte. Ukrainisch, Arabisch, Türkisch, Persisch stehen dort nicht ausdrücklich. Laut Technical Report (Tabelle 4, Paare Englisch zu X) kommen vor: `uk_UA`, `ar_EG`, `ar_SA`, `tr_TR`, `fa_IR`, `de_DE`. |
| Sprachcodes | ISO 639-1 (z. B. `en`) oder mit Land (`en_US`, `en-GB`). Beispiele der Karte: Quelle `cs`, Ziel `de-DE`. Ein nicht unterstützter Code löst beim Anwenden der Chat-Vorlage einen Fehler aus. |
| Nachrichtenformat | Liste mit einer Nachricht, `role` = user, `content` = Liste mit **einem** Eintrag: `type`=text, `source_lang_code`, `target_lang_code`, `text`. (Bei Bildern: `type`=image, `url`.) |
| Laden (Beispiel der Karte) | `AutoProcessor` und `AutoModelForImageTextToText`, `device_map="auto"`; `processor.apply_chat_template(tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt")`; `generate(do_sample=False)`; nur Tokens nach der Eingabelänge dekodieren. Alternativ `pipeline("image-text-to-text")`. |
| Speicher | Gewichte ca. 24,4 GB (5 Safetensors-Dateien, BF16). Hardware-Angaben für den Betrieb stehen nicht in der Karte (nur Trainings-Hardware). Quantisierung: nicht gefunden. |
| Kontext | 2K Tokens gesamt (Eingabe Text oder Bild 896x896, je 256 Tokens) |
| Qualität | Nur Durchschnitte: WMT24++ (55 Sprachen) MetricX 3,60 und Comet 83,5; WMT25 (10 Sprachen) MQM 7,94. **Qualität je Sprache: nicht angegeben.** |
| Einschränkungen laut Karte | Bias/Lücken in Daten möglich; besser bei klaren Prompts; Nuancen, Sarkasmus, Bildsprache schwierig; keine Wissensbasis; Common-Sense-Lücken; andere Aufgaben (z. B. Post-Editing) nicht offiziell unterstützt; getestet ohne Safety-Filter, eigene Schutzmaßnahmen empfohlen. |
| Bedingungen | Lizenz „gemma“, Gemma-Nutzungsbedingungen und Prohibited Use Policy; Pflichten bei gehostetem Dienst siehe `docs/lizenzen-recherche.md`. |

## Folgen für die Anwendung

- Der Übersetzer nutzt jetzt standardmäßig dieses Format (`MT_PROMPT_MODE=structured`). Der Plan-Prompt als Text bleibt zum Vergleich (`plain`).
- Sprachcodes: Standard sind unsere Kürzel (`uk`, `ar`, `tr`, `fa`, `en`, `de`). Falls das Modell einen ablehnt: `MT_LANG_CODES=ar=ar-SA,uk=uk-UA` usw.
- Beim ersten Servertest zuerst `scripts/quality_run.py` mit allen vier Sprachen laufen lassen: Fehlerzeilen zeigen abgelehnte Codes, der Bewertungsbogen die Qualität.
- Speicherbedarf: ca. 24,4 GB Gewichte plus Whisper large-v3 (ca. 3 GB in float16, Schätzung) passen rechnerisch in 48 GB VRAM; gemessen ist das nicht.

## Nachtrag 14.11.2026: Freigabe, Größen, Codes (Bericht des Browser-Plugins aus dem eingeloggten Hugging-Face-Konto, nur gelesen; von mir nicht selbst geprüft)

| Modell | Zugriff | Dateien gesamt (main) |
| --- | --- | --- |
| google/translategemma-4b-it | erteilt | 8,64 GB (15 Dateien) |
| google/translategemma-12b-it | erteilt | 24,41 GB (18 Dateien) |
| google/translategemma-27b-it | erteilt | 54,90 GB (25 Dateien) |

- **27B passt in BF16 nicht auf die 48 GB der Ada** (54,90 GB Gewichte); nur quantisiert, Qualität/Aufwand unbekannt.
- Die Modellkarte nennt **keine der vier Sprachen einzeln** („55 languages“, keine Liste). Das `chat_template.jinja` akzeptiert u. a. `uk`/`uk-UA`, `ar`/`ar-EG`/`ar-SA`, `tr`/`tr-TR`, `fa`/`fa-IR`; „akzeptiert“ heißt nicht „Qualität geprüft“.
- **Quantisierungen:** keine offiziellen von Google; nur Community-Varianten (GGUF, MLX 4-bit u. a.), nicht geprüft.
- **4B-Variante:** Repository-Name `google/translategemma-4b-it` bestätigt. Setup: `MT_REPO=google/translategemma-4b-it` im Cloud-Init-Starter. Speicher: 8,64 GB Gewichte + Whisper ca. 4,2 GB (gemessen) = ca. 12,9 GB von 16 GB der A4000; **Reserve für Zwischenwerte: unbekannt, messen**.

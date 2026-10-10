# Vorgehen: Was erfolgreiche Projekte anders machen – und was SafeBriefing daraus übernimmt

Kurzrecherche vom 10.10.2026 zu Projekten, die mehrsprachige Sicherheitskommunikation im
Betrieb tatsächlich einsetzen, plus Forschung zu Bestätigungsstrategien bei Sprachübersetzung.
Nur öffentliche Quellen; die Detailseiten waren aus der Entwicklungsumgebung nicht abrufbar,
die Aussagen stützen sich auf Suchzusammenfassungen und Artikel-Teaser. Vor einer
Kundenpräsentation die Quellen im Volltext prüfen.

## Die zehn Befunde

| # | Befund | Quelle | In SafeBriefing |
| --- | --- | --- | --- |
| 1 | **Closed-Loop / Readback**: Sender gibt die Anweisung, Empfänger wiederholt sie, Sender bestätigt. Seit Jahrzehnten Standard zwischen Flugsicherung und Cockpit, in der Chirurgie eingeführt. „Roger“ oder ein Klick auf die Sprechtaste gelten als unzureichend. | Luftfahrt, BMC Surgery 2012 (Denver Health), Life Flight Network | Der dritte Schritt ist ein Readback: Die Führungskraft spricht, die Maschine „liest zurück“ (Rückübersetzung, angezeigt und auf Deutsch vorgelesen), die Führungskraft gibt frei. Danach die zweite Schleife: „Verstanden“ und Verständnisfrage bei den Beschäftigten. |
| 2 | **Der Sprecher sieht, was erkannt wurde.** Lotte E&C blendet bei der Sicherheitsunterweisung (600 Beschäftigte, 40 % ausländisch) neben Chinesisch und Vietnamesisch auch koreanische Untertitel ein – damit die Vorgesetzten die Übersetzung kontrollieren können. | Korea Herald, Juni 2026 | „Sie sagten: …“ erscheint sofort nach dem Sprechen, mit „korrigieren“. |
| 3 | **Rückübersetzung gegen Fehlübersetzungen.** MelBridge (Mitsubishi Electric) nutzt „折り返し翻訳“ (Rückübersetzung) als Funktion zur Unterdrückung von Fehlübersetzungen, dazu ein Fachwörterbuch mit rund 4.000 Begriffen und eigene Einträge. Ein US-Patent beschreibt die Anzeige der Rückübersetzung vor dem Absenden. | Mitsubishi Electric / Agekke, USPTO 12572759 | Kern der Prüfung; zweite Engine für die Rückübersetzung empfohlen. |
| 4 | **Bestätigungsstrategien sind erforscht.** Stallard u. a. (ICASSP 2010) vergleichen „Erkanntes vorlesen“ und „Rückübersetzung“ als Bestätigung bei Sprach-zu-Sprach-Übersetzung. Favre u. a. (2013/2015): gezielt nachfragen statt pauschal „bitte wiederholen“, unsichere Segmente verwerfen senkt die Fehlerrate. Ohta u. a. (2005): Fehler bei Substantiven und fehlende Satzzeichen sind die gefährlichsten. | ISI/ICASSP 2010, Favre ICASSP 2013, Interspeech 2015, Interspeech 2005 | Beides wird angeboten (Anzeige und Vorlesen). Der Sinnvergleich benennt den konkreten Grund („Fachbegriff Stapler nicht wie freigegeben“) statt nur „unsicher“. Fachbegriffe (Substantive) prüft das Werks-Glossar; Rot wird nicht gesendet. Hinweis an die Führungskraft: kurze Sätze. |
| 5 | **Spracherkennung ist nicht perfekt.** Daewoo E&C meldet 94,6 % Erkennungsgenauigkeit für Koreanisch im Pilot – also rund jeder zwanzigste Satz falsch. | Herald Corp., Sept. 2026 | Deshalb ist die Freigabe Standard („confirm“), nicht optional. Automatisches Senden gibt es nur als bewusste Einstellung. |
| 6 | **Push-to-talk mit klaren Grenzen** eignet sich für überlegtes Sprechen mit Pausen und Korrekturen; Dauerbetrieb eher für Gespräche. | LiveAvatar-Doku, Wordly | Großer Knopf: antippen oder gedrückt halten (Walkie-Talkie). Kein Dauer-Mikrofon. |
| 7 | **Fachwörterbuch und Jargon.** MelBridge: 4.000 Begriffe; Lotte und Daewoo: Bauglossar; HiWorker übersetzt Baustellen-Slang. | s. o., Seoul Economic Daily | Werks-Glossar mit Freigabe durch die Sifa, Status „Entwurf/freigegeben“, verbotene Begriffe. |
| 8 | **Text und Ton gleichzeitig, aufs eigene Handy.** Daewoo liefert Bildschirmtext und Audio; Beschäftigte scannen einen QR-Code; GS E&C plant Sprachausgabe nach; Ssangyong nutzt Bluetooth-Lautsprecher. | Herald Corp., Korea Times, Nocutnews | Hallen-Display, Handy per QR ohne App, Vorlesen auf dem Handy, Ton in den Gehörschutz. |
| 9 | **Verständnis aktiv prüfen.** Sicherheitsleitfäden: Anweisung wiederholen lassen, kurze Quizfragen, Ja/Nein-Abfrage – vor Arbeitsbeginn. | Udext, Safety Evolution | Anonyme Verständnisfrage je Sprache, Rückkanal „nicht verstanden“, Schwelle 20 % falsch. |
| 10 | **Mündlich in der Sprache der Beschäftigten ist Pflicht**, ein übersetztes Handout ersetzt keine Unterweisung. Ein zweisprachiger Reviewer soll Maschinenübersetzungen vor dem Einsatz prüfen. | Safety Evolution, Udext | Vorlesen auf dem Handy; Kernsätze werden vorab von Muttersprachlern und der Sifa freigegeben, nie live übersetzt. |

## Der daraus abgeleitete Ablauf im Start-Modus

```
1  Sprechen        großer Knopf, antippen oder halten          (Befund 6)
2  Sehen           „Sie sagten: …“ – korrigierbar              (Befund 2, 5)
3  Zurückhören     Rückübersetzung je Sprache, angezeigt und
                   auf Deutsch vorgelesen; gleiche Rückübersetzungen
                   werden zusammengefasst                      (Befund 1, 3, 4)
4  Freigeben       Grün: „Senden“ · Gelb: „Ja, so gemeint“ mit
                   benanntem Grund · Rot: nicht sendbar          (Befund 4, 5)
   Hände frei      nur bei Grün: vorlesen, fünf Sekunden, dann
                   automatisch senden – „Stopp“ jederzeit        (Befund 1)
5  Zweite Schleife „Verstanden“ je Handy, Verständnisfrage,
                   Nachweis                                     (Befund 9, 10)
```

## Was offen bleibt

- Keiner der gefundenen Betriebe veröffentlicht Unfall- oder Fehlerzahlen vor/nach Einführung.
- Die Genauigkeitsangabe (94,6 %) stammt vom Anbieter selbst.
- Ob ein Readback per Maschine die gleiche Wirkung hat wie zwischen Menschen, ist nicht belegt.
  Deshalb bleibt die Verständnisfrage bei den Beschäftigten Teil des Standards.

## Quellen

- Korea Herald: *When safety speaks 20 languages* (Lotte E&C) – https://www.koreaherald.com/article/10772020
- Korea Herald: *Daewoo E&C launches AI translator* – https://www.koreaherald.com/article/10760760
- Herald Corp.: *Voice recognition accuracy at 94.6 %* (Daewoo E&C) – https://biz.heraldcorp.com/article/10873529
- Herald Corp.: *Tool supports over 180 languages* – https://biz.heraldcorp.com/article/10775517
- Korea Times: *GS E&C develops AI translator* – https://www.koreatimes.co.kr/www/tech/2024/10/129_382988.html
- Seoul Economic Daily: *Lotte E&C Develops AI Translator* – https://en.sedaily.com/news/2026/05/27/lotte-ec-develops-ai-translator-for-construction-sites
- Seoul Economic Daily: *AI Translates Construction Jargon* (HiWorker) – https://en.sedaily.com/finance/2026/04/29/ai-translates-construction-jargon-to-protect-foreign-workers
- Mitsubishi Electric: MelBridge 翻訳サイネージ – https://www.mitsubishielectric.co.jp/communication-solution/
- Agekke (Vertrieb MelBridge), Funktionsübersicht – https://x.com/agekkekouhou/status/2000401341391503648
- USPTO 12572759 *Multilingual conversation tool* (Rückübersetzung vor dem Senden) – https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12572759
- Stallard u. a.: *Evaluating different confirmation strategies for speech to speech translation systems* (ICASSP 2010) – https://www.isi.edu/results/publications/18308/
- Favre u. a. (ICASSP 2013) – https://pageperso.lis-lab.fr/benoit.favre/papers/favre_icassp2013a.pdf
- Favre u. a. (Interspeech 2015) – https://pageperso.lis-lab.fr/benoit.favre/papers/favre_is2015b.pdf
- Ohta u. a. (Interspeech 2005) – https://www.isca-archive.org/interspeech_2005/ohta05b_interspeech.html
- BMC Surgery 2012: *Introducing standardized “readbacks”* – https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3418160/
- Life Flight Network: *Closed loop communication* – https://www.lifeflight.org/wp-content/uploads/lfn-thought-leadership-closed-loop-poster.pdf
- LiveAvatar: *Push to talk* – https://docs.liveavatar.com/docs/push-to-talk
- Wordly: *AI Translation Update December 2024* – https://www.wordly.ai/blog/ai-translation-december-2024-update
- Udext: *Multilingual Safety Briefings* – https://www.udext.com/blog/multilingual-safety-briefings-for-distributed-workforces
- Safety Evolution: *Toolbox Talks in Spanish and English* – https://www.safetyevolution.com/blog/toolbox-talks-spanish-english

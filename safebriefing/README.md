# SafeBriefing – Unterweisung ohne gemeinsame Sprache

**Prototyp** für mehrsprachige Arbeitsschutz-Unterweisungen in Werkshallen und für Fremdfirmen.
Die Führungskraft spricht Deutsch. Die Beschäftigten lesen oder hören die Anweisung in ihrer
Sprache – auf dem Hallen-Display, dem eigenen Handy (QR-Code, ohne App), einer Smart-Brille
oder als Ton im Gehörschutz.

Kern ist das Prinzip, das Mitsubishi Electric mit MelBridge vorgemacht hat – angepasst an
deutsches Recht, deutsche Hallen und die Mitbestimmung:

1. **Übersetzen** mit freigegebenem **Werks-Glossar**
2. **Rückübersetzen** (zweite, unabhängige Engine)
3. **Sinnvergleich** – sperrt automatisch, wenn eine Verneinung verloren geht, eine Handlung ins
   Gegenteil kippt („freischalten“ → „einschalten“), eine Zahl nicht stimmt oder ein Fachbegriff
   falsch übersetzt ist
4. **Freigabe** je Sprache durch die Führungskraft (grün senden · gelb bestätigen · rot gesperrt)
5. **Verständnis-Check** anonym auf dem Handy und **Nachweis** nach § 4 DGUV Vorschrift 1 / § 12 BetrSichV

Notfall- und Warnhinweise werden nie live übersetzt: Sie kommen als vorab geprüfte **Kernsätze**.

## Bedienung in drei Schritten (Start-Modus)

1. **Was steht an?** – vorbereitete Unterweisung antippen (z. B. Fremdfirmen-Einweisung)
2. **Wer steht vor Ihnen?** – Sprachen antippen (z. B. Ukrainisch, Arabisch, Griechisch)
3. **Los** – vorbereitete Punkte mit „Senden“ verschicken oder frei sprechen; „Frage“ für den
   Verständnis-Check, „Beenden“ erzeugt den Nachweis

Die Handys der Teilnehmenden zeigen nur die gewählten Sprachen und lesen jede Anweisung vor.
Alles Weitere (Prüfdetails, Glossar, Unterweisungen bearbeiten, Nachweise, Datenschutz) liegt unter
**Verwaltung**.

> Fiktives Werk („Musterwerk“). Alle Übersetzungen sind Demo-Übersetzungen ohne
> Muttersprachler-Prüfung. Sicherheitszeichen sind symbolisch. Keine Rechtsberatung.

## Schnellstart

**Ohne Installation (Vorführung im Browser):** `app/index.html` öffnen. Kernsätze, Prüf-Demo,
Handy-, Brillen- und Display-Vorschau, Fremdfirmen, Glossar, Nachweise und Cockpit laufen
vollständig im Browser.

**Mit lokalem Edge-Server (wie im Werk):** Node.js ab 18, keine weiteren Pakete.

```bash
cd safebriefing
npm run start:mock          # Demo-Engine, nur zum Ausprobieren
# oder echt konfiguriert:
cp server/config.example.env server/config.env   # Engine eintragen
npm start
```

Dann `http://localhost:8080` öffnen. Der Leitstand zeigt einen QR-Code mit der WLAN-Adresse;
Handys im selben Netz treten damit bei. Beamer: zweites Fenster mit `#display`.

| Ansicht | Adresse |
| --- | --- |
| Start-Modus (Standard) | `#start` |
| Experten-Leitstand | `#leitstand` |
| Unterweisungen bearbeiten | `#unterweisungen` |
| Hallen-Display / Beamer | `#display` |
| Handy der Beschäftigten | `#join` oder `#join-pl`, `#join-ro`, … |
| Smart-Brille | `#brille-ro`, `#brille-ar`, … |
| Fremdfirmen-Pforte | `#pforte` |

## Übersetzungs-Engines (am Edge-Server)

| Engine | Betrieb | Einsatz |
| --- | --- | --- |
| `libretranslate` | lokal, ohne Internet | Basis für den Offline-Koffer |
| `openai` (OpenAI-kompatibel) | lokal (Ollama, vLLM, LM Studio) oder EU-Anbieter | Glossar per Anweisung, gute Qualität |
| `deepl` | EU-Cloud | schneller Pilot, Glossar-IDs möglich |
| `mock` | lokal | nur Demo |

Für die Rückübersetzung empfiehlt sich eine **zweite Engine** (`BACK_ENGINE`), damit Fehler nicht
von derselben Engine „bestätigt“ werden. Spracherkennung: OpenAI-kompatibler Whisper-Server
(z. B. faster-whisper) über `STT_URL` – Audio bleibt im Arbeitsspeicher.

In der Online-Demo auf claude.ai übersetzt Claude freie Sätze (Cloud, nur zum Vorführen).

## Aufbau

```
app/                 Browser-App (ohne Build, ohne Framework)
  js/guardrail.js    Sinnvergleich – deterministische, nachvollziehbare Regeln
  js/data.js         Kernsätze, Werks-Glossar, Quiz, Fremdfirmen-Regeln, Unterweisungen, UI-Texte (10 Sprachen)
  js/engines.js      Kernsatz · Prüf-Demo · Edge-Server · Browser-Übersetzer · Online-Demo
  js/bus.js          Sync Leitstand ↔ Geräte (BroadcastChannel · SSE · Artifact-Room)
  js/app.js          Experten-Leitstand, Display, Handy, Brille
  js/simple.js       Start-Modus: Unterweisung → Sprachen → Los
  js/admin.js        Fremdfirmen, Glossar, Nachweise, Cockpit, System & Datenschutz
server/              Edge-Server (Node, ohne Abhängigkeiten): Dateien, SSE, Übersetzung, Spracherkennung
test/                node --test: Sinnvergleich, Daten, Server, Engine-Adapter (gegen Test-Server)
docs/                Demo-Skript, Architektur & Datenschutz, Fremdfirmen
```

## Tests

```bash
npm test     # 89 Tests
```

## Stand und Grenzen

- Die Engine-Adapter (LibreTranslate, OpenAI-kompatibel, DeepL, Whisper) sind nur gegen
  nachgebaute Test-Server geprüft, nicht gegen die echten Dienste.
- Der Sinnvergleich senkt das Risiko, schließt Fehler aber nicht aus. Deshalb: Kernsätze für
  Notfälle, Freigabe durch die Führungskraft, Verständnis-Check.
- Demo-Übersetzungen vor jedem echten Einsatz durch Muttersprachler und die Sifa prüfen lassen.
- Rechtliche Einordnungen sind eine fachliche Einschätzung, keine Rechtsberatung.

Weiter: [Demo-Skript](docs/DEMO-SKRIPT.md) · [Architektur & Datenschutz](docs/ARCHITEKTUR.md) · [Fremdfirmen](docs/FREMDFIRMEN.md)

© KI-SCHUB. Alle Rechte vorbehalten – siehe [LICENSE](LICENSE).

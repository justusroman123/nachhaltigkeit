# 🚇 Berlin Untergrund – U-Bahn Odyssee

Ein kleines **3D-Spiel** (Third-Person, Hitman-Style light) am Berliner
U-Bahnhof **Kottbusser Tor**. Du läufst über den Bahnsteig, sprichst die
typischsten Berliner:innen an, kaufst dir bloß rechtzeitig einen Fahrschein –
und lässt dich **nicht** von den BVG-Kontrolleuren erwischen. 🎫

## Spielen

Einfach den GitHub-Pages-Link öffnen (oder `docs/index.html` im Browser) –
läuft komplett im Browser, auf **Desktop und Smartphone**, kein Download,
nichts umstellen.

## Steuerung

| Aktion | Desktop | Handy |
| --- | --- | --- |
| Laufen | `W A S D` / Pfeiltasten | Linker Joystick |
| Umsehen | Maus ziehen | Rechts über den Screen wischen |
| Sprechen / Interagieren | `E` | **SPRECHEN**-Knopf |
| Rennen | `Shift` | **RENN**-Knopf |
| Ton an/aus | 🔊-Button oben rechts | 🔊-Button oben rechts |

## Ziel – die ganze Linie U1 fahren

Fahr die **U1** über **4 Stationen**: **Kottbusser Tor → Görlitzer Bahnhof →
Warschauer Straße → Alexanderplatz**. An jeder Station:

1. **Quatsch die Leute an** (3 pro Station) – über ein Dutzend typische
   Berliner:innen mit eigenen Sprüchen: 🍺 Sterni-Opa, 🎧 Techno-Klaus (seit
   Freitag wach), 🌭 Currywurst-Renate, 🥙 Döner-Ali, 🐕 Punk mit Hund,
   🚲 Fahrrad-Reinschlepper, 🎻 Straßenmusiker, 📸 verlorenes Touri-Paar,
   🏪 Späti-Chef, 📱 Handy-Schnacker, 🧳 Rentnerin, 🔊 Handy-Lautsprecher-Typ …
2. **Warte auf die einfahrende gelbe U-Bahn** 🚇 – sie rollt mit Quietschen ein,
   öffnet die Türen („Zurückbleiben bitte!") …
3. … **steig ein** und fahr zur nächsten Station. Am **Alexanderplatz** ist
   Endstation – „Alles aussteigen bitte!"

Vergiss an der ersten Station den 🎫 **Fahrschein am Automaten** nicht: Ab
Görlitzer Bahnhof patrouillieren **BVG-Kontrolleure** 👮. Erwischen sie dich
ohne Fahrschein, gibt's **60 € erhöhtes Beförderungsentgelt** – und Game Over.

## Details & Berlin-Feeling

- **Echte U-Bahn**, die einfährt, hält, die Türen öffnet und mit dir losfährt.
- **Vorbeirauschende Züge** auf dem Gegengleis.
- **Zugzielanzeiger**, der die nächste Station und „einfahrend / Türen offen"
  anzeigt.
- **Zufällige BVG-Durchsagen** („Signalstörung", „Der Aufzug ist außer Betrieb")
  – gesprochen auf Deutsch.
- **Deko**: Graffiti-Tags, Werbeplakate (Berghain, Späti, Club Mate), Skyline-
  Murals (Fernsehturm am Alex, Oberbaumbrücke, Görli-Park), Mülleimer,
  Pfandflaschen, eine 🐀 Ratte auf den Gleisen und eine hüpfende Taube.
- **Linien-Anzeige** unten zeigt deinen Fortschritt über die 4 Stationen.

## Technik

- Reines HTML/JS, 3D mit **Three.js – komplett ins File eingebettet**
  (`docs/index.html`). Ein einziges self-contained File, **keine externen
  Requests**, läuft direkt über GitHub Pages oder githack.
- Grafik aus einfachen Formen (Low-Poly-Berlin), Sound live im Browser generiert
  (U-Bahn-Rumpeln, Türgong, Quietschen, Jingles) plus deutsche Sprachausgabe.

Viel Spaß auf der U1! 🐻

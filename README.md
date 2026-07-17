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

## 🚪 Raus an die Oberfläche!

An jeder Station kannst du über den **Ausgang 🚪 nach oben** an die Straße –
die ganze Umgebung wechselt von U-Bahnhof zu **Berliner Kiez bei Tageslicht**
(Himmel, Altbauten, Späti, Currywurst-Imbiss, Autos, Bäume, U-Bahn-Eingang).
Jeder Kiez sieht anders aus (Fernsehturm, Oberbaumbrücke, Görli-Park …).

Dort triffst du die **schrägsten Gestalten Berlins**, die alle was Seltsames
machen – jede mit eigenem Look und eigener Animation:

- 🩲 **FKK-Sonnenanbeter** (im November, sonnt sich trotzdem)
- 🔊 **Bollerwagen-DJ** (mobiler Rave, tanzt)
- 🐻 **Berliner Bär** im Kostüm (winkt)
- 🧘 **Straßen-Yogi** (Sonnengruß Richtung Späti)
- 🗽 **Lebende Statue** (bewegt sich nur gegen Münze)
- 👟 **Flohmarkt-Verkäufer** mit genau einem Schuh
- 🐦 **Tauben-Fütterer** (umringt von Tauben)
- 🚲 **Fixie-Hipster**, 📋 **Bürgeramt-Verzweifelte** (rennt panisch),
  💃 **Rave-Oma**, 🍺 **Späti-Philosoph**, 🥙 **Döner-Werbetyp** …

Dazu Currywurst-Imbiss & Späti zum „Einkaufen". Jede Begegnung zählt als
🌟 **Berlin-Moment** (Zähler oben links).

## Details & Berlin-Feeling

- **Echte U-Bahn**, die einfährt, hält, die Türen öffnet und mit dir losfährt.
- **Deutlich unterschiedlichere Figuren**: verschiedene Größen, Bäuche, Bärte,
  Frisuren (Iro, Dutt, Glatze, Beanie, Cap), Brillen, Kleider, Rucksäcke,
  Props und komplette Kostüme (Bär, Döner-Spieß, Statue).
- **Vorbeirauschende Züge** auf dem Gegengleis, **Zugzielanzeiger** an der Decke.
- **Zufällige gesprochene Durchsagen** – unten BVG („Signalstörung"), oben
  Straßen-Geräusche.
- **Deko**: Graffiti, Werbeplakate, Skyline-Murals, Mülleimer, Pfandflaschen,
  Ratte 🐀, Tauben, E-Scooter-Haufen, Litfaßsäule, Bäume, Autos, Streetart.
- **Linien-Anzeige** unten zeigt deinen Fortschritt über die 4 Stationen.

## Technik

- Reines HTML/JS, 3D mit **Three.js – komplett ins File eingebettet**
  (`docs/index.html`). Ein einziges self-contained File, **keine externen
  Requests**, läuft direkt über GitHub Pages oder githack.
- Grafik aus einfachen Formen (Low-Poly-Berlin), Sound live im Browser generiert
  (U-Bahn-Rumpeln, Türgong, Quietschen, Jingles) plus deutsche Sprachausgabe.

Viel Spaß auf der U1! 🐻

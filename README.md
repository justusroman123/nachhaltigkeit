# 🚇 Bärlin U-Bahn Chaos

Eine humorvolle 3D-GTA-Parodie rund um Berlin und seine U-Bahn — komplett im
Browser, ohne Installation. Fahre die (fiktionale) Linie **B1/B2/B5**, sammel
Pfand, klau Döner, flieh vor Kontrolleur*innen.

## 🎮 Sofort spielen

**Variante A — Doppelklick:**
`index.html` mit einem modernen Browser (Chrome, Edge, Firefox) öffnen.

**Variante B — Lokaler Server (empfohlen, falls A blockiert wird):**
```bash
cd nachhaltigkeit
python3 -m http.server 8000
# Dann http://localhost:8000 im Browser öffnen
```

## 🕹 Steuerung

| Taste | Aktion |
|---|---|
| `W A S D` | laufen / fahren |
| `Shift` | sprinten |
| `Space` | springen |
| `F` | Fahrzeug ein/aus (Auto, U-Bahn, E-Roller) |
| `R` | Ticket lösen (2 €) am Bahnhof |
| `Q` | Faust (Kontrolleur*innen k.o. schlagen) |
| `M` | Missionsliste |
| `P` | Pause |
| `Esc` | aus Fahrzeug aussteigen |
| Maus | umsehen / zoomen |

## 📋 Missionen

- **♻️ Pfand-Marathon** – sammle 5 Pfandflaschen (+15 €)
- **🗼 Bring den Touristen** – ein Tourist will zum Fernsehturm (+25 €)
- **🌯 Klau den Döner!** – Sprint-Herausforderung am Kotti (+20 €)
- **🚇 Schwarzfahren-Challenge** – B1 komplett ohne Ticket (+30 €)
- **🍺 Späti-Lieferung** – vom Dom zum Reichstag (+18 €)
- **🛴 Roller-Rebellion** – zerstöre 3 E-Roller (+22 €)

## 🚔 Fahndung

Ohne Ticket in der U-Bahn → **Kontrolleur*in** taucht auf.
Kontrolleur*in schlagen → **Polizei** ab 2 Sternen. Verstecken in Sträuchern
(die kleinen Büsche im Park) senkt die Sterne wieder.

## 🌆 Was steht in der Stadt

- Fernsehturm · Brandenburger Tor · Reichstag · Bärliner Dom · Siegessäule
- Spree quer durch die Karte
- U-Bahn-Netz mit 3 Linien und ~15 Stationen
- ~40 Passanten mit Berliner Sprüchen („Ick hab keene Zeit!" …)

## ⚖️ Markenrechtlicher Hinweis

Dieses Spiel ist eine **Parodie** ohne jegliche Verbindung zu realen
Verkehrsbetrieben, Marken oder Personen. Alle Namen, Logos, Farben und
Ansagen sind bewusst frei erfunden bzw. entfremdet:

- Der Betreiber „BBG" (*Bärliner Bahn-Genossenschaft*) ist frei erfunden.
- Die Linien „B1/B2/B5" und das „B"-Logo entsprechen keinem realen Design.
- Farbschema: **Anthrazit/Türkis** — nicht das BVG-Gelb.
- Keine Ampelmännchen-Grafiken (geschützt durch AMPELMANN GmbH).
- Fahrzeuge sind generische Formen ohne Herstellerbezug.

Geografische Namen (Berlin, Alexanderplatz, Kottbusser Tor etc.) sind Ortsangaben
und werden nur zur Verortung verwendet, nicht in geschütztem Design.

## 🏗 Architektur

```
index.html            # Entry (lädt Babylon.js via CDN + alle Module)
src/
├── config.js         # Farben, Speeds, Sprüche
├── main.js           # Bootstrap + Game-Loop
├── world/            # Stadt, Landmarks, U-Bahn-Netz
├── player/           # Char, Kamera, Inventar
├── vehicles/         # Auto, Zug, E-Roller
├── ai/               # Passanten, Kontrolleure, Polizei
├── missions/         # Missionslogik
├── ui/               # HUD, Minimap, Dialoge
├── audio/            # Web-Audio-SFX + Sprachausgabe
└── utils/            # localStorage
```

Reines JavaScript, keine Build-Kette. Babylon.js kommt via CDN
(<https://cdn.babylonjs.com/babylon.js>). Modul-Isolation durch das
`window.BUG.*`-Namespace-Pattern.

## 💾 Speichern

Geld, Pfand und erledigte Missionen werden alle 8 Sekunden automatisch in
`localStorage` gespeichert. Speicherstand mit Browser-DevTools löschen:
`localStorage.removeItem('baerlin_ubahn_save_v1')`.

Viel Spaß in Bärlin — und **kauf dir 'n Ticket, wa!**

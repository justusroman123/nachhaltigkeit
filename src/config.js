// Zentrale Konfiguration — Farben, Speeds, Preise, Weltgrenzen
window.BUG = window.BUG || {};
BUG.CONFIG = {
  world: {
    size: 400,              // 400 x 400 m Karte
    groundColor: [0.18, 0.20, 0.16],
    skyColor: [0.05, 0.08, 0.14],
    fogDensity: 0.006,
  },
  player: {
    walkSpeed: 5,
    sprintSpeed: 10,
    jumpVelocity: 8,
    gravity: -22,
    interactRange: 3.5,
    height: 1.8,
  },
  camera: {
    followDistance: 8,
    followHeight: 4,
    minZoom: 3,
    maxZoom: 20,
  },
  vehicles: {
    car:      { maxSpeed: 22, accel: 8,  turn: 1.8 },
    escooter: { maxSpeed: 16, accel: 12, turn: 3.2, tipAt: 2.7 },
    train:    { maxSpeed: 24, accel: 4,  brake: 8 },
  },
  wanted: {
    ticketPrice: 2,
    kontrolleurSpawnMeters: 30,      // Sichtweite
    kontrolleurSpeed: 6.5,
    polizeiSpeed: 8,
    starDecayEverySeconds: 8,        // 1 Stern verliert man alle 8s (nur wenn versteckt)
    hidingRadius: 6,                 // Nähe zu Sträuchern zählt als "versteckt"
  },
  economy: {
    pfandPerBottle: 0.25,
    startMoney: 15,
  },
  colors: {
    // ANTHRAZIT / TÜRKIS statt BVG-Gelb — bewusst anders
    trainBody: '#0f3a45',
    trainAccent: '#00d4b8',
    stationRoof: '#333844',
    stationSign: '#00d4b8',
    kontrolleur: '#5d1f1f',   // dunkelrot Uniform, unverwechselbar
    polizei: '#1a2f6b',       // dunkelblau
    npcSkin: ['#f2d3b0', '#c99976', '#8b5a3c', '#e9c39e', '#a67c52'],
    building: ['#8a7358', '#a08b6e', '#6d5a44', '#b8a184', '#7d6b52', '#94806a'],
  },
  humor: {
    // Berliner Sprüche für zufällige NPC-Bemerkungen
    npcQuips: [
      "Wat willze?",
      "Ick hab keene Zeit!",
      "Ey, mach ma Platz!",
      "Late-night Späti offen?",
      "Wa? Musste bezahlen?",
      "Nee du, ick nich.",
      "Alta, wat is los?",
      "Berlin, du bist so hässlich.",
      "Wo geht der U-Bahnhof?",
      "Hasse ma nen Euro?",
      "Ick fahr immer schwarz.",
      "Meine Fresse.",
      "Late again. Danke BBG.",
      "Rolltreppe kaputt. Klassiker.",
      "Kein Wunder bei den Mieten.",
    ],
    kontrolleurQuips: [
      "FAHRSCHEINE BITTE!",
      "Ihren Ausweis!",
      "Nicht wegrennen!",
      "Kollege, hier ist ein Schwarzfahrer!",
      "60 Euro erhöhtes Beförderungsentgelt!",
      "Ich seh Dich!",
    ],
    dealerQuips: [
      "Mit scharf?",
      "Zwiebeln? Salat? Alles?",
      "Frisch vom Grill!",
      "Nur 6 Euro heute!",
      "Bester Döner Bärlins!",
    ],
    pfandQuips: [
      "Flasche...",
      "Danke sehr.",
      "Pfand bringt Geld.",
    ],
    announcements: [
      "Nächster Halt: Alexanderplatz. Zurückbleiben bitte.",
      "Nächster Halt: Kottbusser Tor. Bitte alle aussteigen. Nein, Quatsch.",
      "Zug endet hier. Bitte alle aussteigen.",
      "Nächster Halt: Bärlinerplatz. Umsteigen zur Linie B5.",
      "Achtung an Gleis 2. Der Zug hat leichte Verspätung. Von zwei Stunden.",
      "Nächster Halt: Fernsehturmstraße. Zurückbleiben bitte.",
    ],
    newsHeadlines: [
      "Späti-Preise steigen um 200%",
      "Fernsehturm dreht sich jetzt schneller",
      "Neue U-Bahnlinie B99: Von nirgendwo nach nirgendwo",
      "Currywurst des Jahres gekürt",
      "Kontrolleur*innen bekommen Superkräfte",
      "Berlin bleibt Berlin.",
    ],
  },
};

// Bootstrap + Game-Loop: verbindet Welt, Player, Vehicles, AI, Missions
(function () {
  window.BUG = window.BUG || {};

  let engine, scene, canvas, world, player, ubahn;
  let pedestrians = [], trainRefs = [], carRefs = [], scooterRefs = [];
  let paused = false;
  let lastMinimapTick = 0;

  function init() {
    canvas = document.getElementById('renderCanvas');
    engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;
    window._bugScene = scene;
    BUG.HUD.initMinimap();
    BUG.SFX.init();

    // Ambiente: leichte Nacht
    scene.clearColor = new BABYLON.Color4(0.05, 0.08, 0.14, 1);
    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    hemi.diffuse = new BABYLON.Color3(0.85, 0.9, 1);
    hemi.groundColor = new BABYLON.Color3(0.2, 0.22, 0.28);
    const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.5, -1, -0.3), scene);
    sun.intensity = 0.55;

    // Welt bauen
    const city = BUG.City.build(scene);
    const landmarks = BUG.Landmarks.build(scene);
    ubahn = BUG.UBahn.build(scene);
    world = Object.assign({}, city);
    world.landmarks = landmarks;
    world.stations = ubahn.stations;
    world.linePaths = ubahn.linePaths;
    world.missionTarget = null;
    window._bugWorld = world;

    // Züge: pro Linie ein Zug im Autopilot
    ubahn.lines.forEach((line, i) => {
      const t = BUG.Train.build(scene, line, Math.floor(line.spline.length * (i * 0.15 + 0.05)));
      trainRefs.push(t); BUG.Vehicles.add(t);
    });

    // Ein paar Autos verteilt
    for (let i = 0; i < 6; i++) {
      const x = (Math.random() - 0.5) * 320;
      const z = (Math.random() - 0.5) * 320;
      const colors = ['#c98a2a', '#4d6a8c', '#8a3a3a', '#5a5a5a', '#3a5a3a', '#8a5a3a'];
      const c = BUG.Car.build(scene, x, z, colors[i % colors.length]);
      carRefs.push(c); BUG.Vehicles.add(c);
    }

    // E-Roller
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * 320;
      const z = (Math.random() - 0.5) * 320;
      const sc = BUG.EScooter.build(scene, x, z);
      scooterRefs.push(sc); BUG.Vehicles.add(sc);
    }

    // Spieler
    player = BUG.Player.create(scene, canvas, new BABYLON.Vector3(4, 0, 4));
    window._bugPlayer = player;
    BUG.Inventory.refresh();

    // Passanten
    pedestrians = BUG.Pedestrian.spawn(scene, 40);
    // Ein paar zusätzliche Pfandsammler + Döner-Verkäufer an markanten Orten
    pedestrians.push(BUG.Pedestrian.makePedestrian(scene, 52, -30, 'doener')); // Kotti
    pedestrians.push(BUG.Pedestrian.makePedestrian(scene, 4, 4, 'pfand'));     // Alex

    // Save-Load
    const save = BUG.Storage.load();
    if (save) BUG.Inventory.loadSaveObj(save);

    // Input-Handler: E/F/M/P etc. behandelt Main-Loop, aber Klicks für Fokus
    canvas.addEventListener('click', () => { engine.getRenderingCanvas().focus(); });

    // Render
    engine.runRenderLoop(() => {
      if (!paused) gameLoop();
      scene.render();
    });
    window.addEventListener('resize', () => engine.resize());
  }

  function tryInteract() {
    // Fahrzeug einsteigen wenn keins da
    if (!player.inVehicle) {
      const v = BUG.Vehicles.findNearby(player.root.position, 4.5);
      if (v) { BUG.Vehicles.enterPlayer(player, v); return true; }
      return false;
    } else {
      BUG.Vehicles.ejectPlayer(player);
      return true;
    }
  }

  function saveGame() {
    BUG.Storage.save(BUG.Inventory.toSaveObj());
  }

  let saveTimer = 0;

  function currentLocationName() {
    // Nächste Station oder Landmark
    let best = null, bd = 30;
    for (const s of world.stations) {
      const d = Math.hypot(s.pos.x - player.root.position.x, s.pos.z - player.root.position.z);
      if (d < bd) { bd = d; best = 'Bahnhof ' + s.name; }
    }
    for (const l of world.landmarks) {
      const d = Math.hypot(l.pos.x - player.root.position.x, l.pos.z - player.root.position.z);
      if (d < bd) { bd = d; best = l.name; }
    }
    return best || 'Bärlin-Straße';
  }

  function gameLoop() {
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);

    // Just-pressed Aktionen
    if (player.consumeJustPressed('f')) tryInteract();
    if (player.consumeJustPressed('r')) {
      if (BUG.Inventory.buyTicket()) {
        BUG.HUD.toast('🎫 Ticket gelöst (90s gültig)');
        BUG.SFX.ding();
      } else {
        BUG.HUD.toast('💸 Zu wenig Geld für Ticket (2€)');
        BUG.SFX.fail();
      }
    }
    if (player.consumeJustPressed('q')) {
      player.punch();
      if (BUG.Wanted.tryHitClosest(player.root.position)) {
        BUG.HUD.toast('👊 Getroffen!');
      } else {
        // NPC treffen? Wanted +1
        for (const n of pedestrians) {
          if (n.remove) continue;
          const d = Math.hypot(n.root.position.x - player.root.position.x, n.root.position.z - player.root.position.z);
          if (d < 2.2) {
            BUG.HUD.toast('👊 Autsch! (+1 Stern)');
            BUG.Wanted.setStars(Math.min(5, BUG.Wanted.stars + 1));
            BUG.Dialog.show('👤 „Wat soll dit werden?!"', 2500);
            n.speed = 4; // rennt weg
            break;
          }
        }
      }
    }
    if (player.consumeJustPressed('m')) {
      paused = true;
      setTimeout(() => { BUG.Missions.openMenu(); paused = false; }, 20);
    }
    if (player.consumeJustPressed('p')) {
      paused = !paused;
      BUG.HUD.toast(paused ? '⏸ PAUSE' : '▶ WEITER');
    }
    if (player.consumeJustPressed('escape')) {
      if (player.inVehicle) BUG.Vehicles.ejectPlayer(player);
    }

    // Player / Vehicles
    player.update(dt, world);
    if (player.inVehicle) {
      player.inVehicle.update(dt);
    }
    trainRefs.forEach(t => { if (t !== player.inVehicle) t.update(dt); });
    carRefs.forEach(c => { if (c !== player.inVehicle) c.update(dt); });
    scooterRefs.forEach(s => { if (s !== player.inVehicle) s.update(dt); });

    // Passanten
    const ppos = player.root.position;
    for (const n of pedestrians) { if (!n.remove) n.update(dt, ppos); }

    // Wanted
    BUG.Wanted.update(dt, scene, player, world);

    // Interact-Prompt anzeigen
    const nearVehicle = !player.inVehicle && BUG.Vehicles.findNearby(ppos, 4.5);
    if (nearVehicle) {
      const label = nearVehicle.type === 'train' ? '🚇 Linie ' + nearVehicle.line.code : (nearVehicle.type === 'car' ? '🚗 Auto' : '🛴 Roller');
      BUG.HUD.showInteract(`<b>F</b>  ${label} einsteigen`);
    } else if (player.inVehicle) {
      BUG.HUD.showInteract(`<b>F</b>  aussteigen`);
    } else {
      // Ticket an Bahnhof anbieten
      let nearStation = null;
      for (const s of world.stations) {
        const d = Math.hypot(s.pos.x - ppos.x, s.pos.z - ppos.z);
        if (d < 8) { nearStation = s; break; }
      }
      if (nearStation) BUG.HUD.showInteract(`<b>R</b>  Ticket lösen (2€) für ${nearStation.name}`);
      else BUG.HUD.hideInteract();
    }

    // Missionen
    BUG.Missions.update(dt, world, player);

    // HUD refresh light
    BUG.HUD.setLocation(currentLocationName());
    if (!player.inVehicle || player.inVehicle.type !== 'train') BUG.HUD.setLineInfo('');

    // Minimap alle 100ms
    lastMinimapTick += dt;
    if (lastMinimapTick > 0.1) {
      lastMinimapTick = 0;
      const yaw = player.inVehicle ? player.inVehicle.root.rotation.y : player.root.rotation.y;
      const pos = player.inVehicle ? player.inVehicle.root.position : player.root.position;
      BUG.HUD.drawMinimap(pos, yaw, world);
    }

    // Zerstörte Roller melden
    for (let i = scooterRefs.length - 1; i >= 0; i--) {
      const sc = scooterRefs[i];
      if (sc.tipped && !sc.destroyed) {
        // 3 Sekunden nach Kippen zerstören
        sc._tipTimer = (sc._tipTimer || 0) + dt;
        if (sc._tipTimer > 3) {
          if (player.inVehicle === sc) BUG.Vehicles.ejectPlayer(player);
          sc.destroy();
          scooterRefs.splice(i, 1);
          BUG.Missions.notifyRollerDestroyed();
          BUG.HUD.toast('🛴 Roller zerstört');
        }
      }
    }

    // Auto-Save alle 8s
    saveTimer += dt;
    if (saveTimer > 8) { saveTimer = 0; saveGame(); }

    // Tod?
    if (BUG.Inventory.state.hp <= 0) {
      BUG.Inventory.state.hp = 50;
      BUG.Inventory.addMoney(-Math.min(BUG.Inventory.state.money, 20));
      player.root.position.set(0, 0, 0);
      BUG.Wanted.reset();
      BUG.HUD.toast('💀 Aufgewacht am Alex. -20€');
      BUG.SFX.fail();
    }
  }

  // Startbildschirm
  document.getElementById('startBtn').addEventListener('click', () => {
    BUG.HUD.hideStart();
    BUG.HUD.showHUD();
    init();
    setTimeout(() => {
      BUG.SFX.announce('Willkommen in Bärlin. Nächster Halt: Alexanderplatz.');
      BUG.Dialog.show('🚇 Willkommen in Bärlin! Drücke <span style="color:#00d4b8;">M</span> für Missionen.', 5000);
    }, 800);
  });

  // Rotate news headlines
  const newsEl = document.getElementById('newsText');
  let newsIdx = 0;
  setInterval(() => {
    if (!BUG.CONFIG || !newsEl) return;
    const heads = BUG.CONFIG.humor.newsHeadlines;
    newsIdx = (newsIdx + 1) % heads.length;
    const mix = heads.slice(newsIdx).concat(heads.slice(0, newsIdx)).join('  ·  ');
    newsEl.textContent = '🚇 BBG-News: ' + mix;
  }, 20000);

})();

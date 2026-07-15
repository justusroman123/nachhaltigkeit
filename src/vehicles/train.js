// U-Bahn-Zug — fährt auf Spline einer Linie, Halte an Stationen
window.BUG = window.BUG || {};
BUG.Train = (function () {
  const B_ = () => window.BABYLON;

  function buildWagon(scene, line, wagonIdx) {
    const B = B_(), CityMod = BUG.City;
    const CFG = BUG.CONFIG;
    const root = new B.TransformNode('wagon', scene);
    // Karosserie
    const body = B.MeshBuilder.CreateBox('w_body', { width: 2.6, depth: 12, height: 2.4 }, scene);
    body.position.y = 1.4; body.parent = root;
    body.material = CityMod.mat(scene, CFG.colors.trainBody);
    // Türkis-Streifen
    const stripe = B.MeshBuilder.CreateBox('w_stripe', { width: 2.65, depth: 12.02, height: 0.25 }, scene);
    stripe.position.y = 1.7; stripe.parent = root;
    const sm = CityMod.mat(scene, CFG.colors.trainAccent);
    sm.emissiveColor = new B.Color3(0, 0.3, 0.28);
    stripe.material = sm;
    // Fenster als lange schmale Boxen
    for (let i = -4; i <= 4; i += 2) {
      const win = B.MeshBuilder.CreateBox('w_win', { width: 2.62, depth: 1.6, height: 0.85 }, scene);
      win.position.set(0, 2.0, i); win.parent = root;
      const wm = CityMod.mat(scene, '#0a2028'); wm.alpha = 0.6;
      wm.emissiveColor = new B.Color3(0.1, 0.15, 0.2);
      win.material = wm;
    }
    // Dach
    const roof = B.MeshBuilder.CreateBox('w_roof', { width: 2.6, depth: 12, height: 0.2 }, scene);
    roof.position.y = 2.7; roof.parent = root;
    roof.material = CityMod.mat(scene, '#222');
    // Frontleuchten (nur bei erstem Wagen)
    if (wagonIdx === 0) {
      const front = B.MeshBuilder.CreateBox('w_front', { width: 2.6, depth: 0.2, height: 2.4 }, scene);
      front.position.set(0, 1.4, 6); front.parent = root;
      const fm = CityMod.mat(scene, '#101a20'); front.material = fm;
      const lm = CityMod.mat(scene, '#fff0a0');
      lm.emissiveColor = new B.Color3(1, 0.9, 0.5);
      for (const x of [-0.7, 0.7]) {
        const light = B.MeshBuilder.CreateBox('w_l', { width: 0.35, depth: 0.15, height: 0.25 }, scene);
        light.position.set(x, 0.6, 6.05); light.parent = root; light.material = lm;
      }
    }
    // Linien-Nummer am Frontfenster
    const lp = B.MeshBuilder.CreatePlane('linelabel', { width: 1.6, height: 0.8 }, scene);
    lp.position.set(0, 2.1, wagonIdx === 0 ? 6.05 : -6.05); lp.parent = root;
    if (wagonIdx !== 0) lp.rotation.y = Math.PI;
    const tex = new B.DynamicTexture('lltex', { width: 256, height: 128 }, scene);
    const c = tex.getContext();
    c.fillStyle = line.color; c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#0a1418'; c.font = 'bold 90px sans-serif';
    c.fillText(line.code, 70, 100);
    tex.update();
    const lpm = new B.StandardMaterial('lpm', scene);
    lpm.diffuseTexture = tex; lpm.emissiveTexture = tex;
    lp.material = lpm;

    return root;
  }

  function build(scene, line, splineIdxStart = 0) {
    const B = B_();
    const root = new B.TransformNode('train_' + line.code, scene);
    root.position.y = 0.2;
    // Zwei Wagen aneinander gehängt
    const wagon0 = buildWagon(scene, line, 0);
    wagon0.parent = root;
    wagon0.position.z = 0;
    const wagon1 = buildWagon(scene, line, 1);
    wagon1.parent = root;
    wagon1.position.z = -13;

    const spline = line.spline;
    const stops = line.stationRefs.map(s => {
      // Finde den Spline-Index, der s.pos am nächsten liegt
      let idx = 0, best = Infinity;
      spline.forEach((p, i) => {
        const d = (p.x - s.pos.x) ** 2 + (p.z - s.pos.z) ** 2;
        if (d < best) { best = d; idx = i; }
      });
      return { idx, name: s.name };
    });

    const train = {
      root, wagon0, wagon1, line, driver: null,
      exitOffset: 3.5, type: 'train',
      splineIdx: splineIdxStart, direction: 1, // 1 = vorwärts
      speed: 0, targetStopIdx: 1,
      stopped: true, stopTimer: 2,
      spline, stops,
      hasControl: false,
      lastAnnounce: '',
      onEnter(pl) {
        BUG.HUD.toast(`🚇 Linie ${line.code} — W/S = Gas/Bremse, F = aussteigen`);
        train.hasControl = true;
        // Kontrolleur checkt Ticket beim Einsteigen: Schwarzfahren → 1 Stern
        if (!BUG.Inventory.hasValidTicket()) {
          BUG.Wanted.setStars(Math.max(1, BUG.Wanted.stars));
          BUG.HUD.toast('⚠️ Kein Ticket! Kontrolleur*innen aufmerksam...');
        }
      },
      onExit() { train.hasControl = false; train.stopped = true; train.speed = 0; },
      announce(text) {
        if (this.lastAnnounce === text) return;
        this.lastAnnounce = text;
        BUG.SFX.doorBeep();
        BUG.SFX.announce(text);
        BUG.Dialog.show('📢 ' + text, 3500);
      },
      currentStationName() {
        // Nächstgelegene Station innerhalb Radius 4
        for (const s of stops) {
          const p = spline[s.idx];
          const d = Math.hypot(root.position.x - p.x, root.position.z - p.z);
          if (d < 4) return s.name;
        }
        return null;
      },
      update(dt) {
        const CFG = BUG.CONFIG.vehicles.train;
        // Steuerung
        if (train.driver) {
          const pl = train.driver;
          const throttle = (pl.keys.w ? 1 : 0) - (pl.keys.s ? 1 : 0);
          train.speed += throttle * CFG.accel * dt;
          train.speed = Math.max(0, Math.min(CFG.maxSpeed, train.speed));
          if (!pl.keys.w) train.speed *= 0.995;
          if (pl.keys.s) train.speed = Math.max(0, train.speed - CFG.brake * dt);
        } else {
          // Auto-Pilot Modus: hält an nächster Station 3s, fährt dann weiter
          if (train.stopped) {
            train.stopTimer -= dt;
            if (train.stopTimer <= 0) {
              train.stopped = false;
              train.speed = 0;
              train.targetStopIdx = (train.targetStopIdx + train.direction);
              if (train.targetStopIdx >= stops.length || train.targetStopIdx < 0) {
                train.direction *= -1;
                train.targetStopIdx += train.direction * 2;
              }
              train.announce(BUG.CONFIG.humor.announcements[
                Math.floor((train.targetStopIdx + train.splineIdx * 17) % BUG.CONFIG.humor.announcements.length)
              ]);
            }
          } else {
            const target = stops[train.targetStopIdx];
            const distanceToTarget = Math.abs(target.idx - train.splineIdx);
            const brakeDist = 6;
            if (distanceToTarget < brakeDist) {
              train.speed = Math.max(2, train.speed - CFG.brake * dt);
            } else {
              train.speed = Math.min(CFG.maxSpeed * 0.6, train.speed + CFG.accel * dt);
            }
          }
        }
        // Bewegung auf Spline
        const step = train.speed * dt * 0.6 * train.direction;
        train.splineIdx += step;
        if (train.splineIdx < 0) { train.splineIdx = 0; train.direction = 1; }
        if (train.splineIdx >= spline.length - 1) { train.splineIdx = spline.length - 1.001; train.direction = -1; }
        const i = Math.floor(train.splineIdx);
        const t = train.splineIdx - i;
        const p0 = spline[Math.max(0, i)];
        const p1 = spline[Math.min(spline.length - 1, i + 1)];
        root.position.x = p0.x + (p1.x - p0.x) * t;
        root.position.z = p0.z + (p1.z - p0.z) * t;
        const yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);
        root.rotation.y = yaw + (train.direction < 0 ? Math.PI : 0);

        // Ankunft an Zielstation (Autopilot)
        if (!train.driver) {
          const target = stops[train.targetStopIdx];
          if (Math.abs(target.idx - train.splineIdx) < 0.6 && !train.stopped) {
            train.stopped = true; train.stopTimer = 3.0; train.speed = 0;
            train.announce('Endstation demnächst. Nächster Halt: ' + target.name + '. Zurückbleiben bitte.');
          }
        } else {
          // Manuelle Ansage bei Station in der Nähe
          const cur = train.currentStationName();
          if (cur && train.lastAnnounce !== cur) train.announce('Halt: ' + cur + '. Bitte einsteigen.');
        }

        // Kamera folgt dem ersten Wagen aus leichter Vogelperspektive
        if (train.driver) {
          const cam = train.driver.camera;
          cam.target = new B.Vector3(root.position.x, root.position.y + 2.4, root.position.z);
        }

        BUG.HUD.setLineInfo(`Linie ${line.code} → ${stops[train.targetStopIdx] ? stops[train.targetStopIdx].name : ''}`);
      },
    };
    return train;
  }

  return { build };
})();

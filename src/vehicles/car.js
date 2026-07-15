// Generischer „Oldtimer" — freies Fahren, arcadig
window.BUG = window.BUG || {};
BUG.Car = (function () {
  const B_ = () => window.BABYLON;

  function build(scene, x, z, color) {
    const B = B_(), CityMod = BUG.City;
    const root = new B.TransformNode('car', scene);
    root.position.set(x, 0.35, z);

    // Chassis
    const chassis = B.MeshBuilder.CreateBox('car_ch', { width: 1.7, depth: 3.6, height: 0.9 }, scene);
    chassis.position.y = 0.75; chassis.parent = root;
    chassis.material = CityMod.mat(scene, color || '#c98a2a');
    // Dach
    const roof = B.MeshBuilder.CreateBox('car_roof', { width: 1.5, depth: 1.9, height: 0.7 }, scene);
    roof.position.set(0, 1.55, -0.2); roof.parent = root;
    roof.material = CityMod.mat(scene, color || '#c98a2a');
    // Fenster
    const win = B.MeshBuilder.CreateBox('car_win', { width: 1.35, depth: 1.75, height: 0.55 }, scene);
    win.position.set(0, 1.6, -0.2); win.parent = root;
    const winMat = CityMod.mat(scene, '#0a1418'); winMat.alpha = 0.65;
    winMat.specularColor = new B.Color3(0.6, 0.7, 0.9); win.material = winMat;
    // 4 Räder
    const wheels = [];
    for (const [wx, wz] of [[-0.85, 1.2], [0.85, 1.2], [-0.85, -1.2], [0.85, -1.2]]) {
      const w = B.MeshBuilder.CreateCylinder('car_w', { diameter: 0.7, height: 0.35 }, scene);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.35, wz); w.parent = root;
      w.material = CityMod.mat(scene, '#111');
      wheels.push(w);
    }
    // Scheinwerfer
    const hlMat = CityMod.mat(scene, '#ffe088');
    hlMat.emissiveColor = new B.Color3(1, 0.85, 0.4);
    for (const [wx] of [[-0.55], [0.55]]) {
      const hl = B.MeshBuilder.CreateBox('hl', { width: 0.3, depth: 0.15, height: 0.25 }, scene);
      hl.position.set(wx, 0.9, 1.85); hl.parent = root;
      hl.material = hlMat;
    }

    const car = {
      root, wheels, driver: null, speed: 0,
      exitOffset: 2.5,
      type: 'car',
      onEnter(pl) { BUG.HUD.toast('🚗 Eingestiegen — WASD fährt, F verlässt'); },
      onExit() { car.speed = 0; },
      update(dt) {
        if (!car.driver) return;
        const CFG = BUG.CONFIG.vehicles.car;
        const pl = car.driver;
        const throttle = (pl.keys.w ? 1 : 0) - (pl.keys.s ? 1 : 0);
        const steer = (pl.keys.a ? 1 : 0) - (pl.keys.d ? 1 : 0);
        car.speed += throttle * CFG.accel * dt;
        car.speed *= 0.98; // Luftreibung
        car.speed = Math.max(-CFG.maxSpeed * 0.5, Math.min(CFG.maxSpeed, car.speed));
        // Steer nur bei Bewegung
        const dir = Math.sign(car.speed);
        root.rotation.y += steer * CFG.turn * dt * Math.min(1, Math.abs(car.speed) / 4) * dir;
        const vx = Math.sin(root.rotation.y) * car.speed * dt;
        const vz = Math.cos(root.rotation.y) * car.speed * dt;
        root.position.x += vx;
        root.position.z += vz;
        // Räder drehen
        wheels.forEach(w => { w.rotation.x += car.speed * dt * 2; });
        // Hup
        if (pl.consumeJustPressed && pl.consumeJustPressed('e')) BUG.SFX.honk();
        // Kamera folgt vom Fahrzeug
        const cam = pl.camera;
        cam.target = new B.Vector3(root.position.x, root.position.y + 1.2, root.position.z);
      },
    };

    return car;
  }

  return { build };
})();

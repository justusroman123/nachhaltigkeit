// E-Scooter — schnell, kippt bei zu enger Kurve
window.BUG = window.BUG || {};
BUG.EScooter = (function () {
  const B_ = () => window.BABYLON;

  function build(scene, x, z) {
    const B = B_(), CityMod = BUG.City;
    const root = new B.TransformNode('scooter', scene);
    root.position.set(x, 0.2, z);
    // Trittbrett
    const deck = B.MeshBuilder.CreateBox('sc_deck', { width: 0.35, depth: 1.1, height: 0.1 }, scene);
    deck.position.y = 0.2; deck.parent = root;
    deck.material = CityMod.mat(scene, '#222');
    // Stange
    const bar = B.MeshBuilder.CreateCylinder('sc_bar', { diameter: 0.08, height: 1.1 }, scene);
    bar.position.set(0, 0.75, 0.5); bar.parent = root;
    bar.material = CityMod.mat(scene, '#c9c9c9');
    // Lenker
    const handle = B.MeshBuilder.CreateCylinder('sc_h', { diameter: 0.06, height: 0.6 }, scene);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 1.25, 0.5); handle.parent = root;
    handle.material = CityMod.mat(scene, '#c9c9c9');
    // Räder
    const w1 = B.MeshBuilder.CreateCylinder('sc_w', { diameter: 0.35, height: 0.1 }, scene);
    w1.rotation.z = Math.PI / 2;
    w1.position.set(0, 0.17, 0.5); w1.parent = root;
    w1.material = CityMod.mat(scene, '#111');
    const w2 = B.MeshBuilder.CreateCylinder('sc_w2', { diameter: 0.35, height: 0.1 }, scene);
    w2.rotation.z = Math.PI / 2;
    w2.position.set(0, 0.17, -0.5); w2.parent = root;
    w2.material = CityMod.mat(scene, '#111');

    const sc = {
      root, driver: null, speed: 0, tipped: false,
      exitOffset: 1.2, type: 'scooter',
      onEnter(pl) { BUG.HUD.toast('🛴 Roller — WASD, kippt bei Vollgas-Kurve'); },
      onExit() { sc.speed = 0; },
      destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        root.dispose();
        const list = BUG.Vehicles.all();
        const i = list.indexOf(this); if (i >= 0) list.splice(i, 1);
      },
      update(dt) {
        if (sc.tipped) {
          root.rotation.z = Math.min(root.rotation.z + dt * 2, Math.PI / 2);
          return;
        }
        if (!sc.driver) return;
        const CFG = BUG.CONFIG.vehicles.escooter;
        const pl = sc.driver;
        const throttle = (pl.keys.w ? 1 : 0) - (pl.keys.s ? 1 : 0);
        const steer = (pl.keys.a ? 1 : 0) - (pl.keys.d ? 1 : 0);
        sc.speed += throttle * CFG.accel * dt;
        sc.speed *= 0.97;
        sc.speed = Math.max(-CFG.maxSpeed * 0.4, Math.min(CFG.maxSpeed, sc.speed));
        const dir = Math.sign(sc.speed);
        root.rotation.y += steer * CFG.turn * dt * Math.min(1, Math.abs(sc.speed) / 3) * dir;
        // Kippen bei Vollgas + starkem Lenken
        if (Math.abs(sc.speed) > CFG.tipAt && Math.abs(steer) > 0.5) {
          sc.tipped = true;
          BUG.HUD.toast('🛴 Der Roller kippt weg! (F zum Aussteigen)');
          BUG.SFX.hit();
          if (pl && BUG.Inventory.hurt(15)) BUG.HUD.toast('💀 Autsch.');
        }
        const vx = Math.sin(root.rotation.y) * sc.speed * dt;
        const vz = Math.cos(root.rotation.y) * sc.speed * dt;
        root.position.x += vx; root.position.z += vz;
        const cam = pl.camera;
        cam.target = new B.Vector3(root.position.x, root.position.y + 1, root.position.z);
      },
    };
    return sc;
  }

  return { build };
})();

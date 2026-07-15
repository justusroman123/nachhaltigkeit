// Kontrolleur*innen: verfolgen den Spieler wenn ohne Ticket im Zug/Bahnhof
window.BUG = window.BUG || {};
BUG.Kontrolleur = (function () {
  const B_ = () => window.BABYLON;

  function build(scene, x, z) {
    const B = B_(), CityMod = BUG.City;
    const CFG = BUG.CONFIG;
    const root = new B.TransformNode('kontr', scene);
    root.position.set(x, 0, z);

    // Dunkelrote Uniform, sehr erkennbar
    const body = B.MeshBuilder.CreateBox('kb', { width: 0.75, depth: 0.4, height: 1.25 }, scene);
    body.position.y = 1.15; body.parent = root;
    body.material = CityMod.mat(scene, CFG.colors.kontrolleur);
    // Kopf
    const head = B.MeshBuilder.CreateSphere('kh', { diameter: 0.55 }, scene);
    head.position.y = 2.05; head.parent = root;
    head.material = CityMod.mat(scene, '#c99976');
    // Mütze
    const cap = B.MeshBuilder.CreateCylinder('kc', { diameter: 0.62, height: 0.22 }, scene);
    cap.position.y = 2.35; cap.parent = root;
    cap.material = CityMod.mat(scene, '#111');
    // Abzeichen
    const badge = B.MeshBuilder.CreateBox('kbd', { width: 0.35, depth: 0.05, height: 0.35 }, scene);
    badge.position.set(0, 1.5, 0.22); badge.parent = root;
    const gm = CityMod.mat(scene, '#e8c94a');
    gm.emissiveColor = new B.Color3(0.4, 0.3, 0.05);
    badge.material = gm;
    // Beine
    const legL = B.MeshBuilder.CreateBox('klL', { width: 0.26, depth: 0.26, height: 0.9 }, scene);
    legL.position.set(-0.16, 0.45, 0); legL.parent = root;
    legL.material = CityMod.mat(scene, '#1a1a1a');
    const legR = B.MeshBuilder.CreateBox('klR', { width: 0.26, depth: 0.26, height: 0.9 }, scene);
    legR.position.set(0.16, 0.45, 0); legR.parent = root;
    legR.material = CityMod.mat(scene, '#1a1a1a');

    const k = {
      root, legL, legR, walkPhase: 0,
      chaseTarget: null, chaseCooldown: 0,
      quipCooldown: 3, hp: 60, remove: false,
      catchDistance: 1.8,
      dispose() { root.dispose(); this.remove = true; },
      hurt(n) {
        this.hp -= n;
        if (this.hp <= 0) {
          BUG.HUD.toast('👊 Kontrolleur*in K.O.! (+1 Stern Fahndung)');
          BUG.Wanted.setStars(Math.max(BUG.Wanted.stars + 1, 2));
          BUG.Inventory.addMoney(5); // Trinkgeld übrig lassen
          this.dispose();
        }
      },
      update(dt, player) {
        if (!this.chaseTarget) return;
        const dx = player.root.position.x - this.root.position.x;
        const dz = player.root.position.z - this.root.position.z;
        const d = Math.hypot(dx, dz);
        // Fangen
        if (d < this.catchDistance) {
          BUG.HUD.toast('🚨 Erwischt! Strafe: 60 €');
          BUG.Inventory.addMoney(-60);
          BUG.Inventory.hurt(5);
          BUG.Wanted.setStars(0);
          BUG.Inventory.invalidateTicket();
          BUG.SFX.fail();
          // Teleport player raus, kontrolleur verschwindet
          player.root.position.y = 0;
          const dir = Math.random() * Math.PI * 2;
          player.root.position.x += Math.cos(dir) * 6;
          player.root.position.z += Math.sin(dir) * 6;
          this.dispose();
          return;
        }
        // Verfolgung
        const speed = BUG.CONFIG.wanted.kontrolleurSpeed;
        this.root.position.x += (dx / d) * speed * dt;
        this.root.position.z += (dz / d) * speed * dt;
        this.root.rotation.y = Math.atan2(dx, dz);
        this.walkPhase += dt * 12;
        const sw = Math.sin(this.walkPhase) * 0.7;
        this.legL.rotation.x = sw; this.legR.rotation.x = -sw;

        this.quipCooldown -= dt;
        if (this.quipCooldown <= 0 && d < 25) {
          const quips = BUG.CONFIG.humor.kontrolleurQuips;
          BUG.Dialog.show('🚨 „' + quips[Math.floor(Math.random() * quips.length)] + '"', 2000);
          this.quipCooldown = 4 + Math.random() * 3;
        }
      },
    };
    return k;
  }

  return { build };
})();

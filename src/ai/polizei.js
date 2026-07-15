// Wanted-System + Polizei-NPCs (ab 2 Sternen)
window.BUG = window.BUG || {};
BUG.Polizei = (function () {
  const B_ = () => window.BABYLON;

  function build(scene, x, z) {
    const B = B_(), CityMod = BUG.City;
    const CFG = BUG.CONFIG;
    const root = new B.TransformNode('polizei', scene);
    root.position.set(x, 0, z);

    const body = B.MeshBuilder.CreateBox('pb', { width: 0.8, depth: 0.4, height: 1.3 }, scene);
    body.position.y = 1.2; body.parent = root;
    body.material = CityMod.mat(scene, CFG.colors.polizei);
    const head = B.MeshBuilder.CreateSphere('ph', { diameter: 0.55 }, scene);
    head.position.y = 2.1; head.parent = root;
    head.material = CityMod.mat(scene, '#e0b898');
    const cap = B.MeshBuilder.CreateCylinder('pc', { diameter: 0.6, height: 0.22 }, scene);
    cap.position.y = 2.38; cap.parent = root;
    cap.material = CityMod.mat(scene, CFG.colors.polizei);
    const legL = B.MeshBuilder.CreateBox('plL', { width: 0.28, depth: 0.28, height: 0.9 }, scene);
    legL.position.set(-0.17, 0.45, 0); legL.parent = root;
    legL.material = CityMod.mat(scene, '#0a1a3a');
    const legR = B.MeshBuilder.CreateBox('plR', { width: 0.28, depth: 0.28, height: 0.9 }, scene);
    legR.position.set(0.17, 0.45, 0); legR.parent = root;
    legR.material = CityMod.mat(scene, '#0a1a3a');

    const p = {
      root, legL, legR, walkPhase: 0, hp: 100, remove: false,
      dispose() { root.dispose(); this.remove = true; },
      hurt(n) {
        this.hp -= n;
        if (this.hp <= 0) {
          BUG.HUD.toast('👮 Polizist K.O.! (+1 Stern)');
          BUG.Wanted.setStars(Math.min(5, BUG.Wanted.stars + 1));
          this.dispose();
        }
      },
      update(dt, player) {
        const dx = player.root.position.x - this.root.position.x;
        const dz = player.root.position.z - this.root.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.8) {
          BUG.HUD.toast('🚨 Festgenommen! Alles verloren...');
          BUG.Inventory.addMoney(-Math.min(BUG.Inventory.state.money, 100));
          BUG.Inventory.hurt(15);
          BUG.Wanted.setStars(0);
          BUG.SFX.police();
          // Zurück zum Alex
          player.root.position.set(0, 0, 0);
          this.dispose();
          return;
        }
        const speed = BUG.CONFIG.wanted.polizeiSpeed;
        this.root.position.x += (dx / d) * speed * dt;
        this.root.position.z += (dz / d) * speed * dt;
        this.root.rotation.y = Math.atan2(dx, dz);
        this.walkPhase += dt * 14;
        const sw = Math.sin(this.walkPhase) * 0.8;
        this.legL.rotation.x = sw; this.legR.rotation.x = -sw;

        // gelegentlich sirene
        if (Math.random() < 0.005) BUG.SFX.police();
      },
    };
    return p;
  }

  return { build };
})();

// Wanted-Manager (globaler Sterne-Zähler + spawn-Regeln)
BUG.Wanted = (function () {
  const state = {
    stars: 0,
    kontrolleure: [],
    polizisten: [],
    decayTimer: 0,
    spawnCooldown: 0,
  };

  return {
    get stars() { return state.stars; },
    setStars(n) {
      state.stars = Math.max(0, Math.min(5, n));
      BUG.HUD.setStars(state.stars);
      if (state.stars > 0) BUG.SFX.whistle();
    },
    kontrolleure: state.kontrolleure,
    polizisten: state.polizisten,
    reset() {
      state.kontrolleure.forEach(k => k.dispose());
      state.polizisten.forEach(p => p.dispose());
      state.kontrolleure.length = 0; state.polizisten.length = 0;
      this.setStars(0);
    },
    update(dt, scene, player, world) {
      // Sterne decayen wenn nah an Sträuchern und keine Verfolger in Nähe
      let hidden = false;
      for (const b of world.spawnBushes) {
        const d = Math.hypot(b.pos.x - player.root.position.x, b.pos.z - player.root.position.z);
        if (d < BUG.CONFIG.wanted.hidingRadius) { hidden = true; break; }
      }
      state.decayTimer += dt;
      if (hidden && state.decayTimer > BUG.CONFIG.wanted.starDecayEverySeconds && state.stars > 0) {
        this.setStars(state.stars - 1);
        state.decayTimer = 0;
        BUG.HUD.toast('👀 Ein Stern verloren (versteckt)');
      }

      // Spawn neuer Kontrolleur*innen wenn Sterne > 0 und im Bahnhofsumkreis
      state.spawnCooldown -= dt;
      if (state.stars >= 1 && state.spawnCooldown <= 0) {
        // Prüfe Nähe zu Station oder in Zug
        const inTrain = player.inVehicle && player.inVehicle.type === 'train';
        let atStation = false;
        for (const s of world.stations) {
          const d = Math.hypot(s.pos.x - (player.inVehicle ? player.inVehicle.root.position.x : player.root.position.x),
                               s.pos.z - (player.inVehicle ? player.inVehicle.root.position.z : player.root.position.z));
          if (d < 15) { atStation = true; break; }
        }
        if (atStation || inTrain) {
          if (state.kontrolleure.filter(k => !k.remove).length < state.stars * 2) {
            // Spawne 20-25m entfernt
            const ang = Math.random() * Math.PI * 2;
            const dist = 22;
            const px = player.root.position.x + Math.cos(ang) * dist;
            const pz = player.root.position.z + Math.sin(ang) * dist;
            const k = BUG.Kontrolleur.build(scene, px, pz);
            k.chaseTarget = player;
            state.kontrolleure.push(k);
            BUG.HUD.toast('🚨 Kontrolleur*in taucht auf!');
          }
          state.spawnCooldown = 10 - state.stars;
        }
      }
      // Polizei ab 2 Sternen
      if (state.stars >= 2 && state.spawnCooldown <= 0) {
        if (state.polizisten.filter(p => !p.remove).length < state.stars) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 30;
          const px = player.root.position.x + Math.cos(ang) * dist;
          const pz = player.root.position.z + Math.sin(ang) * dist;
          const p = BUG.Polizei.build(scene, px, pz);
          state.polizisten.push(p);
          state.spawnCooldown = 12;
        }
      }

      // Update alle
      state.kontrolleure.forEach(k => k.update(dt, player));
      state.polizisten.forEach(p => p.update(dt, player));
      // Cleanup
      for (let i = state.kontrolleure.length - 1; i >= 0; i--) if (state.kontrolleure[i].remove) state.kontrolleure.splice(i, 1);
      for (let i = state.polizisten.length - 1; i >= 0; i--) if (state.polizisten[i].remove) state.polizisten.splice(i, 1);
    },
    // Vom Spieler-Faust getroffen: nächster in 2m
    tryHitClosest(playerPos) {
      let best = null, bd = 4;
      for (const k of state.kontrolleure) {
        const d = Math.hypot(k.root.position.x - playerPos.x, k.root.position.z - playerPos.z);
        if (d < bd) { bd = d; best = k; }
      }
      for (const p of state.polizisten) {
        const d = Math.hypot(p.root.position.x - playerPos.x, p.root.position.z - playerPos.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) { best.hurt(30); return true; }
      return false;
    },
  };
})();

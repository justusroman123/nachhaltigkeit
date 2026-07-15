// Passanten: Berliner NPCs mit zufälligen Sprüchen, Pfandsammler, Döner-Verkäufer
window.BUG = window.BUG || {};
BUG.Pedestrian = (function () {
  const B_ = () => window.BABYLON;

  function buildFigure(scene, skinHex, shirtHex, pantsHex, hatHex) {
    const B = B_(), CityMod = BUG.City;
    const root = new B.TransformNode('npc', scene);
    const body = B.MeshBuilder.CreateBox('n_b', { width: 0.65, depth: 0.35, height: 1.1 }, scene);
    body.position.y = 1.05; body.parent = root;
    body.material = CityMod.mat(scene, shirtHex);
    const head = B.MeshBuilder.CreateSphere('n_h', { diameter: 0.52 }, scene);
    head.position.y = 1.9; head.parent = root;
    head.material = CityMod.mat(scene, skinHex);
    if (hatHex) {
      const hat = B.MeshBuilder.CreateCylinder('n_hat', { diameter: 0.58, height: 0.2 }, scene);
      hat.position.y = 2.17; hat.parent = root;
      hat.material = CityMod.mat(scene, hatHex);
    }
    const legL = B.MeshBuilder.CreateBox('n_lL', { width: 0.24, depth: 0.24, height: 0.9 }, scene);
    legL.position.set(-0.16, 0.45, 0); legL.parent = root;
    legL.material = CityMod.mat(scene, pantsHex);
    const legR = B.MeshBuilder.CreateBox('n_lR', { width: 0.24, depth: 0.24, height: 0.9 }, scene);
    legR.position.set(0.16, 0.45, 0); legR.parent = root;
    legR.material = CityMod.mat(scene, pantsHex);
    return { root, body, head, legL, legR };
  }

  function makePedestrian(scene, x, z, kind) {
    const B = B_();
    const CFG = BUG.CONFIG;
    const skinArr = CFG.colors.npcSkin;
    const skin = skinArr[Math.floor(Math.random() * skinArr.length)];
    const shirtColors = ['#c33', '#3a6', '#c69', '#39c', '#963', '#606', '#c96', '#369', '#a83', '#666'];
    const pantsColors = ['#333', '#446', '#221', '#547', '#324'];
    let shirt = shirtColors[Math.floor(Math.random() * shirtColors.length)];
    let pants = pantsColors[Math.floor(Math.random() * pantsColors.length)];
    let hat = Math.random() < 0.4 ? shirtColors[Math.floor(Math.random() * shirtColors.length)] : null;

    if (kind === 'pfand') { shirt = '#5a4a3a'; pants = '#332211'; hat = '#8a7a5a'; }
    if (kind === 'doener') { shirt = '#eeeeee'; pants = '#221'; hat = null; }

    const fig = buildFigure(scene, skin, shirt, pants, hat);
    fig.root.position.set(x, 0, z);

    // Pfandsammler: schleppt Beutel
    if (kind === 'pfand') {
      const bag = B.MeshBuilder.CreateBox('bag', { width: 0.5, depth: 0.4, height: 0.7 }, scene);
      bag.position.set(0.5, 0.35, 0); bag.parent = fig.root;
      bag.material = BUG.City.mat(scene, '#2a2a2a');
    }

    const npc = {
      root: fig.root, parts: fig, kind, walkPhase: Math.random() * Math.PI * 2,
      targetX: x + (Math.random() - 0.5) * 40,
      targetZ: z + (Math.random() - 0.5) * 40,
      speed: kind === 'pfand' ? 1.2 : (1.6 + Math.random() * 0.8),
      quipCooldown: 5 + Math.random() * 10,
      speakInRange: 4,
      remove: false,
      dispose() {
        fig.root.dispose();
        this.remove = true;
      },
      update(dt, playerPos) {
        // Wander
        const dx = this.targetX - this.root.position.x;
        const dz = this.targetZ - this.root.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) {
          this.targetX = this.root.position.x + (Math.random() - 0.5) * 30;
          this.targetZ = this.root.position.z + (Math.random() - 0.5) * 30;
          // Halt im Weltrand
          const H = BUG.CONFIG.world.size / 2 - 6;
          this.targetX = Math.max(-H, Math.min(H, this.targetX));
          this.targetZ = Math.max(-H, Math.min(H, this.targetZ));
        } else {
          this.root.position.x += (dx / d) * this.speed * dt;
          this.root.position.z += (dz / d) * this.speed * dt;
          this.root.rotation.y = Math.atan2(dx, dz);
          this.walkPhase += dt * 6;
          const sw = Math.sin(this.walkPhase) * 0.5;
          fig.legL.rotation.x = sw; fig.legR.rotation.x = -sw;
        }
        // Sprechen
        this.quipCooldown -= dt;
        if (this.quipCooldown <= 0 && playerPos) {
          const pd = Math.hypot(playerPos.x - this.root.position.x, playerPos.z - this.root.position.z);
          if (pd < this.speakInRange) {
            let quips = BUG.CONFIG.humor.npcQuips;
            if (this.kind === 'pfand') quips = BUG.CONFIG.humor.pfandQuips;
            if (this.kind === 'doener') quips = BUG.CONFIG.humor.dealerQuips;
            const q = quips[Math.floor(Math.random() * quips.length)];
            BUG.Dialog.show(`👤 „${q}"`, 2000);
          }
          this.quipCooldown = 8 + Math.random() * 12;
        }
      },
    };
    return npc;
  }

  function spawn(scene, count) {
    const list = [];
    const H = BUG.CONFIG.world.size / 2 - 10;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * H * 2;
      const z = (Math.random() - 0.5) * H * 2;
      const roll = Math.random();
      const kind = roll < 0.15 ? 'pfand' : (roll < 0.22 ? 'doener' : 'normal');
      list.push(makePedestrian(scene, x, z, kind));
    }
    return list;
  }

  return { spawn, makePedestrian };
})();

// Stadt: Boden, Straßenraster, Häuserblocks, Spree, Bäume
window.BUG = window.BUG || {};
BUG.City = (function () {
  const BABYLON_ = () => window.BABYLON;

  function pickColor(hexArr) {
    return hexArr[Math.floor(Math.random() * hexArr.length)];
  }
  function hexToColor3(hex) {
    const B = BABYLON_();
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return new B.Color3(r, g, b);
  }

  function mat(scene, hex, name) {
    const B = BABYLON_();
    const m = new B.StandardMaterial(name || ('m_' + hex), scene);
    m.diffuseColor = hexToColor3(hex);
    m.specularColor = new B.Color3(0.05, 0.05, 0.05);
    return m;
  }

  function windowTexture(scene, seed) {
    const B = BABYLON_();
    const tx = new B.DynamicTexture('wtx_' + seed, { width: 256, height: 512 }, scene);
    const ctx = tx.getContext();
    // wall base
    ctx.fillStyle = '#8a7358';
    ctx.fillRect(0, 0, 256, 512);
    // windows grid
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
        const on = Math.random() < 0.55;
        ctx.fillStyle = on ? '#ffdc7a' : '#2a2620';
        ctx.fillRect(20 + col * 56, 30 + row * 58, 40, 40);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(20 + col * 56, 30 + row * 58, 40, 3);
        ctx.fillRect(20 + col * 56 + 18, 30 + row * 58, 4, 40);
      }
    }
    tx.update();
    return tx;
  }

  function build(scene) {
    const B = BABYLON_();
    const CFG = BUG.CONFIG;
    const world = {
      ground: null, buildings: [], trees: [], streetlights: [], colliders: [],
      spawnBushes: [], // Verstecke: Sträucher etc.
      spree: null,
      landmarks: [], stations: [], linePaths: [],
    };

    // Ground
    const ground = B.MeshBuilder.CreateGround('ground',
      { width: CFG.world.size + 100, height: CFG.world.size + 100, subdivisions: 4 }, scene);
    const gmat = new B.StandardMaterial('gmat', scene);
    gmat.diffuseColor = new B.Color3(...CFG.world.groundColor);
    gmat.specularColor = new B.Color3(0, 0, 0);
    ground.material = gmat;
    ground.receiveShadows = true;
    world.ground = ground;

    // Fog + Skybox
    scene.fogMode = B.Scene.FOGMODE_EXP2;
    scene.fogColor = new B.Color3(0.08, 0.10, 0.14);
    scene.fogDensity = CFG.world.fogDensity;

    // Streets (asphalt strips) — grid every 40m
    const streetMat = new B.StandardMaterial('street', scene);
    streetMat.diffuseColor = new B.Color3(0.10, 0.10, 0.11);
    streetMat.specularColor = new B.Color3(0, 0, 0);

    const H = CFG.world.size / 2;
    for (let x = -H; x <= H; x += 40) {
      const s = B.MeshBuilder.CreateGround('sx_' + x, { width: 8, height: CFG.world.size }, scene);
      s.position.x = x; s.position.y = 0.02;
      s.material = streetMat;
    }
    for (let z = -H; z <= H; z += 40) {
      const s = B.MeshBuilder.CreateGround('sz_' + z, { width: CFG.world.size, height: 8 }, scene);
      s.position.z = z; s.position.y = 0.02;
      s.material = streetMat;
    }

    // Sidewalk stripe next to streets
    const walkMat = new B.StandardMaterial('walk', scene);
    walkMat.diffuseColor = new B.Color3(0.35, 0.35, 0.38);
    walkMat.specularColor = new B.Color3(0, 0, 0);

    // Häuserblocks: pro 40x40-Zelle 1-3 Gebäude
    const blockSize = 40, padding = 6;
    for (let bx = -H + blockSize/2; bx < H; bx += blockSize) {
      for (let bz = -H + blockSize/2; bz < H; bz += blockSize) {
        // Kein Bau: um Spree, oder wenn in Landmark-Zone
        if (Math.abs(bz + 40) < 12) continue; // Spree bei z=-40
        if (Math.hypot(bx, bz) < 26) continue; // Alex central
        if (Math.hypot(bx - 120, bz - 80) < 30) continue; // Fernsehturm-Umgebung
        if (Math.hypot(bx + 130, bz - 20) < 24) continue; // Brandenburger Tor
        if (Math.hypot(bx + 100, bz + 60) < 22) continue; // Reichstag
        if (Math.hypot(bx - 50, bz - 50) < 18) continue; // Dom

        const nBuildings = 1 + Math.floor(Math.random() * 3);
        for (let n = 0; n < nBuildings; n++) {
          const w = 8 + Math.random() * 10;
          const d = 8 + Math.random() * 10;
          const h = 6 + Math.random() * 22;
          const ox = bx + (Math.random() - 0.5) * (blockSize - w - padding * 2);
          const oz = bz + (Math.random() - 0.5) * (blockSize - d - padding * 2);
          // Kein Haus mitten auf Straße
          if (Math.abs(ox % 40) < 6 || Math.abs(oz % 40) < 6) continue;
          const box = B.MeshBuilder.CreateBox('bld', { width: w, depth: d, height: h }, scene);
          box.position.set(ox, h/2, oz);
          box.rotation.y = Math.random() < 0.5 ? 0 : Math.PI/2;
          const facadeHex = pickColor(CFG.colors.building);
          const bmat = new B.StandardMaterial('bmat', scene);
          bmat.diffuseColor = hexToColor3(facadeHex);
          if (h > 10) {
            bmat.diffuseTexture = windowTexture(scene, ox + '_' + oz);
            bmat.diffuseTexture.uScale = Math.max(1, Math.round(w / 6));
            bmat.diffuseTexture.vScale = Math.max(1, Math.round(h / 6));
          }
          bmat.specularColor = new B.Color3(0.02, 0.02, 0.02);
          box.material = bmat;
          box.checkCollisions = true;
          world.buildings.push(box);
          world.colliders.push(box);

          // Roof detail
          const roof = B.MeshBuilder.CreateBox('roof', { width: w * 1.05, depth: d * 1.05, height: 0.4 }, scene);
          roof.position.set(ox, h + 0.2, oz);
          roof.material = mat(scene, '#403830');
        }
      }
    }

    // Spree — großes langgezogenes flaches Blau
    const river = B.MeshBuilder.CreateGround('river', { width: CFG.world.size + 60, height: 22, subdivisions: 20 }, scene);
    river.position.set(0, 0.04, -40);
    const wmat = new B.StandardMaterial('water', scene);
    wmat.diffuseColor = new B.Color3(0.10, 0.30, 0.42);
    wmat.specularColor = new B.Color3(0.6, 0.7, 0.9);
    wmat.specularPower = 64;
    wmat.alpha = 0.9;
    river.material = wmat;
    world.spree = river;

    // Ufer-Kante
    const bankMat = mat(scene, '#5a4a38');
    for (const zoff of [-52, -28]) {
      const bank = B.MeshBuilder.CreateBox('bank', { width: CFG.world.size + 60, depth: 1.2, height: 0.6 }, scene);
      bank.position.set(0, 0.3, zoff);
      bank.material = bankMat;
    }

    // Bäume + Sträucher (Verstecke)
    const trunkMat = mat(scene, '#4a3826');
    const leafMats = ['#3d5c2d', '#4a6b34', '#5e7a3a', '#365428'].map(h => mat(scene, h));
    for (let i = 0; i < 90; i++) {
      const x = (Math.random() - 0.5) * (CFG.world.size - 20);
      const z = (Math.random() - 0.5) * (CFG.world.size - 20);
      // Not on street
      if (Math.abs(x % 40) < 5 || Math.abs(z % 40) < 5) continue;
      if (Math.abs(z + 40) < 12) continue; // not in river
      const trunk = B.MeshBuilder.CreateCylinder('trunk', { diameter: 0.35, height: 2.2 }, scene);
      trunk.position.set(x, 1.1, z);
      trunk.material = trunkMat;
      const leaves = B.MeshBuilder.CreateSphere('leaves', { diameter: 2.8 + Math.random() * 1.5 }, scene);
      leaves.position.set(x, 2.8, z);
      leaves.material = leafMats[Math.floor(Math.random() * leafMats.length)];
      world.trees.push(trunk, leaves);
    }
    // Sträucher als Verstecke
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * (CFG.world.size - 20);
      const z = (Math.random() - 0.5) * (CFG.world.size - 20);
      if (Math.abs(x % 40) < 5 || Math.abs(z % 40) < 5) continue;
      if (Math.abs(z + 40) < 14) continue;
      const bush = B.MeshBuilder.CreateSphere('bush', { diameter: 1.6, segments: 8 }, scene);
      bush.position.set(x, 0.7, z);
      bush.scaling.y = 0.6;
      bush.material = leafMats[Math.floor(Math.random() * leafMats.length)];
      world.spawnBushes.push({ mesh: bush, pos: bush.position });
    }

    // Straßenlaternen an Kreuzungen
    const lampBase = mat(scene, '#222');
    const lampLight = mat(scene, '#ffe0a0');
    lampLight.emissiveColor = new B.Color3(1, 0.85, 0.5);
    for (let x = -H; x <= H; x += 40) {
      for (let z = -H; z <= H; z += 40) {
        if (Math.random() > 0.5) continue;
        const pole = B.MeshBuilder.CreateCylinder('pole', { diameter: 0.2, height: 4.5 }, scene);
        pole.position.set(x + 5, 2.25, z + 5);
        pole.material = lampBase;
        const top = B.MeshBuilder.CreateSphere('top', { diameter: 0.5 }, scene);
        top.position.set(x + 5, 4.6, z + 5);
        top.material = lampLight;
        world.streetlights.push({ pole, top });
      }
    }

    return world;
  }

  return { build, mat, hexToColor3, pickColor };
})();

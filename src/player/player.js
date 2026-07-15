// Fußgänger-Charakter mit 3rd-Person-Kamera, WASD, Sprint, Springen, Faust
window.BUG = window.BUG || {};
BUG.Player = (function () {
  const B_ = () => window.BABYLON;

  function buildCharacter(scene) {
    const B = B_(), CityMod = BUG.City;
    const root = new B.TransformNode('player', scene);
    // Körper (Kapsel-Näherung als Box)
    const body = B.MeshBuilder.CreateBox('pl_body', { width: 0.7, depth: 0.4, height: 1.2 }, scene);
    body.position.y = 1.1; body.parent = root;
    body.material = CityMod.mat(scene, '#3a6fa8'); // blaue Jacke
    // Kopf
    const head = B.MeshBuilder.CreateSphere('pl_head', { diameter: 0.55 }, scene);
    head.position.y = 2.0; head.parent = root;
    head.material = CityMod.mat(scene, '#f2d3b0');
    // Mütze
    const cap = B.MeshBuilder.CreateCylinder('pl_cap', { diameter: 0.62, height: 0.2 }, scene);
    cap.position.y = 2.28; cap.parent = root;
    cap.material = CityMod.mat(scene, '#111');
    // Beine
    const legL = B.MeshBuilder.CreateBox('pl_lL', { width: 0.28, depth: 0.28, height: 0.9 }, scene);
    legL.position.set(-0.18, 0.45, 0); legL.parent = root;
    legL.material = CityMod.mat(scene, '#1e2530');
    const legR = B.MeshBuilder.CreateBox('pl_lR', { width: 0.28, depth: 0.28, height: 0.9 }, scene);
    legR.position.set(0.18, 0.45, 0); legR.parent = root;
    legR.material = CityMod.mat(scene, '#1e2530');
    // Arme
    const armL = B.MeshBuilder.CreateBox('pl_aL', { width: 0.22, depth: 0.22, height: 0.95 }, scene);
    armL.position.set(-0.48, 1.15, 0); armL.parent = root;
    armL.material = CityMod.mat(scene, '#3a6fa8');
    const armR = B.MeshBuilder.CreateBox('pl_aR', { width: 0.22, depth: 0.22, height: 0.95 }, scene);
    armR.position.set(0.48, 1.15, 0); armR.parent = root;
    armR.material = CityMod.mat(scene, '#3a6fa8');

    return { root, parts: { body, head, cap, legL, legR, armL, armR } };
  }

  function create(scene, canvas, spawnPos) {
    const B = B_(), CFG = BUG.CONFIG;
    const char = buildCharacter(scene);
    char.root.position.copyFrom(spawnPos);

    // 3rd-person orbital camera folgt Spieler
    const cam = new B.ArcRotateCamera('cam',
      -Math.PI / 2, Math.PI / 2.5, CFG.camera.followDistance,
      char.root.position.clone(), scene);
    cam.wheelDeltaPercentage = 0.02;
    cam.lowerRadiusLimit = CFG.camera.minZoom;
    cam.upperRadiusLimit = CFG.camera.maxZoom;
    cam.lowerBetaLimit = 0.15;
    cam.upperBetaLimit = Math.PI / 2 - 0.1;
    cam.attachControl(canvas, true);
    cam.checkCollisions = false;
    cam.collisionRadius = new B.Vector3(0.6, 0.6, 0.6);

    // Input state
    const keys = { w:0, a:0, s:0, d:0, shift:0, space:0, e:0, f:0, r:0, q:0, m:0, p:0 };
    const held = {};
    function onKey(e, down) {
      const k = e.key.toLowerCase();
      const map = { arrowup:'w', arrowdown:'s', arrowleft:'a', arrowright:'d', shift:'shift', ' ':'space',
                    e:'e', f:'f', r:'r', q:'q', m:'m', p:'p', escape:'escape', w:'w', a:'a', s:'s', d:'d' };
      const mapped = map[k];
      if (mapped && Object.prototype.hasOwnProperty.call(keys, mapped)) {
        keys[mapped] = down ? 1 : 0;
        held[mapped] = down;
        // Buffered "just pressed"
        if (down && !player._pressed[mapped]) {
          player._pressed[mapped] = true;
          player._justPressed.push(mapped);
        }
        if (!down) player._pressed[mapped] = false;
      }
      if (down && k === 'escape') player._justPressed.push('escape');
    }
    window.addEventListener('keydown', e => onKey(e, true));
    window.addEventListener('keyup', e => onKey(e, false));

    const player = {
      root: char.root, parts: char.parts, camera: cam, keys, held,
      _pressed: {}, _justPressed: [],
      vy: 0, onGround: true,
      inVehicle: null, // ref to vehicle if inside
      isSprinting: false, walkPhase: 0,
      punching: 0, // Timer für Faust-Animation
      lastPunchTime: 0,
      visible: true,

      setVisible(v) {
        this.visible = v;
        Object.values(char.parts).forEach(p => p.setEnabled(v));
      },
      teleport(pos) { this.root.position.copyFrom(pos); this.vy = 0; },
      forwardDir() {
        // Vom Kamera-Alpha die horizontale "weg von der Kamera"-Richtung
        const c = cam;
        return new B.Vector3(-Math.cos(c.alpha), 0, -Math.sin(c.alpha)).normalize();
      },
      rightDir() {
        const fwd = this.forwardDir();
        // 90° im Uhrzeigersinn (aus Vogelperspektive)
        return new B.Vector3(-fwd.z, 0, fwd.x).normalize();
      },
      consumeJustPressed(key) {
        const idx = this._justPressed.indexOf(key);
        if (idx >= 0) { this._justPressed.splice(idx, 1); return true; }
        return false;
      },
      clearJustPressed() { this._justPressed.length = 0; },
      update(dt, world) {
        if (this.inVehicle) return; // Fahrzeug hat Steuerung
        const speed = keys.shift ? CFG.player.sprintSpeed : CFG.player.walkSpeed;
        this.isSprinting = !!keys.shift;
        const fwd = this.forwardDir();
        const right = this.rightDir();
        const move = new B.Vector3(0, 0, 0);
        if (keys.w) move.addInPlace(fwd);
        if (keys.s) move.subtractInPlace(fwd);
        if (keys.d) move.addInPlace(right);
        if (keys.a) move.subtractInPlace(right);
        if (move.lengthSquared() > 0) {
          move.normalize().scaleInPlace(speed * dt);
          this.root.position.addInPlace(move);
          // Drehung zum Bewegungsvektor
          const targetY = Math.atan2(move.x, move.z);
          this.root.rotation.y = targetY;
          this.walkPhase += dt * (this.isSprinting ? 14 : 8);
          // Bein-/Arm-Wackelanimation
          const sw = Math.sin(this.walkPhase) * 0.5;
          char.parts.legL.rotation.x = sw;
          char.parts.legR.rotation.x = -sw;
          char.parts.armL.rotation.x = -sw * 0.6;
          char.parts.armR.rotation.x = sw * 0.6;
        } else {
          char.parts.legL.rotation.x *= 0.8;
          char.parts.legR.rotation.x *= 0.8;
          char.parts.armL.rotation.x *= 0.8;
          char.parts.armR.rotation.x *= 0.8;
        }
        // Springen
        if (keys.space && this.onGround) {
          this.vy = CFG.player.jumpVelocity;
          this.onGround = false;
        }
        this.vy += CFG.player.gravity * dt;
        this.root.position.y += this.vy * dt;
        if (this.root.position.y <= 0) {
          this.root.position.y = 0; this.vy = 0; this.onGround = true;
        }
        // Kamera folgt
        cam.target = new B.Vector3(this.root.position.x, this.root.position.y + 1.2, this.root.position.z);

        // Kollisionen ganz simpel: nicht in Gebäude laufen
        if (world && world.buildings) {
          const pp = this.root.position;
          for (const b of world.buildings) {
            const bb = b.getBoundingInfo().boundingBox;
            const min = bb.minimumWorld, max = bb.maximumWorld;
            // 2D-check mit kleinem Padding
            const pad = 0.5;
            if (pp.x > min.x - pad && pp.x < max.x + pad && pp.z > min.z - pad && pp.z < max.z + pad && pp.y < max.y) {
              // schiebe weg zur nächsten Kante
              const dxMin = pp.x - (min.x - pad);
              const dxMax = (max.x + pad) - pp.x;
              const dzMin = pp.z - (min.z - pad);
              const dzMax = (max.z + pad) - pp.z;
              const m = Math.min(dxMin, dxMax, dzMin, dzMax);
              if (m === dxMin) pp.x = min.x - pad;
              else if (m === dxMax) pp.x = max.x + pad;
              else if (m === dzMin) pp.z = min.z - pad;
              else pp.z = max.z + pad;
            }
          }
        }
        // Faust-Animation abklingen
        if (this.punching > 0) {
          this.punching -= dt;
          char.parts.armR.rotation.x = -1.2 * Math.max(0, this.punching / 0.25);
        }
      },
      punch() {
        if (Date.now() - this.lastPunchTime < 400) return;
        this.lastPunchTime = Date.now();
        this.punching = 0.25;
        BUG.SFX.hit();
      },
    };
    return player;
  }

  return { create };
})();

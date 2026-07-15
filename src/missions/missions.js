// Missionen: Pfand sammeln, Tourist zum Fernsehturm, Döner klauen,
// Schwarzfahren, Späti-Lieferung, E-Roller zerstören
window.BUG = window.BUG || {};
BUG.Missions = (function () {
  const B_ = () => window.BABYLON;

  // Sammelobjekt: Pfandflasche
  function makeBottle(scene, x, z) {
    const B = B_();
    const bottle = B.MeshBuilder.CreateCylinder('bottle', { diameter: 0.15, height: 0.32 }, scene);
    bottle.position.set(x, 0.16, z);
    const mat = BUG.City.mat(scene, '#4a7040');
    mat.alpha = 0.75;
    mat.specularColor = new B.Color3(0.4, 0.6, 0.4);
    bottle.material = mat;
    // Label
    const label = B.MeshBuilder.CreateBox('bl', { width: 0.16, depth: 0.03, height: 0.08 }, scene);
    label.position.set(x, 0.18, z);
    label.material = BUG.City.mat(scene, '#c0c0a0');
    return { mesh: bottle, label, pos: bottle.position, collected: false };
  }

  // Marker (leuchtende Säule) für Missionsziele
  function makeMarker(scene, x, z, color) {
    const B = B_();
    const cyl = B.MeshBuilder.CreateCylinder('mkr', { diameter: 1.5, height: 12 }, scene);
    cyl.position.set(x, 6, z);
    const m = BUG.City.mat(scene, color || '#ffb03a');
    m.alpha = 0.35;
    m.emissiveColor = BUG.City.hexToColor3(color || '#ffb03a');
    cyl.material = m;
    return cyl;
  }

  // Missionsdefinitionen
  const list = [
    {
      id: 'pfand',
      title: '♻️ Pfand-Marathon',
      desc: 'Sammle 5 Pfandflaschen in der Stadt.',
      reward: 15,
      state: null,
      start(scene, world, player) {
        const bottles = [];
        for (let i = 0; i < 5; i++) {
          const x = (Math.random() - 0.5) * (BUG.CONFIG.world.size - 40);
          const z = (Math.random() - 0.5) * (BUG.CONFIG.world.size - 40);
          bottles.push(makeBottle(scene, x, z));
        }
        this.state = { bottles, collected: 0 };
        BUG.HUD.setMission(this.title, `Flaschen: 0 / 5 · Belohnung: ${this.reward}€`);
      },
      update(dt, world, player) {
        if (!this.state) return;
        for (const b of this.state.bottles) {
          if (b.collected) continue;
          const d = Math.hypot(b.pos.x - player.root.position.x, b.pos.z - player.root.position.z);
          if (d < 1.5) {
            b.collected = true;
            b.mesh.dispose(); b.label.dispose();
            this.state.collected++;
            BUG.Inventory.addPfand(1);
            BUG.SFX.coin();
            BUG.HUD.setMission(this.title, `Flaschen: ${this.state.collected} / 5 · Belohnung: ${this.reward}€`);
            if (this.state.collected >= 5) {
              BUG.Inventory.addMoney(this.reward);
              BUG.HUD.toast(`♻️ Mission fertig! +${this.reward}€`);
              BUG.SFX.win();
              BUG.Inventory.completeMission(this.id);
              this.state = null;
              BUG.Missions.currentId = null;
              BUG.HUD.setMission('Freies Spiel', 'Drücke <span class="key">M</span> für neue Missionen.');
              return true;
            }
          }
        }
        // Minimap target: nächste unaufgesammelte Flasche
        const uncoll = this.state.bottles.filter(b => !b.collected);
        if (uncoll.length) {
          let best = uncoll[0], bd = Infinity;
          for (const b of uncoll) {
            const d = Math.hypot(b.pos.x - player.root.position.x, b.pos.z - player.root.position.z);
            if (d < bd) { bd = d; best = b; }
          }
          world.missionTarget = best.pos;
        }
      },
    },

    {
      id: 'tourist',
      title: '🗼 Bring den Touristen',
      desc: 'Ein verlorener Tourist am Alex will zum Fernsehturm. Führe ihn hin.',
      reward: 25,
      state: null,
      start(scene, world, player) {
        const B = B_();
        const t = BUG.Pedestrian.makePedestrian(scene, 4, 4, 'normal');
        t.speed = 3.0; t.quipCooldown = 999;
        t._follow = true;
        const goal = { x: 120, z: 80 }; // Fernsehturm
        const marker = makeMarker(scene, goal.x, goal.z, '#ffb03a');
        this.state = { tourist: t, goal, marker };
        BUG.Missions.tourists = BUG.Missions.tourists || [];
        BUG.Missions.tourists.push(t);
        BUG.HUD.setMission(this.title, 'Der Tourist folgt dir. Führe ihn zum Fernsehturm.');
      },
      update(dt, world, player) {
        if (!this.state) return;
        const t = this.state.tourist;
        world.missionTarget = { x: this.state.goal.x, z: this.state.goal.z };
        // Tourist folgt Spieler (2m Abstand)
        const dx = player.root.position.x - t.root.position.x;
        const dz = player.root.position.z - t.root.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 2) {
          t.root.position.x += (dx / d) * t.speed * dt;
          t.root.position.z += (dz / d) * t.speed * dt;
          t.root.rotation.y = Math.atan2(dx, dz);
          t.walkPhase += dt * 8;
          const sw = Math.sin(t.walkPhase) * 0.5;
          t.parts.legL.rotation.x = sw; t.parts.legR.rotation.x = -sw;
        }
        // Ziel erreicht?
        const gd = Math.hypot(t.root.position.x - this.state.goal.x, t.root.position.z - this.state.goal.z);
        if (gd < 8) {
          BUG.Dialog.show('🗼 „Boah ist der hoch! Danke Alter!"', 3000);
          BUG.Inventory.addMoney(this.reward);
          BUG.HUD.toast(`🗼 +${this.reward}€ Trinkgeld!`);
          BUG.SFX.win();
          BUG.Inventory.completeMission(this.id);
          this.state.marker.dispose();
          t.dispose();
          this.state = null;
          BUG.Missions.currentId = null;
          BUG.HUD.setMission('Freies Spiel', 'Drücke <span class="key">M</span> für neue Missionen.');
        }
      },
    },

    {
      id: 'doener',
      title: '🌯 Klau den Döner!',
      desc: 'Renne zum Döner am Kotti, greif ihn und flieh 60 Sekunden.',
      reward: 20,
      state: null,
      start(scene, world, player) {
        const goal = { x: 50, z: -30 }; // Kotti (B1)
        const marker = makeMarker(scene, goal.x, goal.z, '#ff3a3a');
        this.state = { goal, marker, phase: 'grab', timer: 60 };
        BUG.HUD.setMission(this.title, 'Renne zum Marker am Kottbusser Tor. Sprint mit Shift.');
      },
      update(dt, world, player) {
        if (!this.state) return;
        world.missionTarget = this.state.goal;
        const d = Math.hypot(player.root.position.x - this.state.goal.x, player.root.position.z - this.state.goal.z);
        if (this.state.phase === 'grab' && d < 3) {
          this.state.phase = 'flee';
          BUG.Dialog.show('🌯 GESCHNAPPT! Renn los!', 2500);
          BUG.SFX.coin();
          BUG.Wanted.setStars(Math.max(1, BUG.Wanted.stars));
          this.state.marker.dispose();
          BUG.HUD.setMission(this.title, `Flieh! Zeit: ${Math.ceil(this.state.timer)}s`);
        } else if (this.state.phase === 'flee') {
          this.state.timer -= dt;
          BUG.HUD.setMission(this.title, `Flieh! Zeit: ${Math.ceil(this.state.timer)}s · Sterne aushalten!`);
          if (this.state.timer <= 0) {
            BUG.Inventory.addMoney(this.reward);
            BUG.HUD.toast(`🌯 Döner ist deiner! +${this.reward}€`);
            BUG.SFX.win();
            BUG.Inventory.completeMission(this.id);
            this.state = null;
            BUG.Missions.currentId = null;
            BUG.HUD.setMission('Freies Spiel', 'Drücke <span class="key">M</span> für neue Missionen.');
          }
        }
      },
    },

    {
      id: 'schwarz',
      title: '🚇 Schwarzfahren-Challenge',
      desc: 'Fahre Linie B1 von Warschauer Str. bis Uhlandstr. — ohne Ticket.',
      reward: 30,
      state: null,
      start(scene, world, player) {
        const from = { x: 170, z: -30 };
        const to   = { x: -150, z: -30 };
        const marker = makeMarker(scene, from.x, from.z, '#ffb03a');
        this.state = { from, to, marker, phase: 'goto', wentIn: false };
        BUG.HUD.setMission(this.title, 'Zur Station Warschauer Str. Kein Ticket lösen!');
      },
      update(dt, world, player) {
        if (!this.state) return;
        if (this.state.phase === 'goto') {
          world.missionTarget = this.state.from;
          const d = Math.hypot(player.root.position.x - this.state.from.x, player.root.position.z - this.state.from.z);
          if (d < 6) {
            this.state.phase = 'ride';
            this.state.marker.dispose();
            BUG.HUD.setMission(this.title, 'Jetzt in Linie B1 einsteigen (F am Zug).');
          }
        } else if (this.state.phase === 'ride') {
          world.missionTarget = this.state.to;
          const pos = player.inVehicle && player.inVehicle.type === 'train' ? player.inVehicle.root.position : player.root.position;
          const d = Math.hypot(pos.x - this.state.to.x, pos.z - this.state.to.z);
          if (player.inVehicle && player.inVehicle.type === 'train') this.state.wentIn = true;
          if (this.state.wentIn && d < 10 && !BUG.Inventory.hasValidTicket()) {
            BUG.Inventory.addMoney(this.reward);
            BUG.HUD.toast(`🚇 Ohne Ticket überlebt! +${this.reward}€`);
            BUG.SFX.win();
            BUG.Inventory.completeMission(this.id);
            this.state = null;
            BUG.Missions.currentId = null;
            BUG.HUD.setMission('Freies Spiel', 'Drücke <span class="key">M</span> für neue Missionen.');
          }
        }
      },
    },

    {
      id: 'spaeti',
      title: '🍺 Späti-Lieferung',
      desc: 'Hol Getränke am Späti (Dom) und bring sie zur Party (Reichstag).',
      reward: 18,
      state: null,
      start(scene, world, player) {
        const pickup = { x: 50, z: 50 };
        const dropoff = { x: -100, z: -60 };
        const marker = makeMarker(scene, pickup.x, pickup.z, '#00d4b8');
        this.state = { pickup, dropoff, marker, phase: 'pick' };
        BUG.HUD.setMission(this.title, 'Zur Späti-Markierung am Dom.');
      },
      update(dt, world, player) {
        if (!this.state) return;
        if (this.state.phase === 'pick') {
          world.missionTarget = this.state.pickup;
          const d = Math.hypot(player.root.position.x - this.state.pickup.x, player.root.position.z - this.state.pickup.z);
          if (d < 3) {
            this.state.phase = 'deliver';
            this.state.marker.dispose();
            this.state.marker = makeMarker(window._bugScene, this.state.dropoff.x, this.state.dropoff.z, '#ffb03a');
            BUG.Dialog.show('🍺 Sträußchen eingepackt!', 2000);
            BUG.HUD.setMission(this.title, 'Bring die Getränke zum Reichstag-Marker.');
          }
        } else {
          world.missionTarget = this.state.dropoff;
          const d = Math.hypot(player.root.position.x - this.state.dropoff.x, player.root.position.z - this.state.dropoff.z);
          if (d < 4) {
            BUG.Inventory.addMoney(this.reward);
            BUG.HUD.toast(`🍺 Geliefert! +${this.reward}€`);
            BUG.SFX.win();
            BUG.Inventory.completeMission(this.id);
            this.state.marker.dispose();
            this.state = null;
            BUG.Missions.currentId = null;
            BUG.HUD.setMission('Freies Spiel', 'Drücke <span class="key">M</span> für neue Missionen.');
          }
        }
      },
    },

    {
      id: 'roller',
      title: '🛴 Roller-Rebellion',
      desc: 'Zerstöre 3 E-Roller (F draufsteigen + Vollgas + scharfe Kurve).',
      reward: 22,
      state: null,
      start(scene, world, player) {
        this.state = { destroyed: 0 };
        BUG.HUD.setMission(this.title, `Zerstört: 0 / 3 · Wanted-Level steigt!`);
      },
      update(dt, world, player) {
        if (!this.state) return;
        // Wir verlassen uns auf externen Hook: main.js meldet Roller-Zerstörung
        BUG.HUD.setMission(this.title, `Zerstört: ${this.state.destroyed} / 3`);
        if (this.state.destroyed >= 3) {
          BUG.Inventory.addMoney(this.reward);
          BUG.HUD.toast(`🛴 Roller vernichtet! +${this.reward}€`);
          BUG.SFX.win();
          BUG.Inventory.completeMission(this.id);
          this.state = null;
          BUG.Missions.currentId = null;
          BUG.HUD.setMission('Freies Spiel', 'Drücke <span class="key">M</span> für neue Missionen.');
        }
      },
      notifyRollerDestroyed() {
        if (this.state) {
          this.state.destroyed++;
          BUG.Wanted.setStars(Math.min(2, BUG.Wanted.stars + 1));
        }
      },
    },
  ];

  const api = {
    list,
    currentId: null,
    tourists: [],
    start(id, scene, world, player) {
      const m = list.find(x => x.id === id);
      if (!m) return;
      this.currentId = id;
      m.start(scene, world, player);
      BUG.HUD.toast('📋 Mission gestartet: ' + m.title);
    },
    update(dt, world, player) {
      if (!this.currentId) { world.missionTarget = null; return; }
      const m = list.find(x => x.id === this.currentId);
      if (m && m.update) m.update(dt, world, player);
    },
    openMenu() {
      // Simple prompt-basiertes Menü (kein Rendering-Overhead)
      const items = list.map((m, i) => {
        const done = BUG.Inventory.isCompleted(m.id) ? ' ✓' : '';
        const active = this.currentId === m.id ? ' (aktiv)' : '';
        return `${i + 1}. ${m.title}${done}${active}\n   ${m.desc} · +${m.reward}€`;
      }).join('\n\n');
      const answer = prompt(
        '=== MISSIONSLISTE ===\n\n' + items +
        '\n\nNummer eingeben zum Starten (0 = abbrechen aktive Mission, leer = zurück):',
        ''
      );
      if (answer === '0') {
        this.currentId = null;
        BUG.HUD.setMission('Freies Spiel', 'Missionen mit <span class="key">M</span>.');
        return;
      }
      const n = parseInt(answer, 10);
      if (n >= 1 && n <= list.length) {
        this.start(list[n - 1].id, window._bugScene, window._bugWorld, window._bugPlayer);
      }
    },
    notifyRollerDestroyed() {
      const m = list.find(x => x.id === 'roller');
      if (m && m.notifyRollerDestroyed) m.notifyRollerDestroyed();
    },
  };
  return api;
})();

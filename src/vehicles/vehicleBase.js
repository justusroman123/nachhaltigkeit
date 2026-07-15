// Gemeinsame Basis für Auto/E-Scooter/Zug: Enter/Exit + Registry
window.BUG = window.BUG || {};
BUG.Vehicles = (function () {
  const list = [];

  return {
    add(v) { list.push(v); return v; },
    all() { return list; },
    // Findet nächstes Fahrzeug in Interaktionsradius um pos
    findNearby(pos, maxDist) {
      let best = null, bestD = maxDist * maxDist;
      for (const v of list) {
        const dx = v.root.position.x - pos.x;
        const dz = v.root.position.z - pos.z;
        const d = dx*dx + dz*dz;
        if (d < bestD) { bestD = d; best = v; }
      }
      return best;
    },
    ejectPlayer(player) {
      if (!player.inVehicle) return;
      const v = player.inVehicle;
      // Ausstiegsposition seitlich vom Fahrzeug
      const B = window.BABYLON;
      const side = new B.Vector3(Math.cos(v.root.rotation.y), 0, -Math.sin(v.root.rotation.y)).scale(v.exitOffset || 2.5);
      player.root.position.set(v.root.position.x + side.x, 0, v.root.position.z + side.z);
      player.setVisible(true);
      v.driver = null;
      player.inVehicle = null;
      BUG.SFX.doorBeep();
      if (v.onExit) v.onExit(player);
    },
    enterPlayer(player, v) {
      player.inVehicle = v;
      v.driver = player;
      player.setVisible(false);
      BUG.SFX.doorBeep();
      if (v.onEnter) v.onEnter(player);
    },
  };
})();

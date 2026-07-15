// Stilisierte Low-Poly-Landmarks: Fernsehturm, Brandenburger Tor, Reichstag, Berliner Dom
window.BUG = window.BUG || {};
BUG.Landmarks = (function () {
  const B_ = () => window.BABYLON;
  const M = () => BUG.City;

  function fernsehturm(scene) {
    const B = B_(), CityMod = M();
    const g = new B.TransformNode('fernsehturm', scene);
    // Sockel
    const base = B.MeshBuilder.CreateCylinder('fs_base', { diameter: 6, height: 4 }, scene);
    base.position.y = 2; base.parent = g;
    base.material = CityMod.mat(scene, '#c8c8c8');
    // Schaft
    const shaft = B.MeshBuilder.CreateCylinder('fs_shaft', { diameterTop: 2.4, diameterBottom: 3.6, height: 55 }, scene);
    shaft.position.y = 4 + 55 / 2; shaft.parent = g;
    shaft.material = CityMod.mat(scene, '#d0d0d0');
    // Kugel
    const ball = B.MeshBuilder.CreateSphere('fs_ball', { diameter: 12 }, scene);
    ball.position.y = 4 + 55 + 4; ball.parent = g;
    const bm = CityMod.mat(scene, '#8b8b8b');
    bm.specularColor = new B.Color3(0.5, 0.5, 0.6); bm.specularPower = 64;
    ball.material = bm;
    // Kugel-Streifen
    const stripe = B.MeshBuilder.CreateTorus('fs_stripe', { diameter: 12, thickness: 1.2, tessellation: 24 }, scene);
    stripe.position.y = 4 + 55 + 4; stripe.parent = g;
    stripe.material = CityMod.mat(scene, '#00d4b8');
    // Antenne
    const ant = B.MeshBuilder.CreateCylinder('fs_ant', { diameter: 0.5, height: 40 }, scene);
    ant.position.y = 4 + 55 + 4 + 6 + 20; ant.parent = g;
    ant.material = CityMod.mat(scene, '#ff3a3a');
    // Antennen-Spitze
    const tip = B.MeshBuilder.CreateSphere('fs_tip', { diameter: 0.8 }, scene);
    tip.position.y = 4 + 55 + 4 + 6 + 40; tip.parent = g;
    const tipMat = CityMod.mat(scene, '#ff3a3a');
    tipMat.emissiveColor = new B.Color3(1, 0.2, 0.2);
    tip.material = tipMat;

    g.position.set(120, 0, 80);
    return { mesh: g, pos: g.position, name: 'Fernsehturm', icon: 'T' };
  }

  function brandenburgerTor(scene) {
    const B = B_(), CityMod = M();
    const g = new B.TransformNode('brandenburger', scene);
    const stone = CityMod.mat(scene, '#d4c9a8');
    // 6 Säulen
    for (let i = -2; i <= 2; i++) {
      const col = B.MeshBuilder.CreateCylinder('bt_col', { diameter: 1.6, height: 12 }, scene);
      col.position.set(i * 3.5, 6, 0); col.parent = g; col.material = stone;
    }
    // Gebälk
    const beam = B.MeshBuilder.CreateBox('bt_beam', { width: 22, depth: 3, height: 2.6 }, scene);
    beam.position.set(0, 13.3, 0); beam.parent = g; beam.material = stone;
    // Attika
    const attic = B.MeshBuilder.CreateBox('bt_attic', { width: 20, depth: 2.8, height: 3 }, scene);
    attic.position.set(0, 16.1, 0); attic.parent = g; attic.material = stone;
    // Quadriga stilisiert
    for (let i = -1; i <= 2; i++) {
      const horse = B.MeshBuilder.CreateBox('horse', { width: 1.5, depth: 2.4, height: 1.6 }, scene);
      horse.position.set(-3 + i * 1.6, 18.8, 0); horse.parent = g;
      horse.material = CityMod.mat(scene, '#3a3630');
      const leg1 = B.MeshBuilder.CreateBox('leg', { width: 0.3, depth: 0.3, height: 1.2 }, scene);
      leg1.position.set(-3 + i * 1.6 - 0.5, 17.9, 0.8); leg1.parent = g;
      leg1.material = CityMod.mat(scene, '#3a3630');
    }
    const chariot = B.MeshBuilder.CreateBox('chariot', { width: 3, depth: 2, height: 1.4 }, scene);
    chariot.position.set(2.8, 18.6, 0); chariot.parent = g;
    chariot.material = CityMod.mat(scene, '#3a3630');

    g.position.set(-130, 0, 20);
    return { mesh: g, pos: g.position, name: 'Brandenburger Tor', icon: '||' };
  }

  function reichstag(scene) {
    const B = B_(), CityMod = M();
    const g = new B.TransformNode('reichstag', scene);
    const stone = CityMod.mat(scene, '#c8b898');
    // Hauptbau
    const main = B.MeshBuilder.CreateBox('rt_main', { width: 30, depth: 22, height: 14 }, scene);
    main.position.set(0, 7, 0); main.parent = g; main.material = stone;
    // Türme an Ecken
    for (const [dx, dz] of [[-14, -10], [14, -10], [-14, 10], [14, 10]]) {
      const t = B.MeshBuilder.CreateBox('rt_t', { width: 5, depth: 5, height: 18 }, scene);
      t.position.set(dx, 9, dz); t.parent = g; t.material = stone;
      const cap = B.MeshBuilder.CreateBox('rt_cap', { width: 6, depth: 6, height: 1.5 }, scene);
      cap.position.set(dx, 18.75, dz); cap.parent = g;
      cap.material = CityMod.mat(scene, '#4d4238');
    }
    // Kuppel
    const cupola = B.MeshBuilder.CreateSphere('rt_cup', { diameter: 12, segments: 16, slice: 0.55 }, scene);
    cupola.position.set(0, 14, 0); cupola.parent = g;
    const glassMat = CityMod.mat(scene, '#a8ccdd');
    glassMat.alpha = 0.55; glassMat.specularColor = new B.Color3(0.9, 0.9, 1);
    cupola.material = glassMat;
    // Portikus
    for (let i = -2; i <= 2; i++) {
      const col = B.MeshBuilder.CreateCylinder('rt_col', { diameter: 1.2, height: 12 }, scene);
      col.position.set(i * 2.8, 6, -12); col.parent = g; col.material = stone;
    }

    g.position.set(-100, 0, -60);
    return { mesh: g, pos: g.position, name: 'Reichstag', icon: 'R' };
  }

  function dom(scene) {
    const B = B_(), CityMod = M();
    const g = new B.TransformNode('dom', scene);
    const stone = CityMod.mat(scene, '#a89078');
    const copper = CityMod.mat(scene, '#4a8a6d');
    // Hauptbau
    const body = B.MeshBuilder.CreateBox('d_body', { width: 20, depth: 20, height: 12 }, scene);
    body.position.set(0, 6, 0); body.parent = g; body.material = stone;
    // Zentrale Kuppel
    const cupBase = B.MeshBuilder.CreateCylinder('d_cb', { diameter: 10, height: 3 }, scene);
    cupBase.position.set(0, 13.5, 0); cupBase.parent = g; cupBase.material = stone;
    const cupola = B.MeshBuilder.CreateSphere('d_cup', { diameter: 12, slice: 0.5 }, scene);
    cupola.position.set(0, 15, 0); cupola.parent = g; cupola.material = copper;
    // Laterne oben
    const lantern = B.MeshBuilder.CreateCylinder('d_lan', { diameter: 3, height: 3 }, scene);
    lantern.position.set(0, 21, 0); lantern.parent = g; lantern.material = stone;
    const spire = B.MeshBuilder.CreateCylinder('d_sp', { diameter: 0.4, height: 4 }, scene);
    spire.position.set(0, 24.5, 0); spire.parent = g; spire.material = copper;
    // 4 Ecktürme
    for (const [dx, dz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
      const t = B.MeshBuilder.CreateCylinder('d_t', { diameter: 3, height: 8 }, scene);
      t.position.set(dx, 8, dz); t.parent = g; t.material = stone;
      const c = B.MeshBuilder.CreateSphere('d_tc', { diameter: 3.5, slice: 0.5 }, scene);
      c.position.set(dx, 12, dz); c.parent = g; c.material = copper;
    }

    g.position.set(50, 0, 50);
    return { mesh: g, pos: g.position, name: 'Bärliner Dom', icon: '+' };
  }

  function siegessaeule(scene) {
    // Bonus: Siegessäule als vertikaler Marker
    const B = B_(), CityMod = M();
    const g = new B.TransformNode('siegessaeule', scene);
    const stone = CityMod.mat(scene, '#b8a878');
    const base = B.MeshBuilder.CreateBox('ss_base', { width: 6, depth: 6, height: 3 }, scene);
    base.position.y = 1.5; base.parent = g; base.material = stone;
    const col = B.MeshBuilder.CreateCylinder('ss_col', { diameter: 2.8, height: 30 }, scene);
    col.position.y = 18; col.parent = g; col.material = stone;
    const top = B.MeshBuilder.CreateSphere('ss_top', { diameter: 3 }, scene);
    top.position.y = 34.5; top.parent = g;
    const gold = CityMod.mat(scene, '#e8c94a');
    gold.emissiveColor = new B.Color3(0.4, 0.35, 0.05);
    top.material = gold;

    g.position.set(-30, 0, 130);
    return { mesh: g, pos: g.position, name: 'Siegessäule', icon: 'V' };
  }

  function build(scene) {
    return [
      fernsehturm(scene),
      brandenburgerTor(scene),
      reichstag(scene),
      dom(scene),
      siegessaeule(scene),
    ];
  }

  return { build };
})();

// U-Bahn: 3 Linien mit Streckensplines, Stationen, Bahnsteige
window.BUG = window.BUG || {};
BUG.UBahn = (function () {
  const B_ = () => window.BABYLON;
  const M = () => BUG.City;

  const LINES = [
    {
      code: 'B1', color: '#ffb03a', color3: null,
      stations: [
        { name: 'Warschauer Str.', pos: [170, 0, -30] },
        { name: 'Schlesisches Tor', pos: [110, 0, -30] },
        { name: 'Kottbusser Tor',  pos: [50,  0, -30] },
        { name: 'Bärlinerplatz',   pos: [-10, 0, -30] },
        { name: 'Nollendorfplatz', pos: [-80, 0, -30] },
        { name: 'Uhlandstr.',      pos: [-150,0, -30] },
      ],
    },
    {
      code: 'B2', color: '#ff3a3a', color3: null,
      stations: [
        { name: 'Pankow',          pos: [-140, 0, 150] },
        { name: 'Vinetastr.',      pos: [-80,  0, 100] },
        { name: 'Alexanderplatz',  pos: [0,    0, 0]   },
        { name: 'Bärliner Dom',    pos: [50,   0, 50]  },
        { name: 'Potsdamer Platz', pos: [-40,  0, -80] },
        { name: 'Ruhleben',        pos: [-150, 0, -140] },
      ],
    },
    {
      code: 'B5', color: '#00d4b8', color3: null,
      stations: [
        { name: 'Hauptbahnhof',    pos: [-80,  0, -120] },
        { name: 'Reichstag',       pos: [-100, 0, -60]  },
        { name: 'Bundestag',       pos: [-60,  0, -30]  },
        { name: 'Alexanderplatz',  pos: [0,    0, 0]    },
        { name: 'Fernsehturm',     pos: [120,  0, 80]   },
        { name: 'Friedrichsfelde', pos: [180,  0, 150]  },
      ],
    },
  ];

  function makeSpline(points) {
    const B = B_();
    const vec = points.map(p => new B.Vector3(p[0], 0.3, p[2] !== undefined ? p[2] : p[1]));
    // For 2D-list format from stations.pos
    return B.Curve3.CreateCatmullRomSpline(vec, 20, false).getPoints();
  }

  function drawTracks(scene, points, colorHex) {
    const B = B_(), CityMod = M();
    const tie = CityMod.mat(scene, '#3a2a1a');
    const rail = CityMod.mat(scene, '#8a8a8a');
    // Merge into one strip mesh
    const ribbon = B.MeshBuilder.CreateRibbon('track', {
      pathArray: [
        points.map(p => p.add(new B.Vector3(0, 0.05, 0))),
        points.map(p => p.add(new B.Vector3(0, 0.05, 0))),
      ],
      updatable: false, sideOrientation: B.Mesh.DOUBLESIDE,
    }, scene);
    // Instead of ribbon: simple thin box path
    ribbon.dispose();

    // 2 parallel rail lines using boxes at intervals
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const mid = a.add(b).scale(0.5);
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      // Schwelle
      const sleeper = B.MeshBuilder.CreateBox('sl', { width: 3.2, depth: 0.4, height: 0.15 }, scene);
      sleeper.position.set(mid.x, 0.08, mid.z);
      sleeper.rotation.y = ang;
      sleeper.material = tie;
      // 2 Schienen als schmale Balken
      for (const off of [-1.2, 1.2]) {
        const nx = Math.cos(ang) * off;
        const nz = -Math.sin(ang) * off;
        const r = B.MeshBuilder.CreateBox('r', { width: 0.12, depth: len, height: 0.14 }, scene);
        r.position.set(mid.x + nx, 0.16, mid.z + nz);
        r.rotation.y = ang;
        r.material = rail;
      }
    }
  }

  function buildStation(scene, name, pos, lineColor) {
    const B = B_(), CityMod = M();
    const CFG = BUG.CONFIG;
    const g = new B.TransformNode('station_' + name, scene);
    // Bahnsteig
    const platform = B.MeshBuilder.CreateBox('platform', { width: 12, depth: 24, height: 0.6 }, scene);
    platform.position.set(pos[0], 0.3, pos[2]); platform.parent = g;
    platform.material = CityMod.mat(scene, '#5a5a60');
    // 4 Säulen mit Dach
    for (const [dx, dz] of [[-4, -10], [4, -10], [-4, 10], [4, 10]]) {
      const c = B.MeshBuilder.CreateCylinder('sc', { diameter: 0.4, height: 4 }, scene);
      c.position.set(pos[0] + dx, 2.6, pos[2] + dz); c.parent = g;
      c.material = CityMod.mat(scene, '#2a2a30');
    }
    const roof = B.MeshBuilder.CreateBox('sroof', { width: 12, depth: 24, height: 0.3 }, scene);
    roof.position.set(pos[0], 4.75, pos[2]); roof.parent = g;
    roof.material = CityMod.mat(scene, CFG.colors.stationRoof);

    // Schild mit Stationsname (DynamicTexture, KEIN BVG-Design)
    const sign = B.MeshBuilder.CreatePlane('sign', { width: 8, height: 1.4 }, scene);
    sign.position.set(pos[0], 5.4, pos[2]); sign.parent = g;
    sign.billboardMode = B.Mesh.BILLBOARDMODE_Y;
    const tex = new B.DynamicTexture('sigtex_' + name, { width: 512, height: 128 }, scene);
    const ctx = tex.getContext();
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = lineColor; ctx.fillRect(0, 0, 20, 128);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif';
    ctx.fillText(name, 40, 78);
    tex.update();
    const sigMat = new B.StandardMaterial('sm', scene);
    sigMat.diffuseTexture = tex;
    sigMat.emissiveTexture = tex;
    sigMat.emissiveColor = new B.Color3(0.6, 0.6, 0.6);
    sigMat.disableLighting = false;
    sign.material = sigMat;

    // BBG-Logo (fiktives „B" auf türkisem Quadrat), NICHT das echte BVG-„U"
    const logo = B.MeshBuilder.CreatePlane('logo', { width: 1.4, height: 1.4 }, scene);
    logo.position.set(pos[0] - 5, 5.4, pos[2]); logo.parent = g;
    logo.billboardMode = B.Mesh.BILLBOARDMODE_Y;
    const lt = new B.DynamicTexture('bbg_' + name, { width: 128, height: 128 }, scene);
    const lc = lt.getContext();
    lc.fillStyle = '#00d4b8'; lc.fillRect(0, 0, 128, 128);
    lc.fillStyle = '#0a1418'; lc.font = 'bold 96px sans-serif';
    lc.fillText('B', 30, 100);
    lt.update();
    const lm = new B.StandardMaterial('lm', scene);
    lm.diffuseTexture = lt; lm.emissiveTexture = lt;
    logo.material = lm;

    return {
      name, pos: new B.Vector3(pos[0], 0, pos[2]),
      mesh: g,
      // Wo hält der Zug — 2m neben Bahnsteig
      trainStopPos: new B.Vector3(pos[0], 0.3, pos[2]),
    };
  }

  function build(scene) {
    const B = B_();
    const stations = []; // { name, pos, mesh, ... }
    const stationsByName = {};
    const linePaths = [];

    LINES.forEach(line => {
      line.color3 = M().hexToColor3(line.color);
      // Baue Stationen (falls Name schon existiert, wiederverwenden)
      line.stationRefs = [];
      line.stations.forEach(s => {
        let ref = stationsByName[s.name];
        if (!ref) {
          ref = buildStation(scene, s.name, s.pos, line.color);
          ref.lines = [line.code];
          stationsByName[s.name] = ref;
          stations.push(ref);
        } else if (!ref.lines.includes(line.code)) {
          ref.lines.push(line.code);
        }
        line.stationRefs.push(ref);
      });
      // Spline durch Stationen
      const pts = line.stations.map(s => s.pos);
      const spline = makeSpline(pts);
      line.spline = spline;
      drawTracks(scene, spline, line.color);
      linePaths.push({ color: line.color, points: spline.map(p => ({ x: p.x, z: p.z })) });
    });

    return { lines: LINES, stations, linePaths };
  }

  return { build, LINES };
})();

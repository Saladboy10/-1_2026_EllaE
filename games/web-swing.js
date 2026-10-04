// Web Swing: a 3D superhero city. Run, jump off the rooftops, swing on webs from the skyscrapers
// and climb up walls, grabbing as many coins as you can before the timer runs out.
// Loaded by index.html after rail-rush.js: you play as Spider Pig, or switch to your Dodge and Weave
// runner (buildAvatar), and coins go into the same bank.
(() => {
  const root = document.getElementById('webswing');
  const canvas = document.getElementById('swCanvas');
  const $ = id => document.getElementById(id);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const ROUND_TIME = 90;
  const GRAVITY = 30, JUMP = 13, RUN = 13, AIR_PUSH = 12, CLIMB = 9;
  const WEB_RANGE = 48, MIN_WEB = 7, MAX_WEB = 22, REEL = 2.5, PULL = 30, PUMP = 14;
  const BLOCK = 16, STREET = 11, GRID = 12, CELL = BLOCK + STREET, HALF = GRID * CELL / 2;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('webswing.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('webswing.' + k, JSON.stringify(v)); } catch {} },
  };

  let renderer, scene, camera, hero, webLine, reticle;
  let active = false, state = 'menu', last = 0, timeLeft = ROUND_TIME, runCoins = 0, best = store.get('best', 0);
  const buildings = [], coins = [];
  const P = { pos: V(0, 0, 0), vel: V(0, 0, 0), yaw: 0, ground: true, climb: null, web: null, air: 0, prevY: 0 };
  let camYaw = 0, camDrag = 0, holding = false;
  const input = { x: 0, y: 0 };                 // where you want to go: x = right, y = forward (from the joystick or keys)
  const keys = {};

  // ---------- Shared with Dodge and Weave ----------
  let bank_ = null;
  const bankNow = () => { try { return bank; } catch { if (bank_ != null) return bank_; try { return JSON.parse(localStorage.getItem('railrush.bank')) || 0; } catch { return 0; } } };
  function addCoins(n) {
    try { bank += n; } catch { bank_ = (bankNow() || 0) + n; }
    try { localStorage.setItem('railrush.bank', JSON.stringify(bankNow())); } catch {}
  }
  const playerName = () => { try { return runnerName; } catch { try { return JSON.parse(localStorage.getItem('railrush.name')) || ''; } catch { return ''; } } };

  // ---------- City ----------
  // A sunset city on an island: glass towers, brick and stone buildings with setbacks, water towers
  // and air conditioners on the roofs, traffic in the streets and the river all around.
  // Every building is a stack of boxes ("tiers"); each tier is { x0, x1, z0, z1, y0, top } for collisions.
  // All the still scenery is merged into one mesh per material so it draws fast on tablets.
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const SUN_DIR = V(-0.55, 0.42, -0.72).normalize();
  const cars = [];
  let sun, env;

  function canvasTex(w, h, paint) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  // One tile of wall = 4 units wide and 4 units tall: two windows across, two floors up.
  const glassTex = (tint) => canvasTex(128, 128, (g) => {
    g.fillStyle = '#2a3038'; g.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
      const gr = g.createLinearGradient(0, y * 64, 0, y * 64 + 64);
      gr.addColorStop(0, tint[0]); gr.addColorStop(1, tint[1]);
      g.fillStyle = gr; g.fillRect(x * 64 + 3, y * 64 + 4, 58, 56);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x * 64 + 3, y * 64 + 4, 58, 10);
    }
  });
  const masonryTex = (wall, line, frame) => canvasTex(128, 128, (g) => {
    g.fillStyle = wall; g.fillRect(0, 0, 128, 128);
    g.fillStyle = line; for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 128, 1);
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
      const wx = x * 64 + 18, wy = y * 64 + 14;
      g.fillStyle = frame; g.fillRect(wx - 3, wy - 3, 34, 42); g.fillRect(wx - 5, wy + 38, 38, 5);
      g.fillStyle = Math.random() < 0.3 ? '#ffd27a' : '#26303c'; g.fillRect(wx, wy, 28, 36);
      g.fillStyle = frame; g.fillRect(wx + 13, wy, 2, 36); g.fillRect(wx, wy + 17, 28, 2);
    }
  });
  const flatTex = (base, speck) => canvasTex(64, 64, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 300; i++) { g.fillStyle = speck; g.globalAlpha = Math.random() * 0.25; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
  });

  // Merge buckets: material -> plain arrays of positions, normals and uvs.
  const buckets = new Map();
  function bucket(m) { let b = buckets.get(m); if (!b) buckets.set(m, b = { pos: [], nor: [], uv: [] }); return b; }
  // Add a geometry to the merge; `mat` can be a list of materials, one per geometry group (like a box's faces).
  function put(mat, geo) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
    const P_ = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv ? g.attributes.uv.array : null;
    for (const grp of groups) {
      const into = bucket(Array.isArray(mat) ? mat[grp.materialIndex] : mat);
      for (let i = grp.start; i < grp.start + grp.count; i++) {
        into.pos.push(P_[i * 3], P_[i * 3 + 1], P_[i * 3 + 2]); into.nor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
        into.uv.push(U ? U[i * 2] : 0, U ? U[i * 2 + 1] : 0);
      }
    }
  }
  function flush() {
    for (const [mat, b] of buckets) {
      if (!b.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
    }
    buckets.clear();
  }
  // A box whose wall texture repeats once every 4 units, so windows stay the same size.
  function wallBox(w, h, d, x, y, z, wall, roof) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) {
      const face = Math.floor(k / 4), across = face < 2 ? d : w, up = face === 2 || face === 3 ? d : h;
      uv.setXY(k, uv.getX(k) * across / 4, uv.getY(k) * up / 4);
    }
    g.translate(x, y, z);
    put([wall, wall, roof, roof, wall, wall], g);
  }
  const box_ = (w, h, d, x, y, z, m) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); put(m, g); };
  const cyl = (rt, rb, h, x, y, z, m, seg = 12) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z); put(m, g); };

  function skyDome() {
    const top = new THREE.Color('#3f7fd0'), mid = new THREE.Color('#9fc4e8'), low = new THREE.Color('#dfe3ea');
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: top }, mid: { value: mid }, low: { value: low }, sun: { value: SUN_DIR } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top, mid, low, sun; varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(low, mid, smoothstep(-0.05, 0.12, h));
          float s = max(dot(normalize(vDir), sun), 0.0);
          c += vec3(1.0, 0.75, 0.45) * (pow(s, 8.0) * 0.45 + pow(s, 600.0) * 2.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    return new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), m);
  }

  function buildCity() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
    const sky = skyDome(); scene.add(sky);
    // Reflections for the glass and the river come from the sky itself.
    const pm = new THREE.PMREMGenerator(renderer), skyScene = new THREE.Scene(); skyScene.add(skyDome());
    env = pm.fromScene(skyScene).texture; pm.dispose();
    scene.fog = new THREE.Fog('#cfd9e6', 110, 460);

    scene.add(new THREE.HemisphereLight('#bcd4ff', '#6b5646', 1.0));
    sun = new THREE.DirectionalLight('#ffd6a8', 1.5);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 400 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    scene.add(sun); scene.add(sun.target);

    const S = (o) => new THREE.MeshStandardMaterial(o);
    const glass = [['#a9d2f0', '#2e5f8c'], ['#bfe3e0', '#2f6e6a'], ['#d6c7a8', '#5a4a36'], ['#9fb3d9', '#283c66']]
      .map(t => S({ map: glassTex(t), roughness: 0.15, metalness: 0.55, envMap: env, envMapIntensity: 1.7 }));
    const masonry = [['#8b3f2e', '#6e3022', '#d8cbb5'], ['#a8552f', '#86432a', '#efe2c8'], ['#cdbb9a', '#b5a283', '#f4ecdc'], ['#b9b2a6', '#9d968a', '#f1ece4'], ['#7a5a48', '#634838', '#e6d9c4']]
      .map(t => S({ map: masonryTex(...t), roughness: 0.85 }));
    const roof = S({ map: flatTex('#4a4746', '#000000'), roughness: 1 });
    const trim = S({ color: '#e8dfcf', roughness: 0.7 });
    const metal = S({ color: '#9aa1a8', roughness: 0.45, metalness: 0.6, envMap: env });
    const wood = S({ color: '#7b5233', roughness: 0.9 });
    const dark = S({ color: '#2d2f33', roughness: 0.8 });
    const asphalt = S({ map: flatTex('#3a3c40', '#ffffff'), roughness: 0.95 });
    const walk = S({ map: flatTex('#b8b2a7', '#000000'), roughness: 0.9 });
    const paint = S({ color: '#f2efe6', roughness: 0.8 });
    const yellow = S({ color: '#f2c230', roughness: 0.8 });
    const grass = S({ color: '#5f9a45', roughness: 1 });
    const leaves = S({ color: '#3f7f38', roughness: 1 });
    asphalt.map.repeat.set(40, 40); roof.map.repeat.set(1, 1);

    // The river around the island.
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), S({ color: '#1f5577', roughness: 0.08, metalness: 0.6, envMap: env, envMapIntensity: 1.4 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -1.5; water.receiveShadow = true; scene.add(water);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(GRID * CELL + 24, 2, GRID * CELL + 24), asphalt);
    ground.position.y = -1; ground.receiveShadow = true; scene.add(ground);

    // Lane markings down every street.
    for (let i = 0; i <= GRID; i++) {
      const s = -HALF + i * CELL;
      for (let t = -HALF; t < HALF; t += 6) { box_(0.25, 0.02, 3, s, 0.01, t + 1.5, yellow); box_(3, 0.02, 0.25, t + 1.5, 0.01, s, yellow); }
    }

    // A park in the middle of the island (no buildings, lots of trees).
    const park = (i, j) => (i === 7 || i === 8) && (j === 3 || j === 4);
    const landmark = [3, 8];
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const cx = -HALF + i * CELL + CELL / 2, cz = -HALF + j * CELL + CELL / 2;
      box_(BLOCK + 3, 0.3, BLOCK + 3, cx, 0.15, cz, walk);
      if (park(i, j)) {
        box_(BLOCK + 2, 0.34, BLOCK + 2, cx, 0.17, cz, grass);
        for (let k = 0; k < 7; k++) {
          const tx = cx + rand(-6, 6), tz = cz + rand(-6, 6), s = rand(0.8, 1.4);
          cyl(0.25 * s, 0.3 * s, 2.2 * s, tx, 1.1 * s, tz, wood, 6);
          const crown = new THREE.IcosahedronGeometry(1.8 * s, 0); crown.translate(tx, 3.2 * s, tz); put(leaves, crown);
        }
        continue;
      }
      if (i === landmark[0] && j === landmark[1]) { tallTower(cx, cz, glass[3], trim, metal); continue; }
      const centre = Math.hypot(cx, cz) < CELL * 1.5;
      const parts = Math.random() < 0.3 ? [[-BLOCK / 4, BLOCK / 2 - 1], [BLOCK / 4, BLOCK / 2 - 1]] : [[0, BLOCK]];
      for (const [off, w] of parts) {
        const d = parts.length > 1 ? BLOCK : w, isGlass = !centre && Math.random() < 0.45;
        const wall = isGlass ? pick(glass) : pick(masonry);
        let h = centre ? rand(16, 24) : isGlass ? rand(28, 60) : rand(12, 34);
        let x = cx + off, z = cz, tw = w, td = d, y0 = 0;
        const tiers = centre ? 1 : Math.random() < 0.55 ? (Math.random() < 0.35 ? 3 : 2) : 1;
        for (let k = 0; k < tiers; k++) {
          wallBox(tw, h, td, x, y0 + h / 2, z, wall, roof);
          box_(tw + 0.7, 0.6, td + 0.7, x, y0 + h - 0.3, z, isGlass ? metal : trim);   // cornice round the top
          buildings.push({ x0: x - tw / 2, x1: x + tw / 2, z0: z - td / 2, z1: z + td / 2, y0, top: y0 + h });
          y0 += h; tw -= rand(3, 5); td -= rand(3, 5); h = rand(6, 16);
          if (tw < 5 || td < 5) break;
        }
        const top = buildings[buildings.length - 1];
        roofStuff(top, wood, metal, dark);
      }
    }
    flush();
    makeCars();

    const glow = new THREE.MeshStandardMaterial({ color: '#ffcf1a', emissive: '#a06a00', emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.8, envMap: env });
    const coinGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.18, 22); coinGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 40; i++) { const c = new THREE.Mesh(coinGeo, glow); c.castShadow = true; scene.add(c); coins.push(c); placeCoin(c, true); }

    webLine = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    webLine.geometry.translate(0, 0.5, 0); webLine.geometry.rotateX(Math.PI / 2); webLine.visible = false; scene.add(webLine);
    reticle = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.85, fog: false }));
    reticle.renderOrder = 5; reticle.visible = false; scene.add(reticle);
  }
  // The giant landmark tower: stepped glass and stone with a spire, the tallest thing in the city.
  function tallTower(x, z, wall, trim, metal) {
    let y0 = 0, w = BLOCK;
    for (const h of [26, 30, 26, 18]) {
      wallBox(w, h, w, x, y0 + h / 2, z, wall, trim);
      box_(w + 0.8, 0.7, w + 0.8, x, y0 + h - 0.35, z, trim);
      buildings.push({ x0: x - w / 2, x1: x + w / 2, z0: z - w / 2, z1: z + w / 2, y0, top: y0 + h });
      y0 += h; w -= 3.2;
    }
    cyl(0.9, 1.6, 6, x, y0 + 3, z, trim); cyl(0.1, 0.5, 16, x, y0 + 14, z, metal, 8);
  }
  // Water towers, air conditioners, vents and antennas on a roof.
  function roofStuff(b, wood, metal, dark) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, y = b.top;
    if (w > 7 && Math.random() < 0.55) {
      const tx = cx + rand(-w / 4, w / 4), tz = cz + rand(-d / 4, d / 4);
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box_(0.18, 2.4, 0.18, tx + lx * 0.9, y + 1.2, tz + lz * 0.9, dark);
      cyl(1.35, 1.35, 2.6, tx, y + 3.7, tz, wood, 14);
      const cone = new THREE.ConeGeometry(1.5, 1.1, 14); cone.translate(tx, y + 5.55, tz); put(dark, cone);
    }
    for (let k = 0, n = Math.floor(rand(1, 4)); k < n; k++) box_(rand(1.2, 2.2), rand(0.8, 1.3), rand(1.2, 2.2), cx + rand(-w / 3, w / 3), y + 0.5, cz + rand(-d / 3, d / 3), metal);
    if (Math.random() < 0.3) cyl(0.07, 0.1, rand(4, 8), cx + rand(-w / 3, w / 3), y + 3, cz + rand(-d / 3, d / 3), metal, 6);
  }
  // Cars and taxis driving round the streets.
  function makeCars() {
    const colors = ['#f2c230', '#f2c230', '#f2c230', '#c8102e', '#1d3c78', '#e8e8e8', '#222222', '#3a7d44'];
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.75, 4), cabGeo = new THREE.BoxGeometry(1.6, 0.6, 2.1), glassMat = new THREE.MeshStandardMaterial({ color: '#1c2633', roughness: 0.1, metalness: 0.8, envMap: env });
    const lightMat = new THREE.MeshBasicMaterial({ color: '#fff4d0' }), tailMat = new THREE.MeshBasicMaterial({ color: '#ff3030' });
    for (let k = 0; k < 44; k++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: pick(colors), roughness: 0.35, metalness: 0.5, envMap: env }));
      body.position.y = 0.65; body.castShadow = true; g.add(body);
      const cab = new THREE.Mesh(cabGeo, glassMat); cab.position.set(0, 1.3, 0.2); g.add(cab);
      for (const s of [-1, 1]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.05), lightMat); hl.position.set(s * 0.6, 0.7, -2.02); g.add(hl);
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.05), tailMat); tl.position.set(s * 0.6, 0.7, 2.02); g.add(tl);
      }
      const alongX = k % 2 === 0, line = -HALF + Math.floor(Math.random() * (GRID + 1)) * CELL, dir = Math.random() < 0.5 ? 1 : -1;
      const car = { g, alongX, line: line + dir * 2.6, dir, t: rand(-HALF, HALF), speed: rand(9, 15) };
      g.rotation.y = alongX ? (dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (dir > 0 ? Math.PI : 0);
      scene.add(g); cars.push(car);
    }
  }
  function driveCars(dt) {
    for (const c of cars) {
      c.t += c.dir * c.speed * dt;
      if (c.t > HALF + 8) c.t = -HALF - 8; else if (c.t < -HALF - 8) c.t = HALF + 8;
      if (c.alongX) c.g.position.set(c.t, 0, c.line); else c.g.position.set(c.line, 0, c.t);
    }
  }
  // Coins float in the air over the streets (swing to get them) or sit on rooftops.
  function placeCoin(c, anywhere) {
    const near = anywhere ? HALF : 70;
    for (let tries = 0; tries < 30; tries++) {
      const x = (anywhere ? 0 : P.pos.x) + rand(-near, near), z = (anywhere ? 0 : P.pos.z) + rand(-near, near);
      if (Math.abs(x) > HALF - 5 || Math.abs(z) > HALF - 5) continue;
      const roofY = roofAt(x, z, 1);
      if (roofY > 0) { if (Math.random() < 0.5) continue; c.position.set(x, roofY + 1.4, z); }
      else c.position.set(x, rand(6, 30), z);
      return;
    }
    c.position.set(rand(-20, 20), 10, rand(-20, 20));
  }
  // The highest rooftop at a spot (0 when it's street).
  function roofAt(x, z, pad = 0, below = Infinity) {
    let y = 0;
    for (const b of buildings) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad && b.top <= below && b.top > y) y = b.top;
    return y;
  }
  function insideBuilding(p, pad = 0) {
    for (const b of buildings) if (p.x > b.x0 - pad && p.x < b.x1 + pad && p.z > b.z0 - pad && p.z < b.z1 + pad && p.y > b.y0 - pad && p.y < b.top + pad) return b;
    return null;
  }
  // Spider Pig, the hero you start as: a round pig in a red-and-blue spider suit with web lines,
  // big white mask eyes and a spider on his back, in the same toon style as the Dodge and Weave
  // characters. Front legs act as arms (one grabs the web), back legs as legs.
  let suitMat = null;
  function suitMaterial() {
    if (suitMat) return suitMat;
    // On a sphere, a grid of lines turns into lines of longitude and latitude: just like a web suit.
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#d3202e'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#1a0a10'; g.lineWidth = 1.6;
    for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
    for (let y = 8; y < 128; y += 12) { g.beginPath(); for (let x = 0; x <= 256; x += 16) g.quadraticCurveTo(x - 8, y + 3, x, y); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    return suitMat = new THREE.MeshToonMaterial({ map: t, gradientMap: toonRamp });
  }
  function suitBall(r, x, y, z, parent, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), suitMaterial());
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
  }
  function buildSpiderPig() {
    const BLUE = '#0f2f86', RED = '#b0101c', INK = '#141018';
    roundK = 0.8;
    try {
      const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      suitBall(0.5, 0, 0.78, 0.05, body, 1, 0.85, 1.35);                                        // round belly, in the suit
      ball(0.44, BLUE, 0, 0.66, 0.05, body, 1.02, 0.7, 1.3);                                    // blue sides and tummy
      const head = new THREE.Group(); head.position.set(0, 1.0, -0.62); body.add(head);
      suitBall(0.4, 0, 0, 0, head);
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.16, 20), suitMaterial());
      snout.position.set(0, -0.08, -0.4); snout.rotation.x = Math.PI / 2; head.add(snout);
      ball(0.17, '#a3121d', 0, -0.08, -0.48, head, 1, 0.85, 0.12).userData.noLine = true;      // nose disc
      for (const s of [-1, 1]) {
        ball(0.035, INK, s * 0.065, -0.08, -0.5, head, 1, 1.3, 0.5).userData.noLine = true;     // nostrils
        // Big white mask eyes with thick black rims, tilted like a spider hero's.
        const rim = ball(0.12, INK, s * 0.15, 0.14, -0.35, head, 0.95, 1.35, 0.4); rim.rotation.set(-0.2, s * 0.3, s * 0.55); rim.userData.free = true;
        const eye = ball(0.1, '#f4f6ff', s * 0.153, 0.14, -0.385, head, 0.8, 1.15, 0.3); eye.rotation.copy(rim.rotation); eye.userData.free = eye.userData.noLine = true;
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 12), suitMaterial());
        ear.position.set(s * 0.24, 0.33, -0.02); ear.rotation.set(-0.35, 0, -s * 0.5); head.add(ear);
      }
      // A black spider on his back.
      ball(0.1, INK, 0, 1.16, 0.18, body, 0.8, 0.35, 1.5).userData.noLine = true;
      ball(0.06, INK, 0, 1.17, -0.02, body, 1, 0.4, 1).userData.noLine = true;
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        const leg = box(0.26, 0.02, 0.025, INK, s * 0.14, 1.16, 0.06 + k * 0.07, body);
        leg.rotation.y = s * (0.6 - k * 0.4); leg.userData.noLine = true;
      }
      const tail = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 16, Math.PI * 1.6), mat(RED));
      tail.position.set(0, 0.95, 0.72); tail.rotation.y = Math.PI / 2; body.add(tail);
      const arms = [], legs = [];
      for (const [list, z] of [[arms, -0.38], [legs, 0.45]]) for (const s of [-1, 1]) {
        const hip = new THREE.Group(); hip.position.set(s * 0.26, 0.46, z); body.add(hip);
        limb(0.12, 0.1, 0.05, -0.3, BLUE, hip);
        limb(0.105, 0.1, -0.24, -0.36, RED, hip);                                                // red boots
        ball(0.1, RED, 0, -0.4, 0, hip, 1, 0.75, 1.1);
        list.push(hip);
      }
      root.scale.setScalar(1.35);
      addOutlines(root);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.2, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      return { root, body, arms, legs, head, shadow, pig: true };
    } finally { roundK = 0; }
  }
  let heroPick = store.get('hero', 'pig');
  const heroLabel = () => 'Hero: ' + (heroPick === 'pig' ? 'Spider Pig 🐷' : 'My runner');
  function makeHero() {
    if (hero) { scene.remove(hero.root); scene.remove(hero.shadow); }
    try { hero = heroPick === 'pig' ? buildSpiderPig() : buildAvatar(avatarCfg); } catch { hero = null; return; }
    hero.root.traverse(o => { if (o.isMesh && !o.userData.outline) o.castShadow = true; });
    scene.add(hero.root); scene.add(hero.shadow);    // a soft blob under you too, to help you judge landings
  }

  // ---------- Webs ----------
  // The web sticks to the building wall that is closest to a spot up and ahead of you.
  function webTarget() {
    const fwd = V(P.vel.x, 0, P.vel.z);
    if (fwd.lengthSq() < 9) fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    fwd.normalize();
    const want = P.pos.clone().addScaledVector(fwd, 20); want.y = Math.max(P.pos.y + 16, 18);
    let pick = null, bestD = Infinity;
    for (const b of buildings) {
      const p = V(Math.max(b.x0, Math.min(b.x1, want.x)), Math.max(b.y0 + 0.5, Math.min(b.top - 0.6, want.y)), Math.max(b.z0, Math.min(b.z1, want.z)));
      if (p.y < P.pos.y + 3) continue;
      const toIt = p.clone().sub(P.pos), dist = toIt.length();
      if (dist > WEB_RANGE || dist < 5 || toIt.x * fwd.x + toIt.z * fwd.z < -2) continue;
      const d = p.distanceTo(want) + dist * 0.4;          // prefer walls near that spot, and near you
      if (d < bestD) { bestD = d; pick = p; }
    }
    return pick;
  }
  function shoot() {
    const t = webTarget();
    if (t) { P.web = { at: t, len: Math.max(MIN_WEB, t.distanceTo(P.pos)) }; P.climb = null; }
  }
  function letGo() {
    if (!P.web) return;
    P.web = null;
    if (P.vel.y > 0) P.vel.y += 5;          // a boost when you let go on the way up
    const h = Math.hypot(P.vel.x, P.vel.z); if (h > 1) { P.vel.x *= 1 + 3 / h; P.vel.z *= 1 + 3 / h; }
  }
  function jump() {
    if (P.climb) {                          // kick off the wall
      P.vel.set(P.climb.nx * 9, JUMP, P.climb.nz * 9); P.yaw = Math.atan2(-P.climb.nx, -P.climb.nz); P.climb = null;
    } else { P.vel.y = JUMP; }
    P.ground = false; P.air = 0;
  }
  function press() {
    if (state !== 'play') return;
    holding = true;
    if (P.ground || P.climb) jump(); else if (!P.web) shoot();
  }
  function release() { holding = false; letGo(); }

  // ---------- Update ----------
  function moveDir() {
    // Joystick or keys, turned to match the camera.
    let ix = input.x, iy = input.y;
    if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
    if (keys.w || keys.arrowup) iy += 1; if (keys.s || keys.arrowdown) iy -= 1;
    const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    return V(-s * iy + c * ix, 0, -c * iy - s * ix);
  }
  function update(dt) {
    const dir = moveDir(), moving = dir.lengthSq() > 0.01;
    P.prevY = P.pos.y;
    if (P.climb) {
      // Climbing a wall: hold toward it (or just keep going) to climb, jump to kick off.
      P.vel.set(0, CLIMB, 0);
      P.pos.y += P.vel.y * dt;
      if (P.pos.y >= P.climb.b.top) {       // reached the top: hop onto the roof
        P.pos.y = P.climb.b.top; P.pos.x -= P.climb.nx * 1.2; P.pos.z -= P.climb.nz * 1.2;
        P.vel.set(-P.climb.nx * 4, 0, -P.climb.nz * 4); P.climb = null; P.ground = true;
      } else if (moving && dir.x * P.climb.nx + dir.z * P.climb.nz > 0.6) { P.vel.set(P.climb.nx * 3, 0, P.climb.nz * 3); P.climb = null; }   // let go of the wall
    } else if (P.ground) {
      const want = dir.multiplyScalar(RUN);
      P.vel.x += (want.x - P.vel.x) * Math.min(1, dt * 8); P.vel.z += (want.z - P.vel.z) * Math.min(1, dt * 8);
      P.vel.y = 0;
    } else {
      P.air += dt;
      if (holding && !P.web && P.air > 0.12) shoot();     // keep holding after a jump to swing
      P.vel.y -= GRAVITY * dt;
      P.vel.addScaledVector(dir, AIR_PUSH * dt);
      if (P.web) {
        const rope = P.pos.clone().sub(P.web.at).normalize();
        // Pump the swing: push along the way you are already going, across the web.
        const along = P.vel.clone().addScaledVector(rope, -P.vel.dot(rope));
        if (along.lengthSq() > 0.01) P.vel.addScaledVector(along.normalize(), PUMP * dt);
        P.web.len = Math.max(MIN_WEB, P.web.len - (P.web.len > MAX_WEB ? PULL : REEL) * dt);   // a long web pulls you in fast
      }
      const sp = Math.hypot(P.vel.x, P.vel.z); if (sp > 38) { P.vel.x *= 38 / sp; P.vel.z *= 38 / sp; }
    }
    if (!P.climb) P.pos.addScaledVector(P.vel, dt);
    if (P.web) {
      const off = P.pos.clone().sub(P.web.at), d = off.length();
      if (d > P.web.len) {                  // the web is tight: stay on its circle
        off.divideScalar(d); P.pos.copy(P.web.at).addScaledVector(off, P.web.len);
        const out = P.vel.dot(off); if (out > 0) P.vel.addScaledVector(off, -out);
      }
      if (P.pos.y > P.web.at.y - 1) letGo();               // swung right up: the web lets go and flings you
    }
    collide(dir);

    // Face the way you're going.
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (P.climb) P.yaw = Math.atan2(P.climb.nx, P.climb.nz) + Math.PI;
    else if (hv > 1) P.yaw = turnTo(P.yaw, Math.atan2(-P.vel.x, -P.vel.z), dt * 10);
    // The camera swings round behind you while you move, unless you just turned it yourself.
    camDrag = Math.max(0, camDrag - dt);
    if (!camDrag && hv > 4 && !P.climb) camYaw = turnTo(camYaw, P.yaw, dt * 1.6);

    for (const c of coins) {
      c.rotation.y += dt * 3;
      if (c.position.distanceTo(V(P.pos.x, P.pos.y + 1, P.pos.z)) < 1.8) { runCoins++; placeCoin(c, false); }
    }
    timeLeft -= dt;
    $('swScore').textContent = Math.max(0, Math.ceil(timeLeft)) + 's';
    $('swCoins').textContent = runCoins;
    if (timeLeft <= 0) finish();
  }
  const turnTo = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, k); };
  function collide(dir) {
    const R = 0.45;
    const lim = HALF + 20;
    P.pos.x = Math.max(-lim, Math.min(lim, P.pos.x)); P.pos.z = Math.max(-lim, Math.min(lim, P.pos.z));
    let floor = 0.3;
    for (const b of buildings) {
      if (P.pos.x < b.x0 - R || P.pos.x > b.x1 + R || P.pos.z < b.z0 - R || P.pos.z > b.z1 + R || P.pos.y + 1.8 < b.y0) continue;
      if (P.pos.y >= b.top - 0.05 || (P.prevY >= b.top - 0.4 && P.vel.y <= 0)) { floor = Math.max(floor, b.top); continue; }
      // Inside the walls: push out the shortest way and grab on to climb.
      const opts = [[P.pos.x - (b.x0 - R), -1, 0], [(b.x1 + R) - P.pos.x, 1, 0], [P.pos.z - (b.z0 - R), 0, -1], [(b.z1 + R) - P.pos.z, 0, 1]];
      opts.sort((p, q) => p[0] - q[0]);
      const [depth, nx, nz] = opts[0];
      P.pos.x += nx * depth; P.pos.z += nz * depth;
      const into = -(P.vel.x * nx + P.vel.z * nz);
      if (!P.web && (into > 0.5 || -(dir.x * nx + dir.z * nz) > 0.3)) { P.climb = { b, nx, nz }; P.ground = false; P.vel.set(0, 0, 0); }
      else { const v = P.vel.x * nx + P.vel.z * nz; if (v < 0) { P.vel.x -= v * nx; P.vel.z -= v * nz; } }
    }
    if (P.climb) return;
    if (P.pos.y <= floor && P.vel.y <= 0) {
      if (!P.ground && P.web) P.web = null;
      P.pos.y = floor; P.vel.y = 0; P.ground = true;
    } else if (P.pos.y > floor + 0.05) P.ground = false;
  }

  // ---------- Drawing ----------
  function animateHero(t, dt) {
    if (!hero) return;
    const a = hero, k = 1;
    a.root.position.copy(P.pos); a.root.rotation.set(0, P.yaw, 0);
    for (const g of [...a.arms, ...a.legs]) g.rotation.set(0, 0, 0);
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (a.pig) { animatePig(a, t, hv); }
    else if (P.climb) {
      const s = Math.sin(t * 12);
      a.arms[0].rotation.x = -2.6 + s * 0.5; a.arms[1].rotation.x = -2.6 - s * 0.5;
      a.legs[0].rotation.x = -0.6 - s * 0.4; a.legs[1].rotation.x = -0.6 + s * 0.4;
    } else if (P.web) {
      a.arms[1].rotation.z = 2.9; a.arms[0].rotation.z = -0.6;
      a.legs[0].rotation.x = -0.5; a.legs[1].rotation.x = 0.4;
      // Lean along the web.
      const rope = P.web.at.clone().sub(P.pos).normalize();
      a.root.rotation.x = -Math.asin(Math.max(-1, Math.min(1, rope.x * Math.sin(P.yaw) + rope.z * Math.cos(P.yaw)))) * 0.6;
    } else if (!P.ground) {
      a.arms[0].rotation.z = -1.2; a.arms[1].rotation.z = 1.2;
      a.legs[0].rotation.x = -0.9; a.legs[1].rotation.x = 0.3;
    } else if (hv > 0.5) {
      const s = Math.sin(t * hv * 0.9);
      a.legs[0].rotation.x = s * 0.9; a.legs[1].rotation.x = -s * 0.9;
      a.arms[0].rotation.x = -s * 0.8; a.arms[1].rotation.x = s * 0.8;
    }
    const ground = Math.max(0.32, roofAt(P.pos.x, P.pos.z, 0, P.pos.y + 0.1) + 0.02);
    a.shadow.position.set(P.pos.x, ground, P.pos.z); a.shadow.visible = !P.climb;
  }
  function animatePig(a, t, hv) {
    if (P.climb) {                          // nose up, trotters on the wall, scrambling up
      const s = Math.sin(t * 14);
      a.root.rotation.x = Math.PI / 2;
      a.arms[0].rotation.x = s * 0.7; a.arms[1].rotation.x = -s * 0.7;
      a.legs[0].rotation.x = -s * 0.7; a.legs[1].rotation.x = s * 0.7;
    } else if (P.web) {                     // one front trotter holds the web, the rest dangle
      a.arms[1].rotation.x = -2.7; a.arms[0].rotation.x = -0.4;
      a.legs[0].rotation.x = 0.5; a.legs[1].rotation.x = 0.3;
      const rope = P.web.at.clone().sub(P.pos).normalize();
      a.root.rotation.x = Math.asin(Math.max(-1, Math.min(1, -(rope.x * Math.sin(P.yaw) + rope.z * Math.cos(P.yaw))))) * 0.5;
    } else if (!P.ground) {                 // flying: legs out like a starfish
      a.arms[0].rotation.set(-0.7, 0, 0.5); a.arms[1].rotation.set(-0.7, 0, -0.5);
      a.legs[0].rotation.set(0.7, 0, 0.5); a.legs[1].rotation.set(0.7, 0, -0.5);
    } else if (hv > 0.5) {                  // galloping trot
      const s = Math.sin(t * hv * 1.1);
      a.arms[0].rotation.x = s * 0.8; a.arms[1].rotation.x = -s * 0.8;
      a.legs[0].rotation.x = -s * 0.8; a.legs[1].rotation.x = s * 0.8;
      a.body.position.y = Math.abs(s) * 0.08;
    }
    a.head.rotation.z = P.ground && hv > 0.5 ? Math.sin(t * 9) * 0.06 : 0;
  }
  function draw(t, dt) {
    animateHero(t, dt);
    // Camera behind and above you.
    const dist = P.web ? 11 : 9;
    const target = V(P.pos.x, P.pos.y + 1.6, P.pos.z);
    const want = V(target.x + Math.sin(camYaw) * dist, target.y + 3.5, target.z + Math.cos(camYaw) * dist);
    if (state !== 'play') { camYaw += dt * 0.15; }
    // Don't let the camera go inside a building: bring it in closer instead.
    const step = want.clone().sub(target).divideScalar(20);
    for (let i = 1, p = target.clone(); i <= 20; i++) {
      p.add(step);
      if (insideBuilding(p, 0.6)) { want.copy(p).sub(step); break; }
    }
    camera.position.lerp(want, state === 'play' ? Math.min(1, dt * 8) : 1);
    camera.lookAt(target);
    // Swing fast and the view stretches wider, like a movie.
    const speed = P.vel.length(), fov = 62 + Math.min(20, Math.max(0, speed - 12) * 0.8);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    // The sun's shadows follow you around the city.
    sun.target.position.copy(P.pos); sun.position.copy(P.pos).addScaledVector(SUN_DIR, 200);

    if (P.web) {
      const hand = V(P.pos.x, P.pos.y + (hero && hero.pig ? 1.9 : 2.2), P.pos.z);
      webLine.visible = true; webLine.position.copy(hand); webLine.lookAt(P.web.at); webLine.scale.set(1, 1, hand.distanceTo(P.web.at));
    } else webLine.visible = false;
    const aim = state === 'play' && !P.ground && !P.web && !P.climb ? webTarget() : null;
    reticle.visible = !!aim;
    if (aim) { reticle.position.copy(aim); reticle.lookAt(camera.position); reticle.scale.setScalar(1 + Math.sin(t * 8) * 0.12); }
    renderer.render(scene, camera);
  }

  // ---------- Screens ----------
  function show(id) {
    for (const p of ['swMenu', 'swOver']) $(p).hidden = p !== id;
    $('swHud').hidden = $('swPad').hidden = state !== 'play';
  }
  function placeHero() {
    const b = buildings.filter(b => Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) < CELL * 1.6).sort((p, q) => q.top - p.top)[0] || buildings[0];
    P.pos.set((b.x0 + b.x1) / 2, b.top, (b.z0 + b.z1) / 2); P.vel.set(0, 0, 0);
    P.ground = true; P.climb = null; P.web = null; P.yaw = 0; camYaw = 0; holding = false;
    if (camera) camera.position.set(P.pos.x, P.pos.y + 5, P.pos.z + 9);
  }
  function toMenu() {
    state = 'menu'; placeHero();
    $('swBest').textContent = best; $('swBank').textContent = bankNow(); $('swHero').textContent = heroLabel();
    show('swMenu');
  }
  function start() {
    makeHero(); placeHero(); runCoins = 0; timeLeft = ROUND_TIME;
    for (const c of coins) placeCoin(c, true);
    state = 'play'; show(null);
  }
  function finish() {
    state = 'over'; P.web = null; holding = false; input.x = input.y = 0;
    addCoins(runCoins);
    const newBest = runCoins > best; if (newBest) { best = runCoins; store.set('best', best); }
    $('swOverScore').textContent = runCoins; $('swOverBest').textContent = best;
    $('swNote').textContent = newBest ? 'New best!' : `You have ${bankNow()} coins to spend in Dodge and Weave.`;
    $('swBoardStatus').textContent = runCoins > 0 ? 'Saving your score…' : '';
    show('swOver');
    if (runCoins > 0) Leaderboard.submit('webswing', { name: playerName() || 'Mystery Swinger', score: runCoins }).then(r => {
      $('swBoardStatus').textContent = r.ok ? (r.improved ? 'Your new best is on the leaderboard!' : `Your best is still ${r.best} coins.`)
        : r.reason === 'offline' ? '' : r.reason === 'readonly' ? 'You need more access to add scores. Ask the owner to give you access.' : 'Your score couldn’t be saved this time.';
    });
  }
  Leaderboard.watch('webswing', 5, rows => {
    const box = $('swBoard'), list = $('swBoardList');
    box.hidden = !rows; if (!rows) return;
    list.innerHTML = '';
    if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No scores yet. Be the first!'; list.appendChild(li); return; }
    rows.forEach((row, i) => {
      const li = document.createElement('li'); if (row.me) li.className = 'me';
      for (const [cls, text] of [['rank', i + 1], ['name', row.name || 'Mystery Swinger'], ['pts', row.score]]) {
        const span = document.createElement('span'); span.className = cls; span.textContent = text; li.appendChild(span);
      }
      list.appendChild(li);
    });
  });

  // ---------- Input ----------
  // Keys: WASD / arrows to move, Space to jump, hold Space in the air to swing.
  window.addEventListener('keydown', e => {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      if (e.repeat) return;
      if (state === 'play') press(); else start();
    } else if (k === 'enter' && state !== 'play') start();
    else if (state === 'play' && /^(w|a|s|d|arrow(up|down|left|right))$/.test(k)) { keys[k] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', e => {
    if (!active) return;
    const k = e.key.toLowerCase(); keys[k] = false;
    if (k === ' ') release();
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; release(); });
  // Touch: drag on the left half to move (a joystick appears under your thumb), drag elsewhere to turn the camera.
  const stick = $('swStick'), knob = $('swKnob');
  const pointers = new Map();
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {}
    const isStick = e.pointerType !== 'mouse' && e.clientX < window.innerWidth / 2 && ![...pointers.values()].some(p => p.stick);
    pointers.set(e.pointerId, { stick: isStick, x: e.clientX, y: e.clientY });
    if (isStick) { stick.hidden = false; stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; knob.style.transform = ''; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    if (p.stick) {
      let dx = e.clientX - p.x, dy = e.clientY - p.y; const len = Math.hypot(dx, dy), max = 50;
      if (len > max) { dx *= max / len; dy *= max / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.x = dx / max; input.y = -dy / max;
    } else {
      camYaw -= (e.clientX - p.x) * 0.008; camDrag = 1.2; p.x = e.clientX; p.y = e.clientY;
    }
  });
  const lift = e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    pointers.delete(e.pointerId);
    if (p.stick) { stick.hidden = true; input.x = input.y = 0; }
  };
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, lift);
  const webBtn = $('swWeb');
  webBtn.addEventListener('pointerdown', e => { e.preventDefault(); try { webBtn.setPointerCapture(e.pointerId); } catch {} press(); });
  for (const ev of ['pointerup', 'pointercancel']) webBtn.addEventListener(ev, release);
  $('swPlay').onclick = start;
  $('swHero').onclick = () => {             // switch between Spider Pig and your Dodge and Weave runner
    heroPick = heroPick === 'pig' ? 'runner' : 'pig'; store.set('hero', heroPick);
    $('swHero').textContent = heroLabel(); makeHero();
  };
  $('swAgain').onclick = start;
  $('swMenuBtn').onclick = toMenu;
  for (const id of ['swLobby', 'swOverLobby']) $(id).onclick = () => window.Lobby && Lobby.show();

  // ---------- Loop ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', () => { if (active) resize(); });
  function loop(t) {
    if (!active) return;
    const dt = Math.min((t - last) / 1000, 0.033); last = t;
    if (state === 'play') update(dt);
    driveCars(dt);
    draw(t / 1000, dt);
    requestAnimationFrame(loop);
  }
  function setup() {
    if (renderer) return true;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    buildCity(); makeHero(); return true;
  }
  window.WebSwing = {
    open() {
      root.hidden = false; active = true;
      if (!setup()) { $('swNote').textContent = 'This game needs 3D graphics, which this browser has turned off.'; return; }
      resize(); makeHero(); toMenu(); last = performance.now(); requestAnimationFrame(loop);
    },
    close() { active = false; root.hidden = true; release(); input.x = input.y = 0; for (const k in keys) keys[k] = false; },
    // For tests and demos: advance the game by one step without waiting for the screen.
    _step(dt) { if (state === 'play') update(dt); draw(performance.now() / 1000, dt); },
    _cam: v => { camYaw = v; }, _start: () => start(), _press: () => press(), _release: () => release(), _input: input,
    _state: () => ({ state, pos: P.pos.toArray().map(v => +v.toFixed(2)), vel: P.vel.toArray().map(v => +v.toFixed(2)), ground: P.ground, climb: !!P.climb, web: !!P.web, runCoins, timeLeft }),
  };
})();

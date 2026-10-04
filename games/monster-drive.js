// Monster Drive: drive a monster truck over hills, bridges, jumps and steps to the finish flag, like
// Drive Mad. The physics is 2D (the truck is four points held together by sticks: two wheels and two
// roof corners) and drawn in 3D with blocky shapes. Flip onto your roof or fall in the water and the
// level restarts. Gas tips the truck back in the air, reverse tips it forward.
// Loaded by index.html after rail-rush.js; coins go into the Dodge and Weave bank.
(() => {
  const root = document.getElementById('monsterdrive');
  const canvas = document.getElementById('mdCanvas');
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('monsterdrive.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('monsterdrive.' + k, JSON.stringify(v)); } catch {} },
  };

  const G = 20, WHEEL_R = 0.8, MAX_SPEED = 14, ACCEL = 14, AIR_SPIN = 1.1, STEP = 1 / 120;
  const WATER = -7;

  // ---------- Levels ----------
  // `ground` pieces are solid hills (filled down to the water); `bridge` pieces are thin wooden planks.
  // Points are [x, y] left to right; the truck starts at x = 0 and wins past `finish`.
  const hills = (x0, x1, step, f) => { const p = []; for (let x = x0; x <= x1; x += step) p.push([x, +f(x).toFixed(2)]); return p; };
  const LEVELS = [
    { name: 'First Drive', finish: 84, parts: [
      { type: 'ground', pts: [[-12, 0], [20, 0], [28, 1.6], [36, 0], [50, 0]] },
      { type: 'bridge', pts: [[50, 0], [54, -0.7], [58, -1], [62, -0.7], [66, 0]] },
      { type: 'ground', pts: [[66, 0], [96, 0]] }] },
    { name: 'Bumpy Hills', finish: 116, parts: [
      { type: 'ground', pts: [[-12, 0], [8, 0], ...hills(12, 112, 4, x => 2.4 * Math.sin((x - 12) / 8) + 1.2 * Math.sin((x - 12) / 3.3)), [120, 0], [130, 0]] }] },
    { name: 'Big Jump', finish: 86, parts: [
      { type: 'ground', pts: [[-12, 0], [28, 0], [38, 3.2]] },
      { type: 'ground', pts: [[43, 2.6], [52, 1.2], [62, 0], [98, 0]] }] },
    { name: 'Stairs', finish: 66, parts: [
      { type: 'ground', pts: [[-12, 0], [16, 0], [16, 0.7], [20, 0.7], [20, 1.4], [24, 1.4], [24, 2.1], [28, 2.1], [28, 2.8], [34, 2.8], [44, 0], [78, 0]] }] },
    { name: 'Bridge Islands', finish: 104, parts: [
      { type: 'ground', pts: [[-12, 0], [14, 0]] },
      { type: 'bridge', pts: [[14, 0], [19, -0.6], [24, 0]] },
      { type: 'ground', pts: [[24, 0], [29, 1.5], [36, 1.5]] },
      { type: 'bridge', pts: [[36, 1.5], [42, 0.9], [48, 1.5]] },
      { type: 'ground', pts: [[48, 1.5], [56, 1.5], [62, 0], [70, 0], [80, 4], [90, 0], [116, 0]] }] },
    { name: 'Mega Jump', finish: 98, parts: [
      { type: 'ground', pts: [[-12, 8], [8, 8], [28, 0], [36, 0], [44, 3.6]] },
      { type: 'ground', pts: [[51, 3.3], [60, 1.4], [70, 0], [110, 0]] }] },
    { name: 'Mountain Climb', finish: 92, parts: [
      { type: 'ground', pts: [[-12, 0], [10, 0], [26, 6], [32, 6], [32, 7], [36, 7], [50, 12], [60, 12], [64, 11], [72, 13], [82, 13], [92, 13], [104, 13]] }] },
    { name: 'The Final Run', finish: 140, parts: [
      { type: 'ground', pts: [[-12, 0], [12, 0], [12, 0.7], [16, 0.7], [16, 1.4], [22, 1.4], [32, 0], [40, 0], [48, 3.4]] },
      { type: 'ground', pts: [[53, 3.1], [61, 1.5], [70, 1.5]] },
      { type: 'bridge', pts: [[70, 1.5], [76, 0.8], [82, 0.6], [88, 0.8], [94, 1.5]] },
      { type: 'ground', pts: [[94, 1.5], ...hills(98, 130, 4, x => 1.5 + 1.8 * Math.sin((x - 98) / 5)), [136, 1.5], [152, 1.5]] }] },
  ];

  // ---------- Scene ----------
  let renderer, scene, camera, levelGroup, truck;
  let active = false, state = 'menu', last = 0, levelIx = 0, segs = [], crashT = 0, endT = 0, runT = 0, tries = 0;
  let done = store.get('done', []);                 // levels finished
  let best = done.length;
  const keys = {}, pedal = { gas: false, back: false };
  const mat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

  // ---------- Shared with Dodge and Weave ----------
  let bank_ = null;
  const bankNow = () => { try { return bank; } catch { if (bank_ != null) return bank_; try { return JSON.parse(localStorage.getItem('railrush.bank')) || 0; } catch { return 0; } } };
  function addCoins(n) {
    try { bank += n; } catch { bank_ = (bankNow() || 0) + n; }
    try { localStorage.setItem('railrush.bank', JSON.stringify(bankNow())); } catch {}
  }
  const playerName = () => { try { return runnerName; } catch { try { return JSON.parse(localStorage.getItem('railrush.name')) || ''; } catch { return ''; } } };

  function buildWorld() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#7cc6f7');
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight('#ffffff', '#6a8fc0', 0.85));
    const sun = new THREE.DirectionalLight('#ffffff', 0.7); sun.position.set(6, 14, 10); scene.add(sun);
    // Big blue low-poly mountains far behind, and water below.
    const blues = ['#3b82f6', '#2f6fe0', '#4a90f0', '#2563eb', '#5a9cf2'];
    for (let i = 0; i < 26; i++) {
      const s = 14 + Math.random() * 18;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 1.4, s), mat(blues[i % blues.length]));
      m.position.set(-40 + i * 9 + Math.random() * 6, -4 + Math.random() * 6, -40 - Math.random() * 25);
      m.rotation.set(Math.random() * 0.6, Math.random() * 1.5, Math.random() * 0.4); scene.add(m);
    }
    const water = new THREE.Mesh(new THREE.BoxGeometry(600, 1, 80), mat('#5ec8f8')); water.position.set(100, WATER - 0.5, -10); scene.add(water);
    const foam = new THREE.Mesh(new THREE.BoxGeometry(600, 0.05, 0.4), mat('#ffffff')); foam.position.set(100, WATER + 0.02, 6); scene.add(foam);
    levelGroup = new THREE.Group(); scene.add(levelGroup);
    truck = buildTruck(); scene.add(truck.group);
  }
  // A chunky yellow monster truck with a grey back and four big knobbly wheels.
  function buildTruck() {
    const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
    const box = (w, h, d, c, x, y, z, parent = body) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); parent.add(m); return m; };
    box(3.4, 0.7, 1.9, '#ffd23f', 0, 0.75, 0);                       // main body
    box(1.6, 0.8, 1.8, '#c9ccd6', -0.8, 1.45, 0);                    // grey back
    box(1.3, 0.8, 1.8, '#ffd23f', 0.55, 1.45, 0);                    // cab
    box(1.1, 0.4, 1.82, '#2b2f3a', 0.6, 1.55, 0);                    // windows
    box(0.5, 0.35, 1.84, '#2b2f3a', -0.8, 1.55, 0);
    box(1.3, 0.35, 1.9, '#ffd23f', 1.35, 1.05, 0);                   // bonnet
    box(0.12, 0.25, 0.4, '#ff4f5e', -1.72, 0.85, 0.6); box(0.12, 0.25, 0.4, '#ff4f5e', -1.72, 0.85, -0.6);   // tail lights
    box(0.12, 0.2, 0.35, '#fff6c2', 1.72, 0.85, 0.6); box(0.12, 0.2, 0.35, '#fff6c2', 1.72, 0.85, -0.6);     // headlights
    box(2.8, 0.25, 1.4, '#e8743b', 0, 0.3, 0);                       // orange frame underneath
    const wheels = [];
    for (const x of [-1.3, 1.3]) {
      const w = new THREE.Group(); group.add(w);
      for (const z of [-1.05, 1.05]) {
        const tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.7, 10), mat('#24262e')); tyre.rotation.x = Math.PI / 2; tyre.position.z = z; w.add(tyre);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.72, 6), mat('#5a5f6e')); hub.rotation.x = Math.PI / 2; hub.position.z = z; w.add(hub);
        for (let k = 0; k < 10; k++) {                                // knobbly treads
          const a = k / 10 * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.74), mat('#1b1c22'));
          t.position.set(Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R, z); t.rotation.z = a; w.add(t);
        }
      }
      wheels.push(w);
    }
    return { group, body, wheels, spin: 0 };
  }

  // ---------- Building a level ----------
  function buildLevel(L) {
    scene.remove(levelGroup); levelGroup = new THREE.Group(); scene.add(levelGroup);
    segs = [];
    for (const part of L.parts) {
      const pts = part.pts;
      for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
      if (part.type === 'ground') {
        // Side walls so you can drive into a cliff (or fall past one).
        segs.push([pts[0][0], WATER - 2, pts[0][0], pts[0][1]], [pts[pts.length - 1][0], pts[pts.length - 1][1], pts[pts.length - 1][0], WATER - 2]);
        const shape = new THREE.Shape();
        shape.moveTo(pts[0][0], WATER - 1); for (const [x, y] of pts) shape.lineTo(x, y); shape.lineTo(pts[pts.length - 1][0], WATER - 1);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false }); geo.translate(0, 0, -2.5);
        levelGroup.add(new THREE.Mesh(geo, mat('#f6cdb4')));
        // Grass along the top, with a darker edge.
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
          if (Math.abs(x1 - x0) < 0.01) continue;
          const g = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.4, 5.1), mat(i % 2 ? '#6dcc5a' : '#74d462'));
          g.position.set((x0 + x1) / 2, (y0 + y1) / 2 - 0.15, 0); g.rotation.z = Math.atan2(y1 - y0, x1 - x0); levelGroup.add(g);
          const lip = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.25, 0.2), mat('#4fae42'));
          lip.position.set((x0 + x1) / 2, (y0 + y1) / 2 - 0.45, 2.6); lip.rotation.z = g.rotation.z; levelGroup.add(lip);
        }
      } else {
        // Wooden planks with posts going down into the water.
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 0.9));
          for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t;
            const plank = new THREE.Mesh(new THREE.BoxGeometry(len / n - 0.08, 0.35, 4.2), mat(k % 2 ? '#b8746a' : '#c4827a'));
            plank.position.set(px, py - 0.18, 0); plank.rotation.z = Math.atan2(y1 - y0, x1 - x0); levelGroup.add(plank);
          }
        }
        for (const [x, y] of [pts[0], pts[pts.length - 1]]) for (const z of [-1.9, 1.9]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, y - WATER, 0.4), mat('#9a5a52')); post.position.set(x, (y + WATER) / 2, z); levelGroup.add(post);
        }
      }
    }
    // Start arrow sign and the checkered finish gate.
    const groundY = x => { let y = -99; for (const [ax, ay, bx, by] of segs) if (x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && ax !== bx) y = Math.max(y, ay + (by - ay) * (x - ax) / (bx - ax)); return y; };
    const fy = groundY(L.finish);
    const gate = new THREE.Group(); gate.position.set(L.finish, fy, 0); levelGroup.add(gate);
    for (const z of [-2.6, 2.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), mat('#b8746a')); p.position.set(0, 2.5, z); gate.add(p); }
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const g = c.getContext('2d'); for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 5.6), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) })); banner.position.y = 5; banner.rotation.y = Math.PI / 2; gate.add(banner);
    const sy = groundY(6);
    const sign = new THREE.Group(); sign.position.set(6, sy, -2.2); levelGroup.add(sign);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), mat('#b8746a')); pole.position.y = 1.5; sign.add(pole);
    const arrow = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 0.2), mat('#ffffff')); arrow.position.set(0.6, 2.8, 0); sign.add(arrow);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 3), mat('#ffffff')); tip.rotation.z = -Math.PI / 2; tip.position.set(2, 2.8, 0); sign.add(tip);
  }

  // ---------- Truck physics ----------
  // Points: 0 rear wheel, 1 front wheel, 2 rear roof, 3 front roof. Sticks between every pair keep its shape.
  // The wheels are heavier than the roof, so the truck is bottom-heavy and hard to tip over.
  const SHAPE = [[-1.3, 0], [1.3, 0], [-1.2, 1.5], [1.2, 1.5]], INV_MASS = [1, 1, 3, 3];
  let P = [], sticks = [], touching = [false, false], roofHit = false;
  function placeTruck(x, y) {
    P = SHAPE.map(([sx, sy]) => ({ x: x + sx, y: y + sy, px: x + sx, py: y + sy }));
    sticks = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) sticks.push([a, b, Math.hypot(SHAPE[a][0] - SHAPE[b][0], SHAPE[a][1] - SHAPE[b][1])]);
    truck.spin = 0;
  }
  function collide(p, r, motor) {
    let any = false;
    for (const [ax, ay, bx, by] of segs) {
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = ((p.x - ax) * dx + (p.y - ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
      const qx = ax + dx * t, qy = ay + dy * t, ox = p.x - qx, oy = p.y - qy, d = Math.hypot(ox, oy);
      if (d >= r || d < 1e-6) continue;
      const nx = ox / d, ny = oy / d;
      p.x += nx * (r - d); p.y += ny * (r - d);
      any = true;
      // Driving and friction along this surface: change the point's speed along it. Against a wall
      // the surface points straight up, so the wheel drives up it (that's how the truck climbs steps).
      const tx = ny, ty = -nx;
      let vx = (p.x - p.px) / STEP, vy = (p.y - p.py) / STEP;
      let vn = vx * nx + vy * ny, vt = vx * tx + vy * ty;
      if (vn < 0) vn = 0;
      if (motor !== null) {
        if (motor) { const target = motor * MAX_SPEED; vt += Math.max(-ACCEL * STEP * 2, Math.min(ACCEL * STEP * 2, target - vt)); }
        else vt *= 1 - 0.6 * STEP;                                   // rolling to a stop
      } else vt *= 1 - 8 * STEP;                                    // the roof scrapes along
      vx = tx * vt + nx * vn; vy = ty * vt + ny * vn;
      p.px = p.x - vx * STEP; p.py = p.y - vy * STEP;
    }
    return any;
  }
  function physicsStep(throttle) {
    for (const p of P) {
      const vx = (p.x - p.px) * 0.9995, vy = (p.y - p.py) * 0.9995;
      p.px = p.x; p.py = p.y; p.x += vx; p.y += vy - G * STEP * STEP;
    }
    // Spin the truck in the air: gas tips it back, reverse tips it forward.
    if (!touching[0] && !touching[1] && throttle) {
      const cx = (P[0].x + P[1].x) / 2, cy = (P[0].y + P[1].y) / 2, a = throttle * AIR_SPIN * STEP, c = Math.cos(a), s = Math.sin(a);
      for (const p of P) {
        for (const k of ['', 'p']) { const x = p[k + 'x'] - cx, y = p[k + 'y'] - cy; p[k + 'x'] = cx + x * c - y * s; p[k + 'y'] = cy + x * s + y * c; }
      }
    }
    for (let it = 0; it < 6; it++) {
      for (const [a, b, len] of sticks) {
        const pa = P[a], pb = P[b], dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 1, k = (d - len) / d / (INV_MASS[a] + INV_MASS[b]);
        pa.x += dx * k * INV_MASS[a]; pa.y += dy * k * INV_MASS[a]; pb.x -= dx * k * INV_MASS[b]; pb.y -= dy * k * INV_MASS[b];
      }
    }
    touching = [collide(P[0], WHEEL_R, throttle), collide(P[1], WHEEL_R, throttle)];
    roofHit = collide(P[2], 0.3, null) | collide(P[3], 0.3, null);
  }

  // ---------- Update ----------
  function throttle() {
    const g = pedal.gas || keys.arrowright || keys.d || keys.w || keys.arrowup, b = pedal.back || keys.arrowleft || keys.a || keys.s || keys.arrowdown;
    return (g ? 1 : 0) - (b ? 0.7 : 0);
  }
  function update(dt) {
    if (state !== 'play') return;
    runT += dt;
    const th = throttle();
    for (let t = 0; t < dt; t += STEP) physicsStep(th);
    const cx = (P[0].x + P[1].x) / 2, cy = (P[0].y + P[1].y) / 2;
    // Upside down (roof pointing down) and touching the ground for a moment = crash.
    const ux = (P[2].x + P[3].x) / 2 - cx, uy = (P[2].y + P[3].y) / 2 - cy;
    if (uy < -0.1 * Math.hypot(ux, uy) && roofHit) crashT += dt; else crashT = 0;
    if (crashT > 0.5) return crash('Flipped over!');
    if (Math.min(P[0].y, P[1].y) < WATER + 0.3) return crash('Splash!');
    if (cx > LEVELS[levelIx].finish) return finishLevel();
    $('mdTime').textContent = runT.toFixed(1) + 's';
  }

  // ---------- Drawing ----------
  function draw() {
    if (P.length) {
      const cx = (P[0].x + P[1].x) / 2, cy = (P[0].y + P[1].y) / 2;
      const ang = Math.atan2(P[1].y - P[0].y, P[1].x - P[0].x);
      truck.body.position.set(cx, cy, 0); truck.body.rotation.z = ang;
      const speed = ((P[0].x - P[0].px) + (P[1].x - P[1].px)) / 2 / STEP;
      truck.spin -= speed * (1 / 60) / WHEEL_R;
      truck.wheels.forEach((w, i) => { w.position.set(P[i].x, P[i].y, 0); w.rotation.z = truck.spin; });
      // Camera off to the side and a little above, like a toy diorama.
      const want = new THREE.Vector3(cx + 4, cy + 6, 21);
      camera.position.lerp(want, 0.12); camera.lookAt(cx + 4, cy + 1, 0);
    }
    renderer.render(scene, camera);
  }

  // ---------- Screens ----------
  function show(id) {
    for (const p of ['mdMenu', 'mdWin']) $(p).hidden = p !== id;
    $('mdHud').hidden = $('mdPads').hidden = state !== 'play';
  }
  function renderLevels() {
    const grid = $('mdLevels'); grid.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const open = i === 0 || done.includes(i - 1) || done.includes(i);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'md-level' + (done.includes(i) ? ' done' : '');
      b.disabled = !open; b.innerHTML = `<b>${open ? i + 1 : '🔒'}</b><span>${done.includes(i) ? '✓ ' : ''}${L.name}</span>`;
      b.onclick = () => startLevel(i);
      grid.appendChild(b);
    });
  }
  function toMenu() {
    state = 'menu'; renderLevels();
    $('mdBank').textContent = bankNow(); $('mdBest').textContent = done.length + ' / ' + LEVELS.length;
    if (!P.length) { buildLevel(LEVELS[0]); placeTruck(0, 1); }
    show('mdMenu');
  }
  function startLevel(i, keepTries) {
    levelIx = i; if (!keepTries) tries = 0;
    buildLevel(LEVELS[i]);
    const y0 = (() => { let y = 0; for (const [ax, ay, bx, by] of segs) if (ax <= 0 && bx >= 0 && ax !== bx) y = Math.max(y, ay + (by - ay) * (0 - ax) / (bx - ax)); return y; })();
    placeTruck(0, y0 + WHEEL_R + 0.05);
    camera.position.set(4, y0 + 6, 21);
    state = 'play'; crashT = 0; runT = 0;
    $('mdLevelName').textContent = `Level ${i + 1}: ${LEVELS[i].name}`;
    show(null);
  }
  function crash(text) {
    state = 'crash'; tries++;
    toast(text);
    setTimeout(() => { if (state === 'crash' && active) startLevel(levelIx, true); }, 900);
  }
  function finishLevel() {
    state = 'won';
    const first = !done.includes(levelIx);
    if (first) { done.push(levelIx); store.set('done', done); }
    const coins = first ? 20 : 5;
    addCoins(coins);
    Celebrate.win(levelIx === LEVELS.length - 1 ? 'YOU WON!' : 'LEVEL DONE!');
    const lastOne = levelIx === LEVELS.length - 1;
    $('mdWinTitle').textContent = lastOne ? 'You beat every level! 🏆' : `Level ${levelIx + 1} complete! 🏁`;
    $('mdWinText').textContent = `${LEVELS[levelIx].name} in ${runT.toFixed(1)} seconds${tries ? ` (after ${tries} ${tries === 1 ? 'try' : 'tries'})` : ' on the first try!'}. +${coins} coins.`;
    $('mdNext').hidden = lastOne;
    show('mdWin');
    if (done.length > best) {
      best = done.length;
      Leaderboard.submit('monsterdrive', { name: playerName() || 'Mystery Driver', score: best }).then(() => {});
    }
  }
  let toastT = 0;
  function toast(text) { const el = $('mdToast'); el.textContent = text; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 900); }

  // ---------- Input ----------
  // Keys: → / D to drive, ← / A to reverse. Touch: the two big pedal buttons at the bottom corners.
  window.addEventListener('keydown', e => {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (/^(w|a|s|d|arrow(up|down|left|right))$/.test(k)) { keys[k] = true; if (state === 'play') e.preventDefault(); }
    else if (k === 'r' && state === 'play') startLevel(levelIx, true);
    else if ((k === 'enter' || k === ' ') && state === 'won' && levelIx < LEVELS.length - 1) { e.preventDefault(); startLevel(levelIx + 1); }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; pedal.gas = pedal.back = false; });
  for (const [id, which] of [['mdGas', 'gas'], ['mdBack', 'back']]) {
    const b = $(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} pedal[which] = true; b.classList.add('down'); });
    for (const ev of ['pointerup', 'pointercancel']) b.addEventListener(ev, () => { pedal[which] = false; b.classList.remove('down'); });
  }
  $('mdRetry').onclick = () => { if (state === 'play' || state === 'crash') startLevel(levelIx, true); };
  $('mdMenuBtn').onclick = toMenu;
  $('mdNext').onclick = () => startLevel(levelIx + 1);
  $('mdAgain').onclick = () => startLevel(levelIx);
  $('mdWinLevels').onclick = toMenu;
  for (const id of ['mdLobby', 'mdWinLobby']) $(id).onclick = () => window.Lobby && Lobby.show();

  // ---------- Loop ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 70 : 45; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', () => { if (active) resize(); });
  function loop(t) {
    if (!active) return;
    const dt = Math.min((t - last) / 1000, 0.033); last = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  function setup() {
    if (renderer) return true;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    buildWorld(); return true;
  }
  window.MonsterDrive = {
    open() {
      root.hidden = false; active = true;
      if (!setup()) { $('mdWinText').textContent = 'This game needs 3D graphics, which this browser has turned off.'; return; }
      resize(); toMenu(); last = performance.now(); requestAnimationFrame(loop);
    },
    close() { active = false; root.hidden = true; pedal.gas = pedal.back = false; for (const k in keys) keys[k] = false; if (state === 'crash') state = 'menu'; },
    // For tests: drive with a fixed pedal for a number of seconds and report what happened.
    _drive(level, th, seconds, pattern) {
      startLevel(level);
      for (let t = 0; t < seconds && state === 'play'; t += 1 / 60) {
        const p = pattern ? pattern(t, (P[0].x + P[1].x) / 2) : th;
        pedal.gas = p > 0; pedal.back = p < 0; update(1 / 60);
      }
      pedal.gas = pedal.back = false;
      return { state, x: +((P[0].x + P[1].x) / 2).toFixed(1), y: +((P[0].y + P[1].y) / 2).toFixed(1), t: +runT.toFixed(1), toast: $('mdToast').textContent };
    },
    _state: () => ({ state, levelIx, done: done.join(','), x: P.length && +((P[0].x + P[1].x) / 2).toFixed(1) }),
  };
})();

// Tumble Dash: a 3D obstacle-course race against 11 computer runners, like Stumble Guys.
// Dodge spinning sweepers, hop across stepping stones, cross a bridge of swinging hammers,
// jump between moving platforms and squeeze past punching walls to reach the finish.
// Fall off and you go back to the last checkpoint. Loaded by index.html after rail-rush.js:
// everyone is a Dodge and Weave character (buildAvatar) and coins go into the same bank.
(() => {
  const root = document.getElementById('tumbledash');
  const canvas = document.getElementById('tdCanvas');
  const $ = id => document.getElementById(id);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const RUNNERS = 12, R = 0.45, RUN = 8.5, JUMP = 11.5, GRAVITY = 30, TIME_LIMIT = 150;
  const NAMES = ['Bubbles', 'Zoom', 'Pixel', 'Mango', 'Turbo', 'Luna', 'Ziggy', 'Coco', 'Rocket', 'Sunny', 'Biscuit', 'Nova', 'Pickles', 'Jazz', 'Taco', 'Blaze'];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('tumbledash.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('tumbledash.' + k, JSON.stringify(v)); } catch {} },
  };
  const rand = (a, b) => a + Math.random() * (b - a);

  let renderer, scene, camera, runners = [], me = null;
  let active = false, state = 'menu', last = 0, clock = 0, raceT = 0, countdownT = 0, finishers = 0, best = store.get('best', 0);
  const input = { x: 0, y: 0 }, keys = {};
  let jumpHeld = false;

  // ---------- Shared with Dodge and Weave ----------
  let bank_ = null;
  const bankNow = () => { try { return bank; } catch { if (bank_ != null) return bank_; try { return JSON.parse(localStorage.getItem('railrush.bank')) || 0; } catch { return 0; } } };
  function addCoins(n) {
    try { bank += n; } catch { bank_ = (bankNow() || 0) + n; }
    try { localStorage.setItem('railrush.bank', JSON.stringify(bankNow())); } catch {}
  }
  const playerName = () => { try { return runnerName; } catch { try { return JSON.parse(localStorage.getItem('railrush.name')) || ''; } catch { return ''; } } };
  const myLook = () => { try { return { ...avatarCfg, pet: 'none' }; } catch { return null; } };
  function randomLook() {
    const pick = list => list[Math.floor(Math.random() * list.length)];
    try {
      const c = { ...DEFAULT_AVATAR, pet: 'none' };
      for (const [key, opt] of Object.entries(OPTIONS)) {
        if (key === 'pet' || key === 'outfit') continue;
        const v = pick(opt.values); c[key] = Array.isArray(v) ? v[0] : v;
      }
      if (Math.random() < 0.35) c.outfit = pick(OPTIONS.outfit.values.slice(1))[0];
      return c;
    } catch { return null; }
  }

  // ---------- The course ----------
  // It runs from z = 0 forward to z = FINISH (negative). Every floor piece has its top at y = 0.
  const FINISH = -196;
  const floors = [];        // { x0, x1, z0, z1, move?: { amp, speed, phase }, dx }
  const sweepers = [];      // spinning bars at ground level: jump over them
  const hammers = [];       // giant swinging hammers over the bridge
  const pushers = [];       // walls that punch out from the sides
  const CHECKPOINTS = [0, -44, -72, -112, -150];
  const mat = c => new THREE.MeshLambertMaterial({ color: c });

  function floor(x0, x1, zFar, zNear, color, move) {
    const f = { x0, x1, z0: zFar, z1: zNear, move, dx: 0 };
    const w = x1 - x0, d = zNear - zFar;
    f.mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), mat(color));
    f.mesh.position.set((x0 + x1) / 2, -0.6, (zFar + zNear) / 2); scene.add(f.mesh);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), mat('#ffffff'));
    trim.position.y = 0.42; f.mesh.add(trim);                                                  // a white band round the sides
    floors.push(f); return f;
  }
  function buildCourse() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#8fd8ff');
    scene.fog = new THREE.Fog('#8fd8ff', 60, 150);
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    scene.add(new THREE.HemisphereLight('#ffffff', '#7a8fb0', 0.95));
    const sun = new THREE.DirectionalLight('#ffffff', 0.55); sun.position.set(10, 30, 10); scene.add(sun);
    // Fluffy clouds below and around the floating course.
    const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    for (let i = 0; i < 40; i++) {
      const g = new THREE.Group(), side = Math.random() < 0.5 ? -1 : 1;
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(rand(2, 3.5), 10, 8), cloudMat); b.position.set(k * 2.4, rand(-0.5, 0.8), rand(-1, 1)); g.add(b); }
      g.position.set(side * rand(14, 50), rand(-28, -6), rand(-230, 20)); scene.add(g);
    }
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat('#4fb3e8')); sea.rotation.x = -Math.PI / 2; sea.position.y = -34; scene.add(sea);

    // 1. Start pad and the sweeper field.
    floor(-6, 6, -14, 4, '#ffd23f');
    floor(-6, 6, -44, -14, '#7ad36b');
    for (const [z, speed] of [[-22, 1.7], [-36, -2.2]]) {
      const g = new THREE.Group(); g.position.set(0, 0, z); scene.add(g);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.6, 16), mat('#ffd23f')); post.position.y = 0.8; g.add(post);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 10.6, 12), mat('#ff4f5e')); bar.rotation.z = Math.PI / 2; bar.position.y = 0.55; g.add(bar);
      for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat('#ffffff')); cap.position.set(s * 5.3, 0.55, 0); g.add(cap); }
      sweepers.push({ z, speed, ang: Math.random() * 6, mesh: g });
    }
    // 2. Stepping stones over the clouds.
    let z = -44;
    for (const x of [-1.5, 1.2, -1.2, 1.5, 0]) { z -= 5.2; floor(x - 1.9, x + 1.9, z - 1.9, z + 1.9, '#ff9be0'); }
    // 3. The hammer bridge.
    floor(-6, 6, -76, -70, '#7ad36b');
    floor(-2, 2, -110, -76, '#a98bff');
    for (const [hz, ph] of [[-82, 0], [-92, 2.1], [-102, 4.2]]) {
      const g = new THREE.Group(); g.position.set(0, 0, hz); scene.add(g);
      for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), mat('#6a6f80')); post.position.set(s * 4.5, 4, 0); g.add(post); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.5, 0.5), mat('#6a6f80')); beam.position.y = 8; g.add(beam);
      const arm = new THREE.Group(); arm.position.y = 7.8; g.add(arm);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), mat('#8b5a2b')); stick.position.y = -3; arm.add(stick);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 16), mat('#ff4f5e')); head.rotation.x = Math.PI / 2; head.position.y = -6.4; arm.add(head);
      for (const s of [-1, 1]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 16), mat('#ffffff')); band.rotation.x = Math.PI / 2; band.position.set(0, -6.4, s * 0.9); arm.add(band); }
      hammers.push({ z: hz, phase: ph, arm, ang: 0, vel: 0 });
    }
    // 4. Moving platforms.
    floor(-6, 6, -116, -110, '#7ad36b');
    z = -116;
    for (const [sp, ph] of [[1.2, 0], [1.6, 2], [1.3, 4]]) { z -= 7; floor(-2, 2, z - 2, z + 2, '#5fd0ff', { amp: 3.2, speed: sp, phase: ph }); }
    // 5. The punching-wall corridor and the finish.
    floor(-6, 6, -186, -144, '#7ad36b');
    for (const [pz, side, ph] of [[-156, 1, 0], [-162, -1, 1.2], [-168, 1, 2.4], [-174, -1, 3.6], [-180, 1, 0.6]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 3), mat('#ff7bd0')); m.position.set(side * 9, 1.1, pz); scene.add(m);
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.8), mat('#ffd23f')); face.position.x = -side * 3.05; m.add(face);
      pushers.push({ z: pz, side, phase: ph, mesh: m, ext: 0, vel: 0 });
    }
    floor(-6, 6, FINISH - 10, -186, '#ffd23f');
    // Finish arch with a checkered banner, and little flags at each checkpoint.
    const arch = new THREE.Group(); arch.position.z = FINISH; scene.add(arch);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), mat('#ff4f5e')); p.position.set(s * 6, 3, 0); arch.add(p); }
    const c = document.createElement('canvas'); c.width = 256; c.height = 32;
    const g = c.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(12.8, 1.4, 0.3), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) })); banner.position.y = 6; arch.add(banner);
    for (const cz of CHECKPOINTS.slice(1)) for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), mat('#ffffff')); pole.position.set(s * 5.6, 1.2, cz); scene.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), mat('#3ddc84')); flag.position.set(s * 5.6 + 0.4, 2.1, cz); scene.add(flag);
    }
  }
  function floorAt(x, z) {
    for (const f of floors) if (x > f.x0 + f.dx - R * 0.6 && x < f.x1 + f.dx + R * 0.6 && z > f.z0 - R * 0.6 && z < f.z1 + R * 0.6) return f;
    return null;
  }

  // ---------- Runners ----------
  function nameTag(text, mine) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 34px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = '#1b1530'; g.strokeText(text, 128, 34);
    g.fillStyle = mine ? '#ffd23f' : '#ffffff'; g.fillText(text, 128, 34);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    s.scale.set(2.4, 0.6, 1); s.position.y = 2.5; s.renderOrder = 3; return s;
  }
  function makeRunners() {
    for (const r of runners) { scene.remove(r.rig.root); scene.remove(r.shadow); }
    runners = [];
    const names = [...NAMES].sort(() => Math.random() - 0.5);
    for (let k = 0; k < RUNNERS; k++) {
      const mine = k === 0;
      let rig;
      try { rig = buildAvatar((mine ? myLook() : randomLook()) || DEFAULT_AVATAR); } catch { rig = { root: new THREE.Group(), arms: [], legs: [] }; }
      rig.root.add(nameTag(mine ? (playerName() || 'You') : names[k], mine));
      scene.add(rig.root);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
      const col = k % 4, row = Math.floor(k / 4);
      const start = V(-4.5 + col * 3, 0, -2 + row * 2.2);
      runners.push({
        rig, shadow, mine, name: mine ? 'You' : names[k], pos: start.clone(), vel: V(0, 0, 0), prevY: 0, yaw: Math.PI * 0, walk: 0,
        ground: true, stumble: 0, checkpoint: 0, respawnT: 0, finished: 0,
        // Computer runners: speed, how good they are at timing jumps, and which side they like to run on.
        pace: rand(0.72, 0.92), skill: rand(0.55, 0.95), lane: rand(-3, 3), laneT: rand(1, 4), wait: 0,
      });
    }
    me = runners[0];
  }

  // ---------- Moving obstacles ----------
  function moveObstacles(dt) {
    for (const f of floors) if (f.move) {
      const nx = Math.sin(clock * f.move.speed + f.move.phase) * f.move.amp;
      f.delta = nx - f.dx; f.dx = nx; f.mesh.position.x = (f.x0 + f.x1) / 2 + nx;
    }
    for (const s of sweepers) { s.ang += s.speed * dt; s.mesh.rotation.y = s.ang; }
    for (const h of hammers) {
      const a = Math.sin(clock * 1.5 + h.phase) * 1.15;
      h.vel = (a - h.ang) / Math.max(dt, 0.001); h.ang = a; h.arm.rotation.z = a;
    }
    for (const p of pushers) {
      const e = (Math.sin(clock * 1.9 + p.phase) * 0.5 + 0.5) * 6.2;
      p.vel = (e - p.ext) / Math.max(dt, 0.001); p.ext = e; p.mesh.position.x = p.side * (9 - e);
    }
  }
  // Knock a runner flying (they stumble for a moment and can't steer).
  function knock(r, vx, vy, vz, t = 0.7) { r.vel.set(vx, vy, vz); r.ground = false; r.stumble = t; }
  function hitObstacles(r) {
    for (const s of sweepers) {
      if (r.pos.y > 1.0 || Math.abs(r.pos.z - s.z) > 6) continue;
      // The bar runs from the post out both ways; local direction along it:
      const dx = Math.cos(s.ang), dz = -Math.sin(s.ang);
      const px = r.pos.x, pz = r.pos.z - s.z, along = Math.max(-5.3, Math.min(5.3, px * dx + pz * dz));
      const cx = along * dx, cz = along * dz, d = Math.hypot(px - cx, pz - cz);
      if (d < R + 0.35) {
        const tx = -dz * Math.sign(s.speed) * Math.sign(along || 1), tz = dx * Math.sign(s.speed) * Math.sign(along || 1);
        const power = 7 + Math.abs(s.speed * along) * 0.8;
        knock(r, tx * power, 7.5, tz * power);
      }
    }
    for (const h of hammers) {
      if (Math.abs(r.pos.z - h.z) > 2.2) continue;
      const hx = Math.sin(h.ang) * 6.4, hy = 7.8 - Math.cos(h.ang) * 6.4;
      if (Math.hypot(r.pos.x - hx, (r.pos.y + 0.9) - hy) < 1.6 && Math.abs(r.pos.z - h.z) < 1.3 + R) {
        knock(r, Math.sign(h.vel || 1) * 15, 7, rand(-1, 1), 0.9);
      }
    }
    for (const p of pushers) {
      if (Math.abs(r.pos.z - p.z) > 1.5 + R || r.pos.y > 2.2) continue;
      const face = p.side * (6 - p.ext);
      if ((p.side > 0 && r.pos.x > face - R) || (p.side < 0 && r.pos.x < face + R)) {
        r.pos.x = face - p.side * R;
        if (p.vel > 0) knock(r, -p.side * (8 + p.vel * 0.6), 4, 0, 0.45);
        else r.vel.x = Math.min(Math.abs(r.vel.x), 2) * -p.side;
      }
    }
  }

  // ---------- Computer runners ----------
  function botControl(r, dt) {
    const want = V(0, 0, -1);
    r.laneT -= dt; if (r.laneT < 0) { r.lane = rand(-3.5, 3.5); r.laneT = rand(1.5, 4); }
    let tx = r.lane, jump = false;
    const z = r.pos.z;
    if (z < -76 && z > -110) tx = Math.max(-1, Math.min(1, r.lane * 0.3));              // stay in the middle of the bridge
    // Look ahead: if the floor ends just in front, find where to land and jump when it's there.
    const here = floorAt(r.pos.x, z), ahead = floorAt(r.pos.x, z - 1.2);
    if (here && !ahead) {
      let land = null;
      for (let dz = 2.5; dz <= 5.5 && !land; dz += 0.5) for (const f of floors) if (z - dz > f.z0 && z - dz < f.z1) { land = f; break; }
      if (land) {
        const cx = (land.x0 + land.x1) / 2 + land.dx;
        tx = cx;
        const lined = r.pos.x > land.x0 + land.dx + 0.4 && r.pos.x < land.x1 + land.dx - 0.4;
        if (land.move) { const lead = cx + (land.delta || 0) * 25; if (Math.abs(lead - r.pos.x) < 1.4) jump = true; else want.z = 0; }
        else if (lined) jump = true;
        else { want.z = 0; tx = Math.max(here.x0 + here.dx + 0.5, Math.min(here.x1 + here.dx - 0.5, cx)); }   // stop and line up first
      }
    } else if (here && here.move) tx = (here.x0 + here.x1) / 2 + here.dx;                 // ride the moving platform in its middle
    else if (here && !here.move && here.x1 - here.x0 < 5 && z < -46 && z > -72) tx = (here.x0 + here.x1) / 2;
    // Hop over a sweeper bar coming at you (not always in time!).
    for (const s of sweepers) {
      if (Math.abs(z - s.z) > 6) continue;
      const dx = Math.cos(s.ang), dz = -Math.sin(s.ang), px = r.pos.x, pz = z - s.z;
      const along = px * dx + pz * dz, d = Math.hypot(px - along * dx, pz - along * dz);
      if (d < 1.6 && Math.random() < r.skill * dt * 14) jump = true;
    }
    // Smart runners wait for a hammer to swing past before running under it.
    for (const h of hammers) if (h.z < z && z - h.z < 3.4 && Math.abs(Math.sin(h.ang) * 6.4 - r.pos.x) < 3 && r.skill > 0.65) want.z = 0;
    want.x = Math.max(-1, Math.min(1, (tx - r.pos.x) * 0.6));
    return { want, jump };
  }

  // ---------- Update ----------
  function moveDir() {
    let ix = input.x, iy = input.y;
    if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
    if (keys.w || keys.arrowup) iy += 1; if (keys.s || keys.arrowdown) iy -= 1;
    const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
    return V(ix, 0, -iy);
  }
  function respawn(r) {
    const cz = CHECKPOINTS[r.checkpoint];
    r.pos.set(rand(-2, 2), 0, cz - 1); r.vel.set(0, 0, 0); r.ground = true; r.stumble = 0; r.respawnT = 0;
    if (r.mine) toast('Back to the checkpoint!');
  }
  function update(dt) {
    clock += dt;
    moveObstacles(dt);
    if (state === 'countdown') {
      countdownT -= dt;
      $('tdBig').textContent = countdownT > 0 ? Math.ceil(countdownT) : 'GO!';
      if (countdownT <= 0) { state = 'play'; setTimeout(() => { if (state === 'play') $('tdBig').hidden = true; }, 700); }
      return;
    }
    if (state !== 'play') return;
    raceT += dt;
    for (const r of runners) {
      if (r.finished) { r.vel.set(0, 0, 0); continue; }
      if (r.respawnT > 0) { r.respawnT -= dt; if (r.respawnT <= 0) respawn(r); }
      let want, jump;
      if (r.mine) { want = moveDir(); jump = jumpHeld; }
      else ({ want, jump } = botControl(r, dt));
      r.stumble = Math.max(0, r.stumble - dt);
      const control = r.stumble > 0 ? 0 : r.ground ? 1 : 0.35;
      const speed = r.mine ? RUN : RUN * r.pace;
      r.vel.x += (want.x * speed - r.vel.x) * Math.min(1, dt * 10 * control);
      r.vel.z += (want.z * speed - r.vel.z) * Math.min(1, dt * 10 * control);
      if (jump && r.ground && r.stumble <= 0) { r.vel.y = JUMP; r.ground = false; }
      r.vel.y -= GRAVITY * dt;
      r.prevY = r.pos.y;
      r.pos.addScaledVector(r.vel, dt);
      // Stand on the floor (and ride moving platforms).
      const f = floorAt(r.pos.x, r.pos.z);
      if (f && r.pos.y <= 0 && r.prevY >= -0.4) { r.pos.y = 0; r.vel.y = 0; r.ground = true; if (f.move) r.pos.x += f.delta || 0; }
      else if (!f || r.pos.y > 0.01) r.ground = false;
      hitObstacles(r);
      // Checkpoints, falling off and the finish line.
      while (r.checkpoint + 1 < CHECKPOINTS.length && r.pos.z < CHECKPOINTS[r.checkpoint + 1] && r.ground) {
        r.checkpoint++; if (r.mine) toast('Checkpoint! ✔');
      }
      if (r.pos.y < -14 && r.respawnT <= 0) r.respawnT = 0.6;
      if (r.pos.z < FINISH && r.ground) { r.finished = ++finishers; if (r.mine) finish(); }
    }
    // Runners bump into each other.
    for (let a = 0; a < runners.length; a++) for (let b = a + 1; b < runners.length; b++) {
      const p = runners[a], q = runners[b];
      if (Math.abs(p.pos.y - q.pos.y) > 1.5) continue;
      const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.0001 && d < R * 2) { const push = (R * 2 - d) / 2, nx = dx / d, nz = dz / d; p.pos.x -= nx * push; p.pos.z -= nz * push; q.pos.x += nx * push; q.pos.z += nz * push; }
    }
    $('tdPlace').textContent = ordinal(placeOf(me)) + ' / ' + RUNNERS;
    $('tdTime').textContent = Math.max(0, Math.ceil(TIME_LIMIT - raceT)) + 's';
    if (raceT >= TIME_LIMIT && state === 'play') finish();
  }
  // Finished runners rank by when they finished; everyone else by how far along they are.
  function placeOf(r) {
    if (r.finished) return r.finished;
    return finishers + 1 + runners.filter(q => !q.finished && q !== r && q.pos.z < r.pos.z).length;
  }
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  let toastT = 0;
  function toast(text) { const el = $('tdToast'); el.textContent = text; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1300); }

  // ---------- Drawing ----------
  function draw(t) {
    for (const r of runners) {
      const a = r.rig;
      a.root.position.copy(r.pos);
      const hv = Math.hypot(r.vel.x, r.vel.z);
      if (hv > 0.5 && r.stumble <= 0) r.yaw = Math.atan2(-r.vel.x, -r.vel.z);
      a.root.rotation.set(r.stumble > 0 ? Math.sin(t * 20) * 0.6 : 0, r.yaw + (r.stumble > 0 ? t * 9 : 0), 0);
      r.walk += hv * 0.02;
      if (a.legs.length) {
        const s = r.ground && hv > 0.5 ? Math.sin(r.walk * 6) : 0;
        a.legs[0].rotation.x = r.ground ? s * 0.9 : -0.8; a.legs[1].rotation.x = r.ground ? -s * 0.9 : 0.4;
        a.arms[0].rotation.x = -s * 0.8; a.arms[1].rotation.x = s * 0.8;
        a.arms[0].rotation.z = r.ground ? 0 : -1.5; a.arms[1].rotation.z = r.ground ? 0 : 1.5;
      }
      const f = floorAt(r.pos.x, r.pos.z);
      r.shadow.visible = !!f && r.pos.y > -0.5; r.shadow.position.set(r.pos.x, 0.03, r.pos.z);
    }
    // Camera behind and above you, looking down the course.
    const p = me ? me.pos : V(0, 0, 0);
    const want = V(p.x * 0.6, Math.max(p.y, -2) + 5.5, p.z + 9.5);
    camera.position.lerp(want, 0.15);
    camera.lookAt(p.x * 0.8, Math.max(p.y, -2) + 1, p.z - 5);
    renderer.render(scene, camera);
  }

  // ---------- Screens ----------
  function show(id) {
    for (const p of ['tdMenu', 'tdOver']) $(p).hidden = p !== id;
    const playing = state === 'play' || state === 'countdown';
    $('tdHud').hidden = $('tdPad').hidden = !playing;
    if (!playing) { $('tdBig').hidden = true; $('tdToast').hidden = true; }
  }
  function reset() { clock = 0; raceT = 0; finishers = 0; makeRunners(); }
  function toMenu() { state = 'menu'; reset(); $('tdBest').textContent = best; $('tdBank').textContent = bankNow(); show('tdMenu'); }
  function start() {
    reset(); state = 'countdown'; countdownT = 3; show(null);
    $('tdBig').hidden = false; $('tdBig').textContent = '3';
    camera.position.set(0, 6, 10);
  }
  function finish() {
    state = 'over'; jumpHeld = false;
    const place = me.finished || placeOf(me), done = !!me.finished;
    const score = done ? (RUNNERS + 1 - place) * 10 : 0, coins = done ? RUNNERS + 1 - place : 1;
    addCoins(coins);
    const newBest = score > best; if (newBest) { best = score; store.set('best', best); }
    $('tdOverTitle').textContent = !done ? 'Out of time!' : place === 1 ? 'You won! 👑' : place <= 3 ? 'Great run! 🏅' : 'You made it!';
    $('tdPlaceText').textContent = done ? `You came ${ordinal(place)} out of ${RUNNERS}.` : 'Try to reach the finish line before the time runs out.';
    $('tdOverScore').textContent = score; $('tdOverCoins').textContent = coins; $('tdOverBest').textContent = best;
    $('tdNote').textContent = newBest ? 'New best score!' : `You have ${bankNow()} coins to spend in Dodge and Weave.`;
    $('tdBoardStatus').textContent = score > 0 ? 'Saving your score…' : '';
    show('tdOver');
    if (score > 0) Leaderboard.submit('tumbledash', { name: playerName() || 'Mystery Runner', score }).then(r => {
      $('tdBoardStatus').textContent = r.ok ? (r.improved ? 'Your new best is on the leaderboard!' : `Your best is still ${r.best}.`)
        : r.reason === 'offline' ? '' : r.reason === 'readonly' ? 'You need more access to add scores. Ask the owner to give you access.' : 'Your score couldn’t be saved this time.';
    });
  }
  Leaderboard.watch('tumbledash', 5, rows => {
    const box = $('tdBoard'), list = $('tdBoardList');
    box.hidden = !rows; if (!rows) return;
    list.innerHTML = '';
    if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No scores yet. Be the first!'; list.appendChild(li); return; }
    rows.forEach((row, i) => {
      const li = document.createElement('li'); if (row.me) li.className = 'me';
      for (const [cls, text] of [['rank', i + 1], ['name', row.name || 'Mystery Runner'], ['pts', row.score]]) {
        const span = document.createElement('span'); span.className = cls; span.textContent = text; li.appendChild(span);
      }
      list.appendChild(li);
    });
  });

  // ---------- Input ----------
  // Keys: WASD / arrows to run, Space to jump. Touch: drag on the left to run, JUMP button on the right.
  window.addEventListener('keydown', e => {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); if (state === 'menu' || state === 'over') { if (!e.repeat) start(); } else jumpHeld = true; }
    else if (k === 'enter' && (state === 'menu' || state === 'over')) start();
    else if (/^(w|a|s|d|arrow(up|down|left|right))$/.test(k)) { keys[k] = true; if (state !== 'menu') e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys[k] = false; if (k === ' ') jumpHeld = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; jumpHeld = false; });
  const stick = $('tdStick'), knob = $('tdKnob');
  let touch = null;
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {}
    if (touch) return;
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    stick.hidden = false; stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; knob.style.transform = '';
  });
  canvas.addEventListener('pointermove', e => {
    if (!touch || e.pointerId !== touch.id) return;
    let dx = e.clientX - touch.x, dy = e.clientY - touch.y; const len = Math.hypot(dx, dy), max = 50;
    if (len > max) { dx *= max / len; dy *= max / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.x = dx / max; input.y = -dy / max;
  });
  const lift = e => { if (touch && e.pointerId === touch.id) { touch = null; stick.hidden = true; input.x = input.y = 0; } };
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, lift);
  const jb = $('tdJump');
  jb.addEventListener('pointerdown', e => { e.preventDefault(); try { jb.setPointerCapture(e.pointerId); } catch {} jumpHeld = true; });
  for (const ev of ['pointerup', 'pointercancel']) jb.addEventListener(ev, () => { jumpHeld = false; });
  $('tdPlay').onclick = start;
  $('tdAgain').onclick = start;
  $('tdMenuBtn').onclick = toMenu;
  for (const id of ['tdLobby', 'tdOverLobby']) $(id).onclick = () => window.Lobby && Lobby.show();

  // ---------- Loop ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 75 : 60; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', () => { if (active) resize(); });
  function loop(t) {
    if (!active) return;
    const dt = Math.min((t - last) / 1000, 0.033); last = t;
    update(dt);
    draw(t / 1000);
    requestAnimationFrame(loop);
  }
  function setup() {
    if (renderer) return true;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    buildCourse(); return true;
  }
  window.TumbleDash = {
    open() {
      root.hidden = false; active = true;
      if (!setup()) { $('tdNote').textContent = 'This game needs 3D graphics, which this browser has turned off.'; return; }
      resize(); toMenu(); last = performance.now(); requestAnimationFrame(loop);
    },
    close() { active = false; root.hidden = true; input.x = input.y = 0; jumpHeld = false; for (const k in keys) keys[k] = false; },
    // For tests and demos.
    _step: (dt, n = 1) => { for (let i = 0; i < n; i++) update(dt); },
    _state: () => ({ state, raceT: +raceT.toFixed(1), finishers, place: me && placeOf(me), me: me && me.pos.toArray().map(v => +v.toFixed(1)), bots: runners.slice(1).map(r => +r.pos.z.toFixed(0)), cps: runners.map(r => r.checkpoint).join('') }),
    _input: input,
  };
})();

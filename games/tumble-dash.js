// Tumble Dash: Stumble Guys-style party games against 11 computer runners. Each time you play, a
// wheel picks one of four games at random:
//   Obstacle Race - sweepers, stepping stones, hammers, moving platforms and punching walls to the finish
//   Block Dash    - walls of blocks slide at you: find the gap or jump the low blocks
//   Tile Fall     - three floors of hexagon tiles that drop away once someone steps on them
//   Spin Zone     - spinning bars on a round platform that get faster and faster
// Loaded by index.html after rail-rush.js: everyone is a Dodge and Weave character (buildAvatar)
// and coins go into the same bank.
(() => {
  const root = document.getElementById('tumbledash');
  const canvas = document.getElementById('tdCanvas');
  const $ = id => document.getElementById(id);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const RUNNERS = 12, R = 0.45, RUN = 8.5, JUMP = 11.5, GRAVITY = 30;
  const NAMES = ['Bubbles', 'Zoom', 'Pixel', 'Mango', 'Turbo', 'Luna', 'Ziggy', 'Coco', 'Rocket', 'Sunny', 'Biscuit', 'Nova', 'Pickles', 'Jazz', 'Taco', 'Blaze'];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('tumbledash.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('tumbledash.' + k, JSON.stringify(v)); } catch {} },
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];

  let renderer, scene, camera, level, runners = [], me = null, mode = null, lastMode = null;
  let active = false, state = 'menu', last = 0, clock = 0, raceT = 0, stateT = 0, finishers = 0, outs = 0, best = store.get('best', 0);
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

  // ---------- The world shared by every game ----------
  // Floors: boxes { x0, x1, z0, z1, top } or hexagons/circles { hx, hz, hr, top }. Moving ones carry
  // `dx`/`delta`. Sweepers: bars spinning round a point near the floor (jump them). Everything a game
  // builds goes in `level`, which is emptied before the next game.
  let floors = [], sweepers = [], hammers = [], pushers = [];
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  function buildWorld() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#8fd8ff');
    scene.fog = new THREE.Fog('#8fd8ff', 60, 160);
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    scene.add(new THREE.HemisphereLight('#ffffff', '#7a8fb0', 0.95));
    const sun = new THREE.DirectionalLight('#ffffff', 0.55); sun.position.set(10, 30, 10); scene.add(sun);
    const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    for (let i = 0; i < 45; i++) {
      const g = new THREE.Group(), side = Math.random() < 0.5 ? -1 : 1;
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(rand(2, 3.5), 10, 8), cloudMat); b.position.set(k * 2.4, rand(-0.5, 0.8), rand(-1, 1)); g.add(b); }
      g.position.set(side * rand(16, 55), rand(-40, -6), rand(-230, 40)); scene.add(g);
    }
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat('#4fb3e8')); sea.rotation.x = -Math.PI / 2; sea.position.y = -45; scene.add(sea);
    level = new THREE.Group(); scene.add(level);
  }
  function clearLevel() {
    scene.remove(level); level = new THREE.Group(); scene.add(level);
    floors = []; sweepers = []; hammers = []; pushers = [];
  }
  function boxFloor(x0, x1, zFar, zNear, color, top = 0, move) {
    const f = { x0, x1, z0: zFar, z1: zNear, top, move, dx: 0, delta: 0 };
    const w = x1 - x0, d = zNear - zFar;
    f.mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), mat(color));
    f.mesh.position.set((x0 + x1) / 2, top - 0.6, (zFar + zNear) / 2); level.add(f.mesh);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), mat('#ffffff'));
    trim.position.y = 0.42; f.mesh.add(trim);                                                  // a white band round the sides
    floors.push(f); return f;
  }
  function sweeper(cx, cz, len, speed, color = '#ff4f5e') {
    const g = new THREE.Group(); g.position.set(cx, 0, cz); level.add(g);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.6, 16), mat('#ffd23f')); post.position.y = 0.8; g.add(post);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, len * 2, 12), mat(color)); bar.rotation.z = Math.PI / 2; bar.position.y = 0.55; g.add(bar);
    for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), mat('#ffffff')); cap.position.set(s * len, 0.55, 0); g.add(cap); }
    const sw = { cx, cz, len, speed, ang: Math.random() * 6, mesh: g };
    sweepers.push(sw); return sw;
  }
  // The highest floor under a spot that's no higher than the runner's feet.
  function floorUnder(x, z, y) {
    let found = null;
    for (const f of floors) {
      if (f.gone || f.top > y + 0.05) continue;
      const inside = f.hr ? Math.hypot(x - f.hx, z - f.hz) < f.hr : x > f.x0 + f.dx - R * 0.6 && x < f.x1 + f.dx + R * 0.6 && z > f.z0 - R * 0.6 && z < f.z1 + R * 0.6;
      if (inside && (!found || f.top > found.top)) found = f;
    }
    return found;
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
      runners.push({
        rig, shadow, mine, name: mine ? 'You' : names[k], pos: V(0, 0, 0), vel: V(0, 0, 0), prevY: 0, yaw: 0, walk: 0,
        ground: true, floor: null, stumble: 0, checkpoint: 0, respawnT: 0, finished: 0, out: 0,
        // Computer runners: speed, how good they are at timing jumps, and where they like to be.
        pace: rand(0.72, 0.92), skill: rand(0.55, 0.95), lane: rand(-3, 3), laneT: rand(1, 4), target: null,
      });
    }
    me = runners[0];
  }
  function placeRunners(spots) {
    runners.forEach((r, k) => {
      const [x, y, z] = spots(k);
      r.pos.set(x, y, z); r.vel.set(0, 0, 0); r.ground = true; r.stumble = 0; r.checkpoint = 0; r.respawnT = 0; r.finished = 0; r.out = 0; r.yaw = 0; r.target = null;
      r.rig.root.visible = true;
    });
  }
  // Knock a runner flying (they stumble for a moment and can't steer).
  function knock(r, vx, vy, vz, t = 0.7) { r.vel.set(vx, vy, vz); r.ground = false; r.stumble = t; }
  function hitSweepers(r) {
    for (const s of sweepers) {
      if (r.pos.y > 1.0 || r.pos.y < -0.5 || Math.hypot(r.pos.x - s.cx, r.pos.z - s.cz) > s.len + 1) continue;
      const dx = Math.cos(s.ang), dz = -Math.sin(s.ang);
      const px = r.pos.x - s.cx, pz = r.pos.z - s.cz, along = Math.max(-s.len, Math.min(s.len, px * dx + pz * dz));
      if (Math.hypot(px - along * dx, pz - along * dz) < R + 0.35) {
        const sg = Math.sign(s.speed) * Math.sign(along || 1), power = 7 + Math.abs(s.speed * along) * 0.8;
        knock(r, -dz * sg * power, 7.5, dx * sg * power);
      }
    }
  }
  // Bots hop a sweeper bar that's about to reach them (not always in time!).
  function dodgeSweepers(r, dt) {
    for (const s of sweepers) {
      const px = r.pos.x - s.cx, pz = r.pos.z - s.cz;
      if (Math.hypot(px, pz) > s.len + 1) continue;
      const dx = Math.cos(s.ang), dz = -Math.sin(s.ang), along = px * dx + pz * dz;
      if (Math.hypot(px - along * dx, pz - along * dz) < 1.6 && Math.random() < r.skill * dt * 14) return true;
    }
    return false;
  }

  // ======================= The four games =======================
  const MODES = {};

  // ---------- 1. Obstacle Race ----------
  MODES.race = {
    name: 'Obstacle Race', emoji: '🏁', tip: 'Race to the finish line! Fall off and you go back to the last green flag.',
    race: true, time: 150, FINISH: -196, CHECKPOINTS: [0, -44, -72, -112, -150],
    build() {
      boxFloor(-6, 6, -14, 4, '#ffd23f');
      boxFloor(-6, 6, -44, -14, '#7ad36b');
      sweeper(0, -22, 5.3, 1.7); sweeper(0, -36, 5.3, -2.2);
      let z = -44;
      for (const x of [-1.5, 1.2, -1.2, 1.5, 0]) { z -= 5.2; boxFloor(x - 1.9, x + 1.9, z - 1.9, z + 1.9, '#ff9be0'); }
      boxFloor(-6, 6, -76, -70, '#7ad36b');
      boxFloor(-2, 2, -110, -76, '#a98bff');
      for (const [hz, ph] of [[-82, 0], [-92, 2.1], [-102, 4.2]]) {
        const g = new THREE.Group(); g.position.set(0, 0, hz); level.add(g);
        for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), mat('#6a6f80')); post.position.set(s * 4.5, 4, 0); g.add(post); }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.5, 0.5), mat('#6a6f80')); beam.position.y = 8; g.add(beam);
        const arm = new THREE.Group(); arm.position.y = 7.8; g.add(arm);
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), mat('#8b5a2b')); stick.position.y = -3; arm.add(stick);
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 16), mat('#ff4f5e')); head.rotation.x = Math.PI / 2; head.position.y = -6.4; arm.add(head);
        for (const s of [-1, 1]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 16), mat('#ffffff')); band.rotation.x = Math.PI / 2; band.position.set(0, -6.4, s * 0.9); arm.add(band); }
        hammers.push({ z: hz, phase: ph, arm, ang: 0, vel: 0 });
      }
      boxFloor(-6, 6, -116, -110, '#7ad36b');
      z = -116;
      for (const [sp, ph] of [[1.2, 0], [1.6, 2], [1.3, 4]]) { z -= 7; boxFloor(-2, 2, z - 2, z + 2, '#5fd0ff', 0, { amp: 3.2, speed: sp, phase: ph }); }
      boxFloor(-6, 6, -186, -144, '#7ad36b');
      for (const [pz, side, ph] of [[-156, 1, 0], [-162, -1, 1.2], [-168, 1, 2.4], [-174, -1, 3.6], [-180, 1, 0.6]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 3), mat('#ff7bd0')); m.position.set(side * 9, 1.1, pz); level.add(m);
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1.8), mat('#ffd23f')); face.position.x = -side * 3.05; m.add(face);
        pushers.push({ z: pz, side, phase: ph, mesh: m, ext: 0, vel: 0 });
      }
      boxFloor(-6, 6, this.FINISH - 10, -186, '#ffd23f');
      const arch = new THREE.Group(); arch.position.z = this.FINISH; level.add(arch);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), mat('#ff4f5e')); p.position.set(s * 6, 3, 0); arch.add(p); }
      const c = document.createElement('canvas'); c.width = 256; c.height = 32;
      const g = c.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); }
      const banner = new THREE.Mesh(new THREE.BoxGeometry(12.8, 1.4, 0.3), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) })); banner.position.y = 6; arch.add(banner);
      for (const cz of this.CHECKPOINTS.slice(1)) for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), mat('#ffffff')); pole.position.set(s * 5.6, 1.2, cz); level.add(pole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), mat('#3ddc84')); flag.position.set(s * 5.6 + 0.4, 2.1, cz); level.add(flag);
      }
      placeRunners(k => [-4.5 + (k % 4) * 3, 0, -2 + Math.floor(k / 4) * 2.2]);
    },
    tick(dt) {
      for (const h of hammers) { const a = Math.sin(clock * 1.5 + h.phase) * 1.15; h.vel = (a - h.ang) / Math.max(dt, 0.001); h.ang = a; h.arm.rotation.z = a; }
      for (const p of pushers) { const e = (Math.sin(clock * 1.9 + p.phase) * 0.5 + 0.5) * 6.2; p.vel = (e - p.ext) / Math.max(dt, 0.001); p.ext = e; p.mesh.position.x = p.side * (9 - e); }
    },
    hit(r) {
      for (const h of hammers) {
        if (Math.abs(r.pos.z - h.z) > 2.2) continue;
        const hx = Math.sin(h.ang) * 6.4, hy = 7.8 - Math.cos(h.ang) * 6.4;
        if (Math.hypot(r.pos.x - hx, (r.pos.y + 0.9) - hy) < 1.6 && Math.abs(r.pos.z - h.z) < 1.3 + R) knock(r, Math.sign(h.vel || 1) * 15, 7, rand(-1, 1), 0.9);
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
    },
    fellOff(r) {                                                  // back to the last checkpoint
      r.pos.set(rand(-2, 2), 0, this.CHECKPOINTS[r.checkpoint] - 1); r.vel.set(0, 0, 0); r.ground = true; r.stumble = 0;
      if (r.mine) toast('Back to the checkpoint!');
    },
    after(r) {
      while (r.checkpoint + 1 < this.CHECKPOINTS.length && r.pos.z < this.CHECKPOINTS[r.checkpoint + 1] && r.ground) { r.checkpoint++; if (r.mine) toast('Checkpoint! ✔'); }
      if (r.pos.z < this.FINISH && r.ground && !r.finished) { r.finished = ++finishers; if (r.mine) finish(); }
    },
    bot(r, dt) {
      const want = V(0, 0, -1);
      r.laneT -= dt; if (r.laneT < 0) { r.lane = rand(-3.5, 3.5); r.laneT = rand(1.5, 4); }
      let tx = r.lane, jump = false;
      const z = r.pos.z;
      if (z < -76 && z > -110) tx = Math.max(-1, Math.min(1, r.lane * 0.3));            // stay in the middle of the bridge
      // Look ahead: if the floor ends just in front, find where to land and jump when it's there.
      const here = floorUnder(r.pos.x, z, r.pos.y), ahead = floorUnder(r.pos.x, z - 1.2, r.pos.y);
      if (here && !ahead) {
        let land = null;
        for (let dz = 2.5; dz <= 5.5 && !land; dz += 0.5) for (const f of floors) if (!f.hr && z - dz > f.z0 && z - dz < f.z1) { land = f; break; }
        if (land) {
          const cx = (land.x0 + land.x1) / 2 + land.dx;
          tx = cx;
          const lined = r.pos.x > land.x0 + land.dx + 0.4 && r.pos.x < land.x1 + land.dx - 0.4;
          if (land.move) { const lead = cx + (land.delta || 0) * 25; if (Math.abs(lead - r.pos.x) < 1.4) jump = true; else want.z = 0; }
          else if (lined) jump = true;
          else { want.z = 0; tx = Math.max(here.x0 + here.dx + 0.5, Math.min(here.x1 + here.dx - 0.5, cx)); }   // stop and line up first
        }
      } else if (here && here.move) tx = (here.x0 + here.x1) / 2 + here.dx;               // ride the moving platform in its middle
      else if (here && here.x1 - here.x0 < 5 && z < -46 && z > -72) tx = (here.x0 + here.x1) / 2;
      if (dodgeSweepers(r, dt)) jump = true;
      // Smart runners wait for a hammer to swing past before running under it.
      for (const h of hammers) if (h.z < z && z - h.z < 3.4 && Math.abs(Math.sin(h.ang) * 6.4 - r.pos.x) < 3 && r.skill > 0.65) want.z = 0;
      want.x = Math.max(-1, Math.min(1, (tx - r.pos.x) * 0.6));
      return { want, jump };
    },
    camera(p) { return { pos: V(p.x * 0.6, Math.max(p.y, -2) + 5.5, p.z + 9.5), look: V(p.x * 0.8, Math.max(p.y, -2) + 1, p.z - 5) }; },
  };

  // ---------- 2. Block Dash ----------
  // Walls of blocks slide toward you. Each wall has gaps to run through and low blocks to jump;
  // tall blocks shove you along, and if you're shoved off the back of the platform you're out.
  MODES.blocks = {
    name: 'Block Dash', emoji: '🧱', tip: 'Walls are coming! Run through the gaps or jump the low blocks. Don’t get pushed off!',
    time: 50, walls: [], spawnT: 0,
    build() {
      boxFloor(-6, 6, -12, 4, '#7ad36b');
      for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 16), mat('#ffd23f')); rail.position.set(s * 6.25, 0.3, -4); level.add(rail); }
      this.walls = []; this.spawnT = 1.5;
      placeRunners(k => [-4.5 + (k % 4) * 3, 0, -1 + Math.floor(k / 4) * 1.8]);
    },
    speed: () => 5 + raceT * 0.09,
    spawn() {
      // 6 lanes, each a gap (0), a low block (1, jump it) or a tall block (2).
      const lanes = [2, 2, 2, 2, 2, 2];
      const gaps = raceT > 25 ? 1 : 2;
      for (let k = 0; k < gaps; k++) lanes[Math.floor(Math.random() * 6)] = 0;
      for (let k = 0; k < 2; k++) { const i = Math.floor(Math.random() * 6); if (lanes[i] === 2) lanes[i] = 1; }
      const g = new THREE.Group(); g.position.z = -14; level.add(g);
      const color = pick(['#ff4f5e', '#ff9be0', '#a98bff', '#5fd0ff', '#ffb347', '#ff7bd0']);
      lanes.forEach((t, i) => {
        if (!t) return;
        const h = t === 1 ? 0.9 : 2.6;
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.94, h, 1), mat(t === 1 ? '#ffd23f' : color)); b.position.set(-5 + i * 2, h / 2, 0); g.add(b);
      });
      this.walls.push({ z: -14, lanes, mesh: g });
    },
    tick(dt) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawn(); this.spawnT = Math.max(1.7, 3.2 - raceT * 0.035); }
      const sp = this.speed();
      for (const w of this.walls) { w.z += sp * dt; w.mesh.position.z = w.z; }
      this.walls = this.walls.filter(w => { if (w.z > 10) { level.remove(w.mesh); return false; } return true; });
    },
    hit(r) {
      const sp = this.speed();
      for (const w of this.walls) {
        if (Math.abs(r.pos.z - w.z) > 0.5 + R) continue;
        const lane = Math.max(0, Math.min(5, Math.round((r.pos.x + 5) / 2))), t = w.lanes[lane];
        const h = t === 1 ? 0.9 : t === 2 ? 2.6 : 0;
        if (t && r.pos.y < h - 0.05) { r.pos.z = w.z + 0.5 + R; if (r.vel.z < sp) r.vel.z = sp; }
      }
    },
    bot(r, dt) {
      const want = V(0, 0, 0);
      let jump = false, wall = null;
      for (const w of this.walls) if (w.z < r.pos.z + 0.3 && (!wall || w.z > wall.z)) wall = w;
      let tx = r.lane;
      if (wall) {
        // Head for the nearest gap (or a low block to jump), then jump the low block when it arrives.
        // They only spot it once the wall is close, and sometimes pick the wrong lane.
        if (r.target !== wall && wall.z > r.pos.z - 7 - r.skill * 4) {
          let bestLane = 0, bestD = Infinity;
          wall.lanes.forEach((t, i) => { if (t === 2) return; const d = Math.abs(-5 + i * 2 - r.pos.x) + (t === 1 ? 1.5 : 0); if (d < bestD) { bestD = d; bestLane = i; } });
          if (Math.random() > r.skill) bestLane = Math.floor(Math.random() * 6);
          r.target = wall; r.goLane = bestLane;
        }
        if (r.target === wall) tx = -5 + r.goLane * 2;
        const lane = Math.max(0, Math.min(5, Math.round((r.pos.x + 5) / 2)));
        if (wall.lanes[lane] === 1 && r.pos.z - wall.z < 1.6 && Math.random() < r.skill * dt * 20) jump = true;
      }
      want.x = Math.max(-1, Math.min(1, (tx - r.pos.x) * 0.8));
      want.z = Math.max(-1, Math.min(1, (-3 + r.lane * 0.4 - r.pos.z) * 0.4));      // stay near the front
      return { want, jump };
    },
    camera(p) { return { pos: V(p.x * 0.4, 8, p.z + 10), look: V(p.x * 0.4, 0, p.z - 4) }; },
  };

  // ---------- 3. Tile Fall ----------
  // Three floors of hexagon tiles, one under the other. A tile flashes and drops away a moment after
  // anyone steps on it. Fall through all three and you're out.
  MODES.tiles = {
    name: 'Tile Fall', emoji: '⬡', tip: 'Tiles drop away after you step on them. Keep moving and don’t fall to the bottom!',
    time: 60, killY: -32, LAYERS: [0, -10, -20], COLORS: ['#ff9be0', '#5fd0ff', '#ffd23f'],
    build() {
      const size = 1.3, geo = new THREE.CylinderGeometry(1.24, 1.24, 0.6, 6);
      this.LAYERS.forEach((top, li) => {
        for (let q = -6; q <= 6; q++) for (let rr = -6; rr <= 6; rr++) {
          if (Math.abs(q + rr) > 6) continue;
          const hx = size * Math.sqrt(3) * (q + rr / 2), hz = size * 1.5 * rr;
          const m = new THREE.Mesh(geo, mat(this.COLORS[li])); m.rotation.y = Math.PI / 6; m.position.set(hx, top - 0.3, hz); level.add(m);
          floors.push({ hx, hz, hr: 1.32, top, mesh: m, base: this.COLORS[li], t: -1, vy: 0 });   // reaches the corners, so there are no holes between tiles
        }
      });
      placeRunners(k => { const a = k / RUNNERS * Math.PI * 2; return [Math.cos(a) * 7, 0, Math.sin(a) * 7]; });
    },
    tick(dt) {
      for (const f of floors) {
        if (f.gone || f.t < 0) continue;
        f.t += dt;
        f.mesh.material.color.set(Math.floor(f.t * 14) % 2 ? '#ffffff' : f.base);              // flash before falling
        f.mesh.position.x = f.hx + Math.sin(f.t * 60) * 0.06;
        if (f.t > 1.1) { f.gone = true; f.vy = 0; }
      }
      for (const f of floors) if (f.gone && f.mesh.visible) { f.vy -= 30 * dt; f.mesh.position.y += f.vy * dt; if (f.mesh.position.y < f.top - 30) f.mesh.visible = false; }
    },
    after(r) { if (r.ground && r.floor && r.floor.hr && r.floor.t < 0) r.floor.t = 0; },        // stepping on a tile starts it falling
    bot(r, dt) {
      // Keep moving toward a solid tile nearby on the same floor that nobody has stepped on yet.
      const t = r.target;
      if (!t || t.gone || t.t >= 0 || Math.hypot(t.hx - r.pos.x, t.hz - r.pos.z) < 0.5 || Math.abs(t.top - r.pos.y) > 1) {
        const y = r.floor ? r.floor.top : r.pos.y;
        const options = floors.filter(f => !f.gone && f.t < 0 && Math.abs(f.top - y) < 1 && Math.hypot(f.hx - r.pos.x, f.hz - r.pos.z) < 4);
        // Careful runners pick a close tile; others wander further (and break more tiles).
        options.sort((a, b) => Math.hypot(a.hx - r.pos.x, a.hz - r.pos.z) - Math.hypot(b.hx - r.pos.x, b.hz - r.pos.z));
        r.target = options.length ? options[Math.min(options.length - 1, Math.floor(Math.random() * (r.skill > 0.75 ? 3 : 8)))] : null;
      }
      const want = V(0, 0, 0);
      if (r.target) { want.set(r.target.hx - r.pos.x, 0, r.target.hz - r.pos.z); const l = want.length(); if (l > 0.01) want.divideScalar(l).multiplyScalar(0.4); }
      return { want, jump: false };
    },
    camera(p) { return { pos: V(p.x * 0.5, p.y + 13, p.z + 10), look: V(p.x * 0.7, p.y, p.z - 1) }; },
  };

  // ---------- 4. Spin Zone ----------
  // A round platform with spinning bars that keep speeding up. A second bar joins later.
  MODES.spin = {
    name: 'Spin Zone', emoji: '🌀', tip: 'Jump the spinning bars! They get faster and faster. Don’t get knocked off!',
    time: 50, killY: -12,
    build() {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1.2, 40), mat('#a98bff')); m.position.y = -0.6; level.add(m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.12, 6, 48), mat('#ffffff')); ring.rotation.x = Math.PI / 2; ring.position.y = -0.1; level.add(ring);
      for (let i = 0; i < 8; i++) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 17), mat('#c4adff')); stripe.rotation.y = i * Math.PI / 8; stripe.position.y = 0.01; level.add(stripe); }
      floors.push({ hx: 0, hz: 0, hr: 9, top: 0 });
      this.bars = [sweeper(0, 0, 9, 0.7)];
      this.second = false;
      placeRunners(k => { const a = k / RUNNERS * Math.PI * 2; return [Math.cos(a) * 5.5, 0, Math.sin(a) * 5.5]; });
    },
    tick() {
      if (!this.second && raceT > 15) { this.second = true; this.bars.push(sweeper(0, 0, 9, -0.9, '#3ddc84')); toast('A second bar!'); }
      this.bars[0].speed = 0.7 + raceT * 0.03;
      if (this.bars[1]) this.bars[1].speed = -(0.6 + (raceT - 15) * 0.025);
    },
    bot(r, dt) {
      if (!r.target || Math.hypot(r.target.x - r.pos.x, r.target.z - r.pos.z) < 0.6) { const a = rand(0, 7), d = rand(1.5, 5.5); r.target = { x: Math.cos(a) * d, z: Math.sin(a) * d }; }
      const want = V(r.target.x - r.pos.x, 0, r.target.z - r.pos.z); const l = want.length(); if (l > 0.01) want.divideScalar(l).multiplyScalar(0.6);
      return { want, jump: dodgeSweepers(r, dt) };
    },
    camera(p) { return { pos: V(p.x * 0.5, 15, p.z * 0.5 + 13), look: V(p.x * 0.6, 0, p.z * 0.6) }; },
  };

  // ======================= Running a game =======================
  function moveDir() {
    let ix = input.x, iy = input.y;
    if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
    if (keys.w || keys.arrowup) iy += 1; if (keys.s || keys.arrowdown) iy -= 1;
    const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
    return V(ix, 0, -iy);
  }
  const alive = () => runners.filter(r => !r.out);
  function update(dt) {
    clock += dt;
    if (state === 'wheel') return wheelTick(dt);
    if (!mode) return;
    for (const f of floors) if (f.move) { const nx = Math.sin(clock * f.move.speed + f.move.phase) * f.move.amp; f.delta = nx - f.dx; f.dx = nx; f.mesh.position.x = (f.x0 + f.x1) / 2 + nx; }
    for (const s of sweepers) { s.ang += s.speed * dt; s.mesh.rotation.y = s.ang; }
    if (state === 'countdown') {
      stateT -= dt;
      $('tdBig').textContent = stateT > 0 ? Math.ceil(stateT) : 'GO!';
      if (stateT <= 0) { state = 'play'; setTimeout(() => { if (state === 'play') $('tdBig').hidden = true; }, 700); }
      return;
    }
    if (state !== 'play') return;
    raceT += dt;
    if (mode.tick) mode.tick(dt);
    for (const r of runners) {
      if (r.finished || r.out) { r.vel.set(0, 0, 0); continue; }
      if (r.respawnT > 0) { r.respawnT -= dt; if (r.respawnT <= 0) mode.fellOff(r); continue; }
      let want, jump;
      if (r.mine) { want = moveDir(); jump = jumpHeld; }
      else ({ want, jump } = mode.bot(r, dt));
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
      const f = floorUnder(r.pos.x, r.pos.z, r.prevY);
      if (f && r.pos.y <= f.top && r.prevY >= f.top - 0.4) { r.pos.y = f.top; r.vel.y = 0; r.ground = true; r.floor = f; if (f.move) r.pos.x += f.delta || 0; }
      else { r.ground = false; r.floor = null; }
      hitSweepers(r);
      if (mode.hit) mode.hit(r);
      if (mode.after) mode.after(r);
      if (state !== 'play') return;
      // Fall too far: back to a checkpoint in the race, out of the game in the others.
      if (r.pos.y < (mode.killY || -14)) {
        if (mode.race) r.respawnT = 0.6;
        else { r.out = ++outs; r.rig.root.visible = false; if (r.mine) { finish(); return; } toast(r.name + ' is out!'); }
      }
    }
    // Runners bump into each other.
    for (let a = 0; a < runners.length; a++) for (let b = a + 1; b < runners.length; b++) {
      const p = runners[a], q = runners[b];
      if (p.out || q.out || Math.abs(p.pos.y - q.pos.y) > 1.5) continue;
      const dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.0001 && d < R * 2) { const push = (R * 2 - d) / 2, nx = dx / d, nz = dz / d; p.pos.x -= nx * push; p.pos.z -= nz * push; q.pos.x += nx * push; q.pos.z += nz * push; }
    }
    $('tdPlace').textContent = mode.race ? ordinal(placeOf(me)) + ' / ' + RUNNERS : alive().length + ' left';
    $('tdTime').textContent = Math.max(0, Math.ceil(mode.time - raceT)) + 's';
    if (raceT >= mode.time || (!mode.race && alive().length === 1)) finish();
  }
  // Race: finished runners rank by when they finished, the rest by how far along they are.
  // Survival games: everyone still in shares 1st; the rest rank by how long they lasted.
  function placeOf(r) {
    if (!mode.race) return r.out ? RUNNERS - r.out + 1 : 1;
    if (r.finished) return r.finished;
    return finishers + 1 + runners.filter(q => !q.finished && q !== r && q.pos.z < r.pos.z).length;
  }
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  let toastT = 0;
  function toast(text) { const el = $('tdToast'); el.textContent = text; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1300); }

  // ---------- The game wheel ----------
  // The names light up one after another, slowing down, until it stops on a random game.
  let wheel = null;
  function spinWheel() {
    const list_ = Object.keys(MODES), choice = pick(list_.filter(k => k !== lastMode));
    const list = $('tdWheelList'); list.innerHTML = '';
    for (const k of list_) { const li = document.createElement('li'); li.dataset.mode = k; li.innerHTML = `<b>${MODES[k].emoji}</b><span>${MODES[k].name}</span>`; list.appendChild(li); }
    const steps = list_.length * 2 + list_.indexOf(choice) + 1;     // two full laps, then land on the choice
    wheel = { list: list_, choice, step: 0, steps, t: 0, gap: 0.07, done: 0 };
    $('tdWheel').hidden = false; $('tdWheelTip').textContent = '';
    state = 'wheel';
  }
  function wheelTick(dt) {
    const w = wheel; w.t += dt;
    if (w.step < w.steps) {
      if (w.t >= w.gap) {
        w.t = 0; w.step++; w.gap *= 1.12;
        const on = w.list[(w.step - 1) % w.list.length];
        for (const li of $('tdWheelList').children) li.classList.toggle('on', li.dataset.mode === on);
      }
    } else {
      if (!w.done) { w.done = 1; $('tdWheelTip').textContent = MODES[w.choice].tip; }
      if (w.t > 1.8) { $('tdWheel').hidden = true; beginMode(w.choice); }
    }
  }
  function beginMode(key) {
    lastMode = key; mode = MODES[key];
    clearLevel(); raceT = 0; finishers = 0; outs = 0;
    mode.build();
    state = 'countdown'; stateT = 3;
    $('tdMode').textContent = mode.emoji + ' ' + mode.name;
    $('tdHud').hidden = $('tdPad').hidden = false;
    $('tdBig').hidden = false; $('tdBig').textContent = '3';
    camera.position.copy(mode.camera(me.pos).pos);
  }

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
      const f = !r.out && a.root.visible && floorUnder(r.pos.x, r.pos.z, r.pos.y + 0.05);
      r.shadow.visible = !!f && r.pos.y - f.top < 8; if (f) r.shadow.position.set(r.pos.x, f.top + 0.03, r.pos.z);
    }
    if (mode && me) {
      const c = mode.camera(me.pos);
      camera.position.lerp(c.pos, 0.15); camera.lookAt(c.look);
    } else { camera.position.set(Math.sin(t * 0.2) * 30, 18, 30); camera.lookAt(0, -5, -20); }
    renderer.render(scene, camera);
  }

  // ---------- Screens ----------
  function show(id) {
    for (const p of ['tdMenu', 'tdOver']) $(p).hidden = p !== id;
    const playing = state === 'play' || state === 'countdown';
    $('tdHud').hidden = $('tdPad').hidden = !playing;
    if (!playing) { $('tdBig').hidden = true; $('tdToast').hidden = true; $('tdWheel').hidden = true; }
  }
  function toMenu() {
    state = 'menu'; mode = null; clearLevel(); makeRunners();
    for (const r of runners) { r.rig.root.visible = false; r.shadow.visible = false; }
    $('tdBest').textContent = best; $('tdBank').textContent = bankNow(); show('tdMenu');
  }
  function start() {
    mode = null; clearLevel(); makeRunners();
    for (const r of runners) r.rig.root.visible = false;
    state = 'wheel'; show(null); spinWheel();
  }
  function finish() {
    state = 'over'; jumpHeld = false;
    const place = placeOf(me), done = mode.race ? !!me.finished : !me.out;
    let score, coins, title, text;
    if (mode.race) {
      score = done ? (RUNNERS + 1 - place) * 10 : 0; coins = done ? RUNNERS + 1 - place : 1;
      title = !done ? 'Out of time!' : place === 1 ? 'You won! 👑' : place <= 3 ? 'Great run! 🏅' : 'You made it!';
      text = done ? `You came ${ordinal(place)} out of ${RUNNERS}.` : 'Try to reach the finish line before the time runs out.';
    } else {
      const left = alive().length;
      score = done ? 100 + outs * 5 : (RUNNERS - place) * 8; coins = Math.max(1, Math.round(score / 10));
      title = done ? (left === 1 ? 'Last one standing! 👑' : 'You survived! 🏆') : 'You’re out!';
      text = done ? (left === 1 ? 'Everyone else got knocked out.' : `You and ${left - 1} others made it to the end.`) : `You came ${ordinal(place)} out of ${RUNNERS}.`;
    }
    if (mode.race ? done && place === 1 : done) Celebrate.win();      // 1st in the race, or still in at the end
    addCoins(coins);
    const newBest = score > best; if (newBest) { best = score; store.set('best', best); }
    $('tdOverTitle').textContent = title;
    $('tdPlaceText').textContent = `${mode.emoji} ${mode.name}: ${text}`;
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
  // Keys: WASD / arrows to run, Space to jump. Touch: drag on the screen to run, JUMP button on the right.
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
    buildWorld(); return true;
  }
  window.TumbleDash = {
    open() {
      root.hidden = false; active = true;
      if (!setup()) { $('tdNote').textContent = 'This game needs 3D graphics, which this browser has turned off.'; return; }
      resize(); toMenu(); last = performance.now(); requestAnimationFrame(loop);
    },
    close() { active = false; root.hidden = true; input.x = input.y = 0; jumpHeld = false; for (const k in keys) keys[k] = false; },
    // For tests and demos.
    _step: (dt, n = 1) => { for (let i = 0; i < n && state !== 'over'; i++) update(dt); },
    _play: key => { start(); $('tdWheel').hidden = true; beginMode(key); },
    _state: () => ({ state, mode: mode && mode.name, raceT: +raceT.toFixed(1), finishers, outs, left: alive().length, place: me && mode && placeOf(me), me: me && me.pos.toArray().map(v => +v.toFixed(1)) }),
    _input: input, _me: () => me, _ys: () => runners.slice(1).map(r => r.out ? 'X' : r.pos.y.toFixed(0) + (r.ground ? 'g' : 'a')).join(' '), _gone: () => floors.filter(f => f.gone).length + '/' + floors.length,
  };
})();

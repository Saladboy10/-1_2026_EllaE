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
  const rand = (a, b) => a + Math.random() * (b - a);
  const COLORS = ['#f2a65a', '#9bc1bc', '#ed6a5a', '#c9b6e4', '#8fb8de', '#e4d6a7', '#7fb685', '#6f86c6'];
  function windowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#3b3f5c'; for (const x of [8, 36]) for (const y of [10, 40]) g.fillRect(x, y, 20, 16);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function buildCity() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#8fd3ff');
    scene.fog = new THREE.Fog('#8fd3ff', 60, 190);
    camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight('#ffffff', '#5a6680', 0.85));
    const sun = new THREE.DirectionalLight('#ffffff', 0.7); sun.position.set(40, 80, 25); scene.add(sun);

    const street = new THREE.Mesh(new THREE.PlaneGeometry(GRID * CELL + 200, GRID * CELL + 200), new THREE.MeshLambertMaterial({ color: '#55596b' }));
    street.rotation.x = -Math.PI / 2; scene.add(street);
    const walk = new THREE.MeshLambertMaterial({ color: '#b9b4a8' });
    const tex = windowTexture(), roofMat = new THREE.MeshLambertMaterial({ color: '#4a4560' });
    const wallMats = COLORS.map(c => new THREE.MeshLambertMaterial({ color: c, map: tex }));
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
      const cx = -HALF + i * CELL + CELL / 2, cz = -HALF + j * CELL + CELL / 2;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(BLOCK + 3, 0.3, BLOCK + 3), walk); pad.position.set(cx, 0.15, cz); scene.add(pad);
      // Mostly one big tower per block, sometimes two shorter ones side by side.
      const parts = Math.random() < 0.3 ? [[-BLOCK / 4, BLOCK / 2 - 1], [BLOCK / 4, BLOCK / 2 - 1]] : [[0, BLOCK]];
      const centre = Math.hypot(cx, cz) < CELL * 1.5;
      for (const [off, w] of parts) {
        const h = centre ? rand(16, 24) : rand(14, 52), d = parts.length > 1 ? BLOCK : w;
        const geo = new THREE.BoxGeometry(w, h, d);
        // Stretch the window pattern so every floor has the same size windows.
        const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) {
          const face = Math.floor(k / 4), across = face < 2 ? d : w;
          uv.setXY(k, uv.getX(k) * across / 4, uv.getY(k) * h / 4);
        }
        const m = new THREE.Mesh(geo, [wallMats[(i * 7 + j * 3 + (off > 0)) % wallMats.length], null, roofMat, roofMat, null, null]);
        m.material[1] = m.material[4] = m.material[5] = m.material[0];
        const x = cx + off, z = cz;
        m.position.set(x, h / 2, z); scene.add(m);
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat); ledge.position.set(x, h, z); scene.add(ledge);
        buildings.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, top: h + 0.25 });
      }
    }

    const glow = new THREE.MeshLambertMaterial({ color: '#ffcf1a', emissive: '#7a5400' });
    const coinGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.18, 18); coinGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 40; i++) { const c = new THREE.Mesh(coinGeo, glow); scene.add(c); coins.push(c); placeCoin(c, true); }

    webLine = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    webLine.geometry.translate(0, 0.5, 0); webLine.geometry.rotateX(Math.PI / 2); webLine.visible = false; scene.add(webLine);
    reticle = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.85 }));
    reticle.renderOrder = 5; reticle.visible = false; scene.add(reticle);
  }
  // Coins float in the air over the streets (swing to get them) or sit on rooftops.
  function placeCoin(c, anywhere) {
    const near = anywhere ? HALF : 70;
    for (let tries = 0; tries < 30; tries++) {
      const x = (anywhere ? 0 : P.pos.x) + rand(-near, near), z = (anywhere ? 0 : P.pos.z) + rand(-near, near);
      if (Math.abs(x) > HALF - 5 || Math.abs(z) > HALF - 5) continue;
      const b = buildingAt(x, z, 1);
      if (b) { if (Math.random() < 0.5) continue; c.position.set(x, b.top + 1.4, z); }
      else c.position.set(x, rand(6, 30), z);
      c.userData.spin = Math.random() * 6; return;
    }
    c.position.set(rand(-20, 20), 10, rand(-20, 20));
  }
  function buildingAt(x, z, pad = 0) {
    for (const b of buildings) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return b;
    return null;
  }
  // Spider Pig, the hero you start as: a round pink pig on four trotters, in the same toon style
  // as the Dodge and Weave characters. Front legs act as arms (one grabs the web), back legs as legs.
  function buildSpiderPig() {
    const PINK = '#f590b4', DARK = '#c45b82', HOOF = '#5a3a3a';
    roundK = 0.8;
    try {
      const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      ball(0.5, PINK, 0, 0.78, 0.05, body, 1, 0.85, 1.35);                                    // round belly
      const head = new THREE.Group(); head.position.set(0, 1.0, -0.62); body.add(head);
      ball(0.4, PINK, 0, 0, 0, head);
      const snout = tube(0.17, 0.19, 0.16, PINK, 0, -0.07, -0.4, head); snout.rotation.x = Math.PI / 2;
      ball(0.17, DARK, 0, -0.07, -0.48, head, 1, 0.85, 0.12).userData.noLine = true;           // nose disc
      for (const s of [-1, 1]) {
        ball(0.04, HOOF, s * 0.065, -0.07, -0.5, head, 1, 1.3, 0.5).userData.noLine = true;      // nostrils
        ball(0.075, '#ffffff', s * 0.15, 0.13, -0.33, head);                                     // eyes
        ball(0.045, '#1b1530', s * 0.15, 0.13, -0.395, head).userData.noLine = true;
        ball(0.015, '#ffffff', s * 0.15 + 0.02, 0.15, -0.44, head).userData.noLine = true;
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 12), mat(PINK));
        ear.position.set(s * 0.24, 0.33, -0.02); ear.rotation.set(-0.35, 0, -s * 0.5); head.add(ear);
      }
      ball(0.06, DARK, 0.14, -0.21, -0.33, head, 1.6, 0.6, 0.5).userData.noLine = true;           // a happy little smile
      const tail = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 16, Math.PI * 1.6), mat(PINK));
      tail.position.set(0, 0.95, 0.72); tail.rotation.y = Math.PI / 2; body.add(tail);
      const arms = [], legs = [];
      for (const [list, z] of [[arms, -0.38], [legs, 0.45]]) for (const s of [-1, 1]) {
        const hip = new THREE.Group(); hip.position.set(s * 0.26, 0.46, z); body.add(hip);
        limb(0.12, 0.1, 0.05, -0.36, PINK, hip);
        ball(0.1, HOOF, 0, -0.4, 0, hip, 1, 0.75, 1.1);
        list.push(hip);
      }
      root.scale.setScalar(1.35);
      addOutlines(root);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25 }));
      shadow.rotation.x = -Math.PI / 2;
      return { root, body, arms, legs, head, shadow, pig: true };
    } finally { roundK = 0; }
  }
  let heroPick = store.get('hero', 'pig');
  const heroLabel = () => 'Hero: ' + (heroPick === 'pig' ? 'Spider Pig 🐷' : 'My runner');
  function makeHero() {
    if (hero) { scene.remove(hero.root); scene.remove(hero.shadow); }
    try { hero = heroPick === 'pig' ? buildSpiderPig() : buildAvatar(avatarCfg); } catch { hero = null; return; }
    scene.add(hero.root); scene.add(hero.shadow);
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
      const p = V(Math.max(b.x0, Math.min(b.x1, want.x)), Math.min(b.top - 0.6, want.y), Math.max(b.z0, Math.min(b.z1, want.z)));
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
      if (P.pos.x < b.x0 - R || P.pos.x > b.x1 + R || P.pos.z < b.z0 - R || P.pos.z > b.z1 + R) continue;
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
    let ground = 0.32; const b = buildingAt(P.pos.x, P.pos.z); if (b && b.top <= P.pos.y + 0.1) ground = b.top + 0.02;
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
      const b = buildingAt(p.x, p.z, 0.6);
      if (b && p.y < b.top + 0.6) { want.copy(p).sub(step); break; }
    }
    camera.position.lerp(want, state === 'play' ? Math.min(1, dt * 8) : 1);
    camera.lookAt(target);

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
    draw(t / 1000, dt);
    requestAnimationFrame(loop);
  }
  function setup() {
    if (renderer) return true;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

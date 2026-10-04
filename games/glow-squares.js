// Glow Squares: you and 11 computer players stand on a floor of squares. Each round some squares
// glow; when the countdown hits zero the dark squares drop away and anyone not on a glowing square
// falls out. Normally 2 fit on a square; every 2 or 3 rounds is a special round where the number changes
// (1, 3 or 4). The squares show it, and the last to arrive on a full square falls too.
// There's always one spot too few, players bump each other, and the last one standing wins.
// Loaded by index.html after rail-rush.js: everyone is a Dodge and Weave character (buildAvatar),
// you wear your own look, and coins go into the same bank.
(() => {
  const root = document.getElementById('glowsquares');
  const canvas = document.getElementById('gsCanvas');
  const $ = id => document.getElementById(id);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const N = 8, TILE = 2.6, HALF = N * TILE / 2, PLAYERS = 12, R = 0.42, MAX_ROUNDS = 15;
  const SPEED = 6.2, GRAVITY = 30;
  const NAMES = ['Bubbles', 'Zoom', 'Pixel', 'Mango', 'Turbo', 'Luna', 'Ziggy', 'Coco', 'Rocket', 'Sunny', 'Biscuit', 'Nova', 'Pickles', 'Jazz', 'Taco', 'Blaze'];
  const GLOWS = ['#39f5ff', '#ff4fd8', '#7dff4f', '#ffd23f', '#a46bff', '#ff8a3d'];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('glowsquares.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('glowsquares.' + k, JSON.stringify(v)); } catch {} },
  };

  let renderer, scene, camera, tiles = [], people = [], me = null;
  let active = false, state = 'menu', last = 0, best = store.get('best', 0);
  // Round phases: 'rest' (squares all normal) -> 'glow' (countdown) -> 'drop' (dark squares fall) -> 'rest'...
  let phase = 'rest', phaseT = 0, round = 0, glowColor = GLOWS[0], survived = 0, clock = 0, roundCap = 2, nextSpecial = 2;
  const input = { x: 0, y: 0 }, keys = {};

  // ---------- Shared with Dodge and Weave ----------
  let bank_ = null;
  const bankNow = () => { try { return bank; } catch { if (bank_ != null) return bank_; try { return JSON.parse(localStorage.getItem('railrush.bank')) || 0; } catch { return 0; } } };
  function addCoins(n) {
    try { bank += n; } catch { bank_ = (bankNow() || 0) + n; }
    try { localStorage.setItem('railrush.bank', JSON.stringify(bankNow())); } catch {}
  }
  const playerName = () => { try { return runnerName; } catch { try { return JSON.parse(localStorage.getItem('railrush.name')) || ''; } catch { return ''; } } };
  const myLook = () => { try { return { ...avatarCfg, pet: 'none' }; } catch { return null; } };
  // A random look for a computer player: sometimes one of the shop outfits, otherwise random clothes.
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

  // ---------- Scene ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  function setup() {
    if (renderer) return true;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#140b2e');
    scene.fog = new THREE.Fog('#140b2e', 40, 90);
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight('#c9c2ff', '#2a1850', 0.9));
    const sun = new THREE.DirectionalLight('#ffffff', 0.6); sun.position.set(8, 20, 10); scene.add(sun);

    // Twinkling stars far below and around, so the floor looks like it floats in space.
    const STAR_COLS = ['#ffffff', '#ffe9a8', '#c9b8ff', '#9ff3ff', '#ffb8ec'];
    const stars = sparkleCloud(400, (i, pos, col, size, phase) => {
      pos.push(rand(-80, 80), rand(-45, 12), rand(-80, 35));
      const c = new THREE.Color(STAR_COLS[i % STAR_COLS.length]); col.push(c.r, c.g, c.b);
      size.push(rand(0.6, 2.2)); phase.push(rand(0, 7));
    });
    scene.add(stars.points);
    // Sparkles that fly up off the glowing squares, trail behind you and burst when someone falls.
    sparks = sparkleCloud(SPARKS, (i, pos, col, size, phase) => { pos.push(0, -999, 0); col.push(1, 1, 1); size.push(0); phase.push(rand(0, 7)); });
    sparks.life = new Float32Array(SPARKS); sparks.max = new Float32Array(SPARKS); sparks.base = new Float32Array(SPARKS);
    sparks.vel = new Float32Array(SPARKS * 3); sparks.next = 0;
    scene.add(sparks.points);

    const geo = new THREE.BoxGeometry(TILE - 0.12, 0.5, TILE - 0.12);
    const edge = new THREE.EdgesGeometry(geo);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#3a3358', roughness: 0.5, metalness: 0.2, emissive: '#000000' }));
      const x = -HALF + TILE / 2 + i * TILE, z = -HALF + TILE / 2 + j * TILE;
      m.position.set(x, -0.25, z); scene.add(m);
      const line = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color: '#6c5fb0' })); m.add(line);
      tiles.push({ i, j, x, z, mesh: m, line, glow: false, y: -0.25, vy: 0 });
    }
    return true;
  }
  // The "people on it / how many fit" sign that floats over a glowing square.
  function countTag() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    s.userData.canvas = c; s.scale.set(1.5, 0.75, 1); s.position.y = 0.9; s.renderOrder = 2; return s;
  }
  function paintTag(s, text) {
    const c = s.userData.canvas, g = c.getContext('2d'), [n, cap] = text.split('/').map(Number);
    g.clearRect(0, 0, 128, 64);
    g.font = 'bold 44px Bungee, Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#140b2e'; g.strokeText(text, 64, 34);
    g.fillStyle = n >= cap ? '#ff5b5b' : '#ffffff'; g.fillText(text, 64, 34);
    s.material.map.needsUpdate = true;
  }
  // ---------- Sparkles ----------
  // A soft four-pointed twinkle, drawn once and used for every sparkle and star.
  let sparkTex = null, sparks = null;
  const SPARKS = 500, sparkMats = [];
  function sparkleTexture() {
    if (sparkTex) return sparkTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.18, 'rgba(255,255,255,.8)'); grad.addColorStop(0.45, 'rgba(255,255,255,.12)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(255,255,255,.95)';
    for (const [w, h] of [[3, 30], [30, 3]]) { g.beginPath(); g.ellipse(32, 32, w, h, 0, 0, 7); g.fill(); }
    return sparkTex = new THREE.CanvasTexture(c);
  }
  // Points that each twinkle on their own beat (size and brightness pulse with `phase`).
  function sparkleCloud(n, fill) {
    const pos = [], col = [], size = [], phase = [];
    for (let i = 0; i < n; i++) fill(i, pos, col, size, phase);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute('phase', new THREE.Float32BufferAttribute(phase, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: sparkleTexture() }, time: { value: 0 }, scale: { value: 400 } },
      vertexShader: `attribute float size; attribute float phase; attribute vec3 color; uniform float time; uniform float scale;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float tw = 0.55 + 0.45 * sin(time * 4.0 + phase);
          gl_PointSize = size * tw * scale / -mv.z; vColor = color; vAlpha = tw;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
        void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor, t.a * vAlpha); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    sparkMats.push(m);
    const points = new THREE.Points(g, m); points.frustumCulled = false;
    return { points, pos: g.attributes.position, col: g.attributes.color, size: g.attributes.size };
  }
  function spark(x, y, z, color, vx, vy, vz, life, size) {
    const s = sparks, i = s.next; s.next = (i + 1) % SPARKS;
    s.pos.setXYZ(i, x, y, z); const c = new THREE.Color(color); s.col.setXYZ(i, c.r, c.g, c.b);
    s.vel[i * 3] = vx; s.vel[i * 3 + 1] = vy; s.vel[i * 3 + 2] = vz;
    s.life[i] = s.max[i] = life; s.base[i] = size;
  }
  function burst(x, y, z, colors, n, power = 4) {
    for (let k = 0; k < n; k++) {
      const a = rand(0, 7), u = rand(-1, 1), r = Math.sqrt(1 - u * u), sp = rand(power * 0.4, power);
      spark(x, y, z, colors[k % colors.length], Math.cos(a) * r * sp, Math.abs(u) * sp + 1.5, Math.sin(a) * r * sp, rand(0.7, 1.4), rand(0.35, 0.7));
    }
  }
  function updateSparks(dt, t) {
    if (!sparks) return;
    for (const m of sparkMats) m.uniforms.time.value = t;
    // Glowing squares fizz with rising sparkles; you leave a glittery trail when you run.
    if (phase === 'glow') for (const tile of tiles) if (tile.glow && Math.random() < dt * 9) {
      spark(tile.x + rand(-1.2, 1.2), 0.1, tile.z + rand(-1.2, 1.2), Math.random() < 0.5 ? glowColor : '#ffffff', rand(-0.2, 0.2), rand(1.2, 2.6), rand(-0.2, 0.2), rand(0.8, 1.5), rand(0.45, 0.8));
    }
    if (me && me.alive && Math.hypot(me.vel.x, me.vel.z) > 1 && Math.random() < dt * 22) {
      spark(me.pos.x + rand(-0.3, 0.3), 0.15, me.pos.z + rand(-0.3, 0.3), Math.random() < 0.5 ? '#ffd23f' : '#ffffff', rand(-0.3, 0.3), rand(0.5, 1.2), rand(-0.3, 0.3), rand(0.4, 0.8), rand(0.3, 0.5));
    }
    const s = sparks;
    for (let i = 0; i < SPARKS; i++) {
      if (s.life[i] <= 0) { if (s.size.getX(i)) s.size.setX(i, 0); continue; }
      s.life[i] -= dt;
      s.vel[i * 3 + 1] -= 1.2 * dt;
      s.pos.setXYZ(i, s.pos.getX(i) + s.vel[i * 3] * dt, s.pos.getY(i) + s.vel[i * 3 + 1] * dt, s.pos.getZ(i) + s.vel[i * 3 + 2] * dt);
      s.size.setX(i, s.base[i] * Math.max(0, s.life[i] / s.max[i]) * 4);
    }
    s.pos.needsUpdate = s.col.needsUpdate = s.size.needsUpdate = true;
  }
  // A name tag that floats over a player's head.
  function nameTag(text, mine) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 34px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = '#140b2e'; g.strokeText(text, 128, 34);
    g.fillStyle = mine ? '#ffd23f' : '#ffffff'; g.fillText(text, 128, 34);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    s.scale.set(2.6, 0.65, 1); s.position.y = 2.55; s.renderOrder = 3; return s;
  }
  function makePeople() {
    for (const p of people) scene.remove(p.rig.root);
    people = [];
    const names = [...NAMES].sort(() => Math.random() - 0.5);
    for (let k = 0; k < PLAYERS; k++) {
      const mine = k === 0, look = mine ? myLook() : randomLook();
      let rig;
      try { rig = buildAvatar(look || DEFAULT_AVATAR); } catch { rig = { root: new THREE.Group(), arms: [], legs: [] }; }
      rig.root.add(nameTag(mine ? (playerName() || 'You') : names[k], mine));
      scene.add(rig.root);
      const a = (k / PLAYERS) * Math.PI * 2;
      people.push({
        rig, mine, name: mine ? 'You' : names[k], alive: true, falling: false,
        pos: V(Math.cos(a) * 5, 0, Math.sin(a) * 5), vel: V(0, 0, 0), yaw: 0, walk: Math.random() * 6,
        // Computer players: how fast they react and run, and how often they mess up.
        speed: rand(4.0, 5.6), react: rand(0.3, 1.2), goof: rand(0.1, 0.3), target: null, think: 0,
      });
    }
    me = people[0];
  }

  // ---------- Rounds ----------
  const alive = () => people.filter(p => p.alive);
  const tileAt = (x, z) => {
    const i = Math.floor((x + HALF) / TILE), j = Math.floor((z + HALF) / TILE);
    return i >= 0 && j >= 0 && i < N && j < N ? tiles[i * N + j] : null;
  };
  // How many fit on one square, and how many squares glow: always fewer spots than players.
  const capacity = () => roundCap;
  // How many fit on a square this round: 2, except every 2 or 3 rounds (you never know which) is special: 1, 3 or 4.
  let isSpecial = false;
  const special = () => isSpecial;
  function pickCapacity() {
    const n = alive().length;
    if (n <= 2) return 1;
    if (!special()) return 2;
    const choices = [1, 3, 4].filter(c => c < n);
    return choices[Math.floor(Math.random() * choices.length)];
  }
  const glowCount = () => Math.max(1, Math.floor((alive().length - 1) / capacity()));
  const onTile = t => people.filter(q => q.alive && q.tile === t);
  const countdown = () => Math.max(2, 4.5 - round * 0.25);
  function startGlow() {
    round++; phase = 'glow'; phaseT = countdown();
    isSpecial = round === nextSpecial; if (isSpecial) nextSpecial = round + 2 + Math.floor(Math.random() * 2);
    roundCap = pickCapacity();
    glowColor = GLOWS[round % GLOWS.length];
    const pool = [...tiles].sort(() => Math.random() - 0.5).slice(0, glowCount());
    for (const t of pool) t.glow = true;
    for (const p of people) if (!p.mine) { p.target = null; p.think = p.react * rand(0.7, 1.3); p.recheck = 0; }
    $('gsRound').textContent = 'Round ' + round;
    $('gsBanner').textContent = special() && roundCap !== 2 ? `⭐ Special round! ${roundCap} per square ⭐` : `${roundCap} per square`;
    $('gsBanner').classList.toggle('special', special() && roundCap !== 2);
  }
  function drop() {
    phase = 'drop'; phaseT = 1.6;
    for (const t of tiles) if (!t.glow) t.vy = -0.01;            // the dark squares start to fall
    const fall = p => { p.alive = false; p.falling = true; p.vel.set(p.vel.x * 0.3, 2, p.vel.z * 0.3); burst(p.pos.x, 1, p.pos.z, [glowColor, '#ffffff', '#ffd23f'], 26); };
    const cap = capacity();
    for (const t of tiles) if (t.glow) onTile(t).sort((a, b) => a.enterT - b.enterT).slice(cap).forEach(fall);   // too many: last to arrive falls
    for (const p of alive()) if (!p.tile || !p.tile.glow) fall(p);
    if (me.alive) survived = round;
  }
  function rest() {
    phase = 'rest'; phaseT = 1.4;
    for (const t of tiles) { t.glow = false; t.vy = 0; }
    const left = alive();
    if (!me.alive) return finish(false);
    if (left.length === 1 || round >= MAX_ROUNDS) return finish(true);
  }

  // ---------- Update ----------
  function moveDir() {
    let ix = input.x, iy = input.y;
    if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
    if (keys.w || keys.arrowup) iy += 1; if (keys.s || keys.arrowdown) iy -= 1;
    const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
    return V(ix, 0, -iy);                                    // up on the screen is away from the camera
  }
  function botThink(p, dt) {
    if (phase === 'glow') {
      if (p.think > 0) { p.think -= dt; return V(0, 0, 0); }      // still reacting to the squares lighting up
      p.recheck -= dt;
      const full = p.target && p.target.glow && p.tile !== p.target && onTile(p.target).length >= capacity();
      if (!p.target || full || (!p.target.glow && p.recheck <= 0)) {
        // Head for the nearest glowing square (sometimes the wrong one, or one that's already crowded).
        const goof = !p.target && Math.random() < p.goof;
        if (goof) p.target = tiles[Math.floor(Math.random() * tiles.length)];
        else {
          let bestT = null, bestD = Infinity;
          for (const t of tiles) {
            if (!t.glow) continue;
            const crowd = onTile(t).filter(q => q !== p).length;
            const d = Math.hypot(t.x - p.pos.x, t.z - p.pos.z) + (crowd >= capacity() ? 30 : crowd * rand(1, 4));
            if (d < bestD) { bestD = d; bestT = t; }
          }
          p.target = bestT;
        }
        p.spot = { x: p.target.x + rand(-0.6, 0.6), z: p.target.z + rand(-0.6, 0.6) };
        p.recheck = 0.9;                                          // a goof notices their mistake after a moment
      }
    } else if (phase === 'rest' && (!p.spot || Math.random() < dt * 0.4)) {
      p.spot = { x: rand(-HALF + 1, HALF - 1), z: rand(-HALF + 1, HALF - 1) };
    } else if (phase === 'drop') return V(0, 0, 0);
    if (!p.spot) return V(0, 0, 0);
    const d = V(p.spot.x - p.pos.x, 0, p.spot.z - p.pos.z), len = d.length();
    if (len < 0.15) return V(0, 0, 0);
    return d.divideScalar(Math.max(len, 1)).multiplyScalar(phase === 'rest' ? 0.45 : 1);
  }
  function update(dt) {
    if (state !== 'play') return;
    phaseT -= dt;
    if (phase === 'rest' && phaseT <= 0) startGlow();
    else if (phase === 'glow' && phaseT <= 0) drop();
    else if (phase === 'drop' && phaseT <= 0) rest();
    if (state !== 'play') return;

    for (const p of people) {
      if (p.falling) { p.vel.y -= GRAVITY * dt; p.pos.addScaledVector(p.vel, dt); continue; }
      if (!p.alive) continue;
      const want = p.mine ? moveDir().multiplyScalar(SPEED) : botThink(p, dt).multiplyScalar(p.speed);
      p.vel.x += (want.x - p.vel.x) * Math.min(1, dt * 12); p.vel.z += (want.z - p.vel.z) * Math.min(1, dt * 12);
      p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
      // The edge of the floor: you can't walk off it by accident.
      p.pos.x = Math.max(-HALF + R, Math.min(HALF - R, p.pos.x)); p.pos.z = Math.max(-HALF + R, Math.min(HALF - R, p.pos.z));
    }
    // Bumping: players push each other apart (and can shove someone off a square!).
    const live = alive();
    clock += dt;
    for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
      const p = live[a], q = live[b], dx = q.pos.x - p.pos.x, dz = q.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.0001 && d < R * 2) {
        const push = (R * 2 - d) / 2, nx = dx / d, nz = dz / d;
        p.pos.x -= nx * push; p.pos.z -= nz * push; q.pos.x += nx * push; q.pos.z += nz * push;
      }
    }
    // Remember when each player stepped onto their square: on a full square, the latecomer falls.
    for (const p of live) { const t = tileAt(p.pos.x, p.pos.z); if (t !== p.tile) { p.tile = t; p.enterT = clock; } }
    for (const t of tiles) {
      if (t.vy) { t.vy -= GRAVITY * 0.5 * dt; t.y += t.vy * dt; }
      else if (t.y < -0.25) t.y = Math.min(-0.25, t.y + 36 * dt);   // squares rise back up between rounds
    }
    $('gsLeft').textContent = live.length + ' left';
    const big = $('gsCount');
    big.hidden = $('gsBanner').hidden = phase !== 'glow';
    if (phase === 'glow') { big.textContent = Math.ceil(phaseT); big.style.color = glowColor; }
  }

  // ---------- Drawing ----------
  function draw(t) {
    updateSparks(Math.min(0.05, t - (draw.last || t)), t); draw.last = t;
    const pulse = 0.6 + Math.sin(t * 8) * 0.25, col = new THREE.Color(glowColor);
    for (const tile of tiles) {
      const m = tile.mesh.material;
      if (tile.glow && phase === 'glow' && onTile(tile).length >= capacity()) { m.color.set('#ffffff'); m.emissive.set('#9a9aa8'); tile.line.material.color.set(glowColor); }   // full!
      else if (tile.glow) { m.color.copy(col); m.emissive.copy(col).multiplyScalar(pulse); tile.line.material.color.set('#ffffff'); }
      else { m.color.set('#3a3358'); m.emissive.set('#000000'); tile.line.material.color.set('#6c5fb0'); }
      tile.mesh.position.y = tile.y; tile.mesh.visible = tile.y > -40;
      // How many are on each glowing square, out of how many fit: "1/3".
      const showTag = tile.glow && phase === 'glow';
      if (showTag) {
        const text = onTile(tile).length + '/' + roundCap;
        if (!tile.tag) { tile.tag = countTag(); tile.mesh.add(tile.tag); }
        if (tile.tagText !== text) { tile.tagText = text; paintTag(tile.tag, text); }
      }
      if (tile.tag) tile.tag.visible = showTag;
    }
    for (const p of people) {
      const a = p.rig;
      a.root.position.copy(p.pos); a.root.visible = p.pos.y > -40;
      const hv = Math.hypot(p.vel.x, p.vel.z);
      if (hv > 0.3 && !p.falling) p.yaw = Math.atan2(-p.vel.x, -p.vel.z);
      a.root.rotation.set(p.falling ? Math.min(1.2, -p.pos.y * 0.2) : 0, p.yaw, 0);
      p.walk += hv * 0.04;
      const s = hv > 0.3 && !p.falling ? Math.sin(p.walk * 2.2) : 0;
      if (a.legs.length) {
        a.legs[0].rotation.x = s * 0.8; a.legs[1].rotation.x = -s * 0.8;
        a.arms[0].rotation.x = -s * 0.7; a.arms[1].rotation.x = s * 0.7;
        a.arms[0].rotation.z = p.falling ? -2.6 : 0; a.arms[1].rotation.z = p.falling ? 2.6 : 0;   // arms flail as they fall
      }
    }
    // The camera watches the whole floor from above, leaning toward you a little.
    // Zoomed in: the camera follows you, but stays far enough back to see the squares around you.
    const fx = me ? me.pos.x * 0.7 : 0, fz = me ? me.pos.z * 0.7 : 0;
    camera.position.set(fx, 15, 10 + fz); camera.lookAt(fx, 0, fz + 0.4);
    renderer.render(scene, camera);
  }

  // ---------- Screens ----------
  function show(id) {
    for (const p of ['gsMenu', 'gsOver']) $(p).hidden = p !== id;
    $('gsHud').hidden = state !== 'play'; if (state !== 'play') $('gsCount').hidden = $('gsBanner').hidden = true;
  }
  function reset() {
    for (const t of tiles) { t.glow = false; t.y = -0.25; t.vy = 0; }
    makePeople(); round = 0; survived = 0; phase = 'rest'; phaseT = 2; clock = 0; nextSpecial = 2; isSpecial = false;
  }
  function toMenu() { state = 'menu'; reset(); $('gsBest').textContent = best; $('gsBank').textContent = bankNow(); show('gsMenu'); }
  function start() { reset(); state = 'play'; show(null); $('gsRound').textContent = 'Get ready!'; }
  function finish(won) {
    state = 'over';
    if (won) for (let k = 0; k < 6; k++) burst(me.pos.x + rand(-2, 2), 1.5, me.pos.z + rand(-2, 2), GLOWS, 30, 7);   // confetti sparkles!
    const left = alive().length, place = won ? 1 : left + 1;
    const score = survived * 10 + (won ? 50 : 0), coins = survived + (won ? 10 : 0);
    addCoins(coins);
    const newBest = score > best; if (newBest) { best = score; store.set('best', best); }
    $('gsOverTitle').textContent = won ? (left > 1 ? 'You survived! 🏆' : 'You win! 🏆') : 'You fell!';
    $('gsPlace').textContent = won ? (left > 1 ? `You lasted all ${MAX_ROUNDS} rounds!` : 'Last one standing!') : `You came ${ordinal(place)} out of ${PLAYERS}.`;
    $('gsOverScore').textContent = score; $('gsOverCoins').textContent = coins; $('gsOverBest').textContent = best;
    $('gsNote').textContent = newBest ? 'New best score!' : `You have ${bankNow()} coins to spend in Dodge and Weave.`;
    $('gsBoardStatus').textContent = score > 0 ? 'Saving your score…' : '';
    show('gsOver');
    if (score > 0) Leaderboard.submit('glowsquares', { name: playerName() || 'Mystery Player', score }).then(r => {
      $('gsBoardStatus').textContent = r.ok ? (r.improved ? 'Your new best is on the leaderboard!' : `Your best is still ${r.best}.`)
        : r.reason === 'offline' ? '' : r.reason === 'readonly' ? 'You need more access to add scores. Ask the owner to give you access.' : 'Your score couldn’t be saved this time.';
    });
  }
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  Leaderboard.watch('glowsquares', 5, rows => {
    const box = $('gsBoard'), list = $('gsBoardList');
    box.hidden = !rows; if (!rows) return;
    list.innerHTML = '';
    if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No scores yet. Be the first!'; list.appendChild(li); return; }
    rows.forEach((row, i) => {
      const li = document.createElement('li'); if (row.me) li.className = 'me';
      for (const [cls, text] of [['rank', i + 1], ['name', row.name || 'Mystery Player'], ['pts', row.score]]) {
        const span = document.createElement('span'); span.className = cls; span.textContent = text; li.appendChild(span);
      }
      list.appendChild(li);
    });
  });

  // ---------- Input ----------
  // Keys: WASD or arrows. Touch: drag anywhere and a joystick appears under your finger.
  window.addEventListener('keydown', e => {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (/^(w|a|s|d|arrow(up|down|left|right))$/.test(k)) { keys[k] = true; if (state === 'play') e.preventDefault(); }
    else if ((k === 'enter' || k === ' ') && state !== 'play') { e.preventDefault(); start(); }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  const stick = $('gsStick'), knob = $('gsKnob');
  let touch = null;
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {}
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
  $('gsPlay').onclick = start;
  $('gsAgain').onclick = start;
  $('gsMenuBtn').onclick = toMenu;
  for (const id of ['gsLobby', 'gsOverLobby']) $(id).onclick = () => window.Lobby && Lobby.show();

  // ---------- Loop ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 72 : 50;                     // see the whole floor on a tall phone screen
    camera.updateProjectionMatrix();
    for (const m of sparkMats) m.uniforms.scale.value = h * renderer.getPixelRatio() * 0.6;
  }
  window.addEventListener('resize', () => { if (active) resize(); });
  function loop(t) {
    if (!active) return;
    const dt = Math.min((t - last) / 1000, 0.033); last = t;
    update(dt);
    draw(t / 1000);
    requestAnimationFrame(loop);
  }
  window.GlowSquares = {
    open() {
      root.hidden = false; active = true;
      if (!setup()) { $('gsNote').textContent = 'This game needs 3D graphics, which this browser has turned off.'; return; }
      resize(); toMenu(); last = performance.now(); requestAnimationFrame(loop);
    },
    close() { active = false; root.hidden = true; input.x = input.y = 0; for (const k in keys) keys[k] = false; },
    // For tests and demos.
    _step: (dt, n = 1) => { for (let i = 0; i < n; i++) { if (phase === "glow") GlowSquares._toGlow(); update(dt); } },
    _state: () => ({ state, phase, round, cap: roundCap, left: alive().length, meAlive: me && me.alive, survived, glowing: tiles.filter(t => t.glow).length, pos: me && me.pos.toArray().map(v => +v.toFixed(2)) }),
    _toGlow: () => { if (me.tile && me.tile.glow) return; const t = tiles.filter(t => t.glow).sort((a, b) => onTile(a).length - onTile(b).length)[0]; if (t && me) { me.pos.x = t.x; me.pos.z = t.z; } },
  };
})();

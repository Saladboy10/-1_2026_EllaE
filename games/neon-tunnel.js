// Twist (files and storage say "neon tunnel"): fly down a glowing eight-sided tunnel in the dark, like Tunnel Rush. Walls with gaps
// rush at you; spin the tunnel left and right so your glowing ball (at the bottom of the screen)
// goes through a gap. It speeds up the longer you last, some walls spin, and the colors change.
// Loaded by index.html after rail-rush.js; coins go into the Dodge and Weave bank.
(() => {
  const root = document.getElementById('neontunnel');
  const canvas = document.getElementById('ntCanvas');
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('neontunnel.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('neontunnel.' + k, JSON.stringify(v)); } catch {} },
  };

  const N = 8, R = 6, SECTOR = Math.PI * 2 / N, PLAYER_Z = -4, FAR = -170, RING_GAP = 5, TURN = 5.2;
  const DIFFS = { easy: { name: 'Easy', stars: 1, speed: 0.8 }, med: { name: 'Med', stars: 2, speed: 1 }, hard: { name: 'Hard', stars: 3, speed: 1.3 } };
  const THEMES = [
    { line: '#4ff0ff', wall: '#06222a', block: ['#00e5ff', '#2bff88', '#ffe84f'] },
    { line: '#ff4fd8', wall: '#22062a', block: ['#ff4fd8', '#a46bff', '#ff8a3d'] },
    { line: '#c6ff4f', wall: '#16220a', block: ['#c6ff4f', '#4ff0ff', '#ffffff'] },
    { line: '#ffb03b', wall: '#2a1606', block: ['#ff5b5b', '#ffb03b', '#ffe84f'] },
  ];

  let renderer, scene, camera, tunnel, rings = [], lines, walls, ball, ballGlow, obstacles = [];
  let active = false, state = 'menu', last = 0, t = 0, dist = 0, speed = 0, rot = 0, nextGap = 0, themeIx = 0, flash = 0;
  let diff = store.get('diff', 'med'), best = store.get('best', 0), score = 0;
  const keys = {}, touchDir = { left: false, right: false };

  // ---------- Shared with Dodge and Weave ----------
  let bank_ = null;
  const bankNow = () => { try { return bank; } catch { if (bank_ != null) return bank_; try { return JSON.parse(localStorage.getItem('railrush.bank')) || 0; } catch { return 0; } } };
  function addCoins(n) {
    try { bank += n; } catch { bank_ = (bankNow() || 0) + n; }
    try { localStorage.setItem('railrush.bank', JSON.stringify(bankNow())); } catch {}
  }
  const playerName = () => { try { return runnerName; } catch { try { return JSON.parse(localStorage.getItem('railrush.name')) || ''; } catch { return ''; } } };

  // ---------- The tunnel ----------
  const corner = (i, r = R) => [Math.cos(i * SECTOR + SECTOR / 2) * r, Math.sin(i * SECTOR + SECTOR / 2) * r];
  function buildWorld() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');
    scene.fog = new THREE.Fog('#000000', 30, 160);
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 400);
    tunnel = new THREE.Group(); scene.add(tunnel);
    // Rings: an octagon outline every few steps, which slide toward you to show the speed.
    const ringGeo = new THREE.BufferGeometry(), rp = [];
    for (let i = 0; i < N; i++) { rp.push(...corner(i), 0, ...corner(i + 1), 0); }
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    const ringMat = new THREE.LineBasicMaterial({ color: THEMES[0].line });
    for (let z = 0; z > FAR; z -= RING_GAP) { const r = new THREE.LineSegments(ringGeo, ringMat); r.position.z = z; tunnel.add(r); rings.push(r); }
    // Lines along the corners, and dark panels for the walls.
    const lp = [];
    for (let i = 0; i < N; i++) lp.push(...corner(i), 5, ...corner(i), FAR);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: THEMES[0].line })); tunnel.add(lines);
    const wallGeo = new THREE.CylinderGeometry(R * 1.005, R * 1.005, -FAR + 10, N, 1, true);
    wallGeo.rotateX(Math.PI / 2); wallGeo.rotateZ(SECTOR / 2 - Math.PI / 2 + Math.PI / 2);
    walls = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ color: THEMES[0].wall, side: THREE.BackSide }));
    walls.position.z = FAR / 2; tunnel.add(walls);
    // Your glowing ball, which stays at the bottom of the screen.
    ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    ball.position.set(0, -2.3, PLAYER_Z); scene.add(ball);
    ballGlow = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), new THREE.MeshBasicMaterial({ color: THEMES[0].line, transparent: true, opacity: 0.35 }));
    ball.add(ballGlow);
  }
  // A wall across the tunnel: some of the 8 slices are solid, the rest are gaps.
  function wedgeGeo() {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(...corner(0, R * 1.02)); s.lineTo(...corner(-1, R * 1.02)); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: false }); g.translate(0, 0, -0.35);
    return g;
  }
  let WEDGE = null, WEDGE_EDGES = null;
  function spawn(z) {
    const th = THEMES[themeIx], level = Math.min(1, t / 60);
    // Pick which slices are open: one or two gaps, smaller and spinning more often as you go.
    const open = new Set(), gapSize = Math.random() < 0.55 - level * 0.35 ? 2 : 1, start = Math.floor(Math.random() * N);
    for (let k = 0; k < gapSize; k++) open.add((start + k) % N);
    if (Math.random() < 0.35 - level * 0.2) open.add((start + 4) % N);
    const g = new THREE.Group(); g.position.z = z;
    const color = th.block[Math.floor(Math.random() * th.block.length)];
    const m = new THREE.MeshBasicMaterial({ color }), edge = new THREE.LineBasicMaterial({ color: '#ffffff' });
    const solid = [];
    for (let i = 0; i < N; i++) {
      if (open.has(i)) continue;
      solid.push(i);
      const w = new THREE.Mesh(WEDGE, m); w.rotation.z = i * SECTOR + SECTOR / 2; g.add(w);
      const e = new THREE.LineSegments(WEDGE_EDGES, edge); e.rotation.z = w.rotation.z; g.add(e);
    }
    const spin = Math.random() < 0.15 + level * 0.35 ? (Math.random() < 0.5 ? -1 : 1) * (0.6 + level * 1.2) : 0;
    tunnel.add(g);
    obstacles.push({ g, z, solid: new Set(solid), rot: 0, spin, passed: false });
  }

  // ---------- Update ----------
  const turnInput = () => ((keys.arrowright || keys.d || touchDir.right) ? 1 : 0) - ((keys.arrowleft || keys.a || touchDir.left) ? 1 : 0);
  function update(dt) {
    if (state !== 'play') { rot += dt * 0.3; return; }
    t += dt;
    speed = (32 + Math.min(42, t * 0.9)) * DIFFS[diff].speed;
    dist += speed * dt;
    rot += turnInput() * TURN * dt;
    score = Math.floor(t * 10);
    // Change colors every 20 seconds.
    const ti = Math.floor(t / 20) % THEMES.length;
    if (ti !== themeIx) setTheme(ti);
    for (const o of obstacles) {
      o.z += speed * dt; o.rot += o.spin * dt; o.g.position.z = o.z; o.g.rotation.z = o.rot;
      // Crossing your ball: which slice of this wall is your ball in?
      if (!o.passed && o.z >= PLAYER_Z - 0.35) {
        o.passed = true;
        const phi = -Math.PI / 2 - rot - o.rot;                              // your ball's angle, as seen by the wall
        const hitAt = a => o.solid.has(((Math.floor((a - 0) / SECTOR) % N) + N) % N);
        if (hitAt(phi - 0.09) || hitAt(phi + 0.09)) return crash();
      }
    }
    obstacles = obstacles.filter(o => { if (o.z > 6) { tunnel.remove(o.g); return false; } return true; });
    // A new wall whenever the last one has come far enough; they get closer together over time.
    nextGap -= speed * dt;
    if (nextGap <= 0) { spawn(FAR + 10); nextGap = Math.max(16, 34 - t * 0.25) * (diff === 'hard' ? 0.85 : 1); }
    $('ntScore').textContent = score;
  }
  function setTheme(i) {
    themeIx = i; const th = THEMES[i];
    rings[0].material.color.set(th.line); lines.material.color.set(th.line); walls.material.color.set(th.wall); ballGlow.material.color.set(th.line);
  }

  // ---------- Drawing ----------
  function draw(time) {
    tunnel.rotation.z = rot;
    const off = dist % RING_GAP;
    rings.forEach((r, i) => { r.position.z = -i * RING_GAP + off; });
    ball.scale.setScalar(1 + Math.sin(time * 10) * 0.08);
    camera.position.set(Math.sin(time * 1.3) * 0.15, Math.cos(time * 1.1) * 0.15, 0); camera.lookAt(0, -0.6, -20);
    if (flash > 0) { flash -= 1 / 60; scene.background.setRGB(flash * 0.8, 0, 0); } else scene.background.setRGB(0, 0, 0);
    renderer.render(scene, camera);
  }

  // ---------- Screens ----------
  function show(id) {
    for (const p of ['ntMenu', 'ntOver']) $(p).hidden = p !== id;
    $('ntHud').hidden = state !== 'play';
  }
  function diffLabel() { const d = DIFFS[diff]; $('ntDiff').innerHTML = `<b>${'★'.repeat(d.stars)}${'☆'.repeat(3 - d.stars)}</b><span>${d.name}</span>`; }
  function clear() { for (const o of obstacles) tunnel.remove(o.g); obstacles = []; }
  function toMenu() { state = 'menu'; clear(); $('ntBest').textContent = best; $('ntBank').textContent = bankNow(); diffLabel(); show('ntMenu'); }
  function start() {
    clear(); t = 0; dist = 0; rot = 0; score = 0; nextGap = 0; setTheme(0);
    for (let z = -60; z > FAR; z -= 34) spawn(z);
    nextGap = 34;
    state = 'play'; show(null);
  }
  function crash() {
    state = 'over'; flash = 0.6;
    const coins = Math.floor(score / 40);
    addCoins(coins);
    const newBest = score > best; if (newBest) { best = score; store.set('best', best); }
    $('ntOverScore').textContent = score; $('ntOverCoins').textContent = coins; $('ntOverBest').textContent = best;
    $('ntNote').textContent = (newBest ? 'New best score! ' : '') + `${DIFFS[diff].name} · you lasted ${t.toFixed(1)} seconds.`;
    $('ntBoardStatus').textContent = score > 0 ? 'Saving your score…' : '';
    show('ntOver');
    if (score > 0) Leaderboard.submit('neontunnel', { name: playerName() || 'Mystery Flyer', score }).then(r => {
      $('ntBoardStatus').textContent = r.ok ? (r.improved ? 'Your new best is on the leaderboard!' : `Your best is still ${r.best}.`)
        : r.reason === 'offline' ? '' : r.reason === 'readonly' ? 'You need more access to add scores. Ask the owner to give you access.' : 'Your score couldn’t be saved this time.';
    });
  }
  Leaderboard.watch('neontunnel', 5, rows => {
    const box = $('ntBoard'), list = $('ntBoardList');
    box.hidden = !rows; if (!rows) return;
    list.innerHTML = '';
    if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No scores yet. Be the first!'; list.appendChild(li); return; }
    rows.forEach((row, i) => {
      const li = document.createElement('li'); if (row.me) li.className = 'me';
      for (const [cls, text] of [['rank', i + 1], ['name', row.name || 'Mystery Flyer'], ['pts', row.score]]) {
        const span = document.createElement('span'); span.className = cls; span.textContent = text; li.appendChild(span);
      }
      list.appendChild(li);
    });
  });

  // ---------- Input ----------
  // Keys: ← → or A D. Touch / mouse: hold the left or right half of the screen.
  window.addEventListener('keydown', e => {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (/^(a|d|arrow(left|right))$/.test(k)) { keys[k] = true; if (state === 'play') e.preventDefault(); }
    else if ((k === ' ' || k === 'enter') && state !== 'play') { e.preventDefault(); start(); }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; touchDir.left = touchDir.right = false; });
  const holds = new Map();
  const setTouch = () => { touchDir.left = [...holds.values()].includes('left'); touchDir.right = [...holds.values()].includes('right'); };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {}
    holds.set(e.pointerId, e.clientX < canvas.getBoundingClientRect().width / 2 ? 'left' : 'right'); setTouch();
  });
  canvas.addEventListener('pointermove', e => { if (holds.has(e.pointerId)) { holds.set(e.pointerId, e.clientX < canvas.getBoundingClientRect().width / 2 ? 'left' : 'right'); setTouch(); } });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => { holds.delete(e.pointerId); setTouch(); });
  $('ntPlay').onclick = start;
  $('ntAgain').onclick = start;
  $('ntMenuBtn').onclick = toMenu;
  $('ntDiff').onclick = () => { const order = Object.keys(DIFFS); diff = order[(order.indexOf(diff) + 1) % order.length]; store.set('diff', diff); diffLabel(); };
  for (const id of ['ntLobby', 'ntOverLobby']) $(id).onclick = () => window.Lobby && Lobby.show();

  // ---------- Loop ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 95 : 75; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', () => { if (active) resize(); });
  function loop(time) {
    if (!active) return;
    const dt = Math.min((time - last) / 1000, 0.033); last = time;
    update(dt);
    draw(time / 1000);
    requestAnimationFrame(loop);
  }
  function setup() {
    if (renderer) return true;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    buildWorld();
    WEDGE = wedgeGeo(); WEDGE_EDGES = new THREE.EdgesGeometry(WEDGE);
    return true;
  }
  window.NeonTunnel = {
    open() {
      root.hidden = false; active = true;
      if (!setup()) { $('ntNote').textContent = 'This game needs 3D graphics, which this browser has turned off.'; return; }
      resize(); toMenu(); last = performance.now(); requestAnimationFrame(loop);
    },
    close() { active = false; root.hidden = true; for (const k in keys) keys[k] = false; touchDir.left = touchDir.right = false; },
    // For tests: a pilot that steers toward the open slice of the next wall.
    _autopilot(seconds, skill = 1) {
      for (let s = 0; s < seconds && state === 'play'; s += 1 / 60) {
        const next = obstacles.filter(o => !o.passed).sort((a, b) => b.z - a.z)[0];
        keys.arrowleft = keys.arrowright = false;
        if (next && Math.random() < skill) {
          const phi = -Math.PI / 2 - rot - next.rot;
          let bestD = 99;
          for (let i = 0; i < N; i++) if (!next.solid.has(i)) {
            let d = (i + 0.5) * SECTOR - phi; d = Math.atan2(Math.sin(d), Math.cos(d));
            if (Math.abs(d) < Math.abs(bestD)) bestD = d;
          }
          if (Math.abs(bestD) > 0.05) { if (bestD > 0) keys.arrowleft = true; else keys.arrowright = true; }   // turning right moves your angle backwards
        }
        update(1 / 60);
      }
      keys.arrowleft = keys.arrowright = false;
      return { state, t: +t.toFixed(1), score, speed: +speed.toFixed(1) };
    },
    _start: () => start(),
  };
})();

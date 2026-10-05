// Turbo Track: a 3D car race against 9 computer cars on a twisty, hilly track, like Super Tunnel Rush.
// Your car speeds up by itself; steer to dodge the hexagon barriers and drive over the green arrows
// for a speed boost. Two laps; your place shows big at the top.
// Cars live on the track: each one is a distance along the track and a sideways offset, so they always
// follow the road's hills and curves. Loaded by index.html after rail-rush.js; coins go into the bank.
(() => {
  const root = document.getElementById('turbotrack');
  const canvas = document.getElementById('ttCanvas');
  const $ = id => document.getElementById(id);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('turbotrack.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('turbotrack.' + k, JSON.stringify(v)); } catch {} },
  };
  const rand = (a, b) => a + Math.random() * (b - a);

  const CARS = 10, LAPS = 2, WIDTH = 16, HALF = WIDTH / 2 - 1.2, TOP = 46, ACCEL = 14, STEER = 13, BOOST = 1.45, SAMPLES = 2400;
  const COLORS = ['#e8433a', '#ffd23f', '#3ddc84', '#ff8a3d', '#a46bff', '#ff4fd8', '#ffffff', '#222630', '#4fd2ff'];

  let renderer, scene, camera, frames = [], L = 0, cars = [], me = null, pads = [], blocks = [];
  let active = false, state = 'menu', last = 0, raceT = 0, countT = 0, finishers = 0, best = store.get('best', 0);
  const keys = {}, hold = { left: false, right: false };

  // ---------- Shared with Dodge and Weave ----------
  let bank_ = null;
  const bankNow = () => { try { return bank; } catch { if (bank_ != null) return bank_; try { return JSON.parse(localStorage.getItem('railrush.bank')) || 0; } catch { return 0; } } };
  function addCoins(n) {
    try { bank += n; } catch { bank_ = (bankNow() || 0) + n; }
    try { localStorage.setItem('railrush.bank', JSON.stringify(bankNow())); } catch {}
  }
  const playerName = () => { try { return runnerName; } catch { try { return JSON.parse(localStorage.getItem('railrush.name')) || ''; } catch { return ''; } } };

  // ---------- The track ----------
  // A closed loop through these points, with hills. We sample it once into `frames`
  // (position, forward, right and up at each step) so cars can be placed quickly.
  const POINTS = [[0, 0, 0], [0, 6, -160], [60, 22, -280], [200, 10, -330], [320, 28, -260], [360, 14, -120],
    [300, 2, 10], [200, 16, 90], [80, 4, 120], [10, -2, 80]];
  function buildTrack() {
    const curve = new THREE.CatmullRomCurve3(POINTS.map(p => V(...p)), true, 'centripetal');
    L = curve.getLength();
    frames = [];
    for (let i = 0; i < SAMPLES; i++) {
      const u = i / SAMPLES, pos = curve.getPointAt(u), fwd = curve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, V(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd).normalize();
      frames.push({ pos, fwd, right, up });
    }
    // The road: a ribbon with dashed lines, edged with glowing green blocks.
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#2a3036'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(20, 0, 2, 30); g.fillRect(42, 0, 2, 30);
    g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 3, 64); g.fillRect(61, 0, 3, 64);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const f = frames[i % SAMPLES];
      for (const s of [-1, 1]) { const p = f.pos.clone().addScaledVector(f.right, s * WIDTH / 2); pos.push(p.x, p.y, p.z); uv.push(s < 0 ? 0 : 1, i * L / SAMPLES / 8); }
      if (i < SAMPLES) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })));
    // Underside, so hills look solid from below.
    const under = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#1b2026', side: THREE.BackSide })); under.position.y = -0.4; scene.add(under);
    const step = 5, count = Math.floor(SAMPLES / step) * 2;
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.3, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }), count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(0.9, 1, L / SAMPLES * step * 0.92), col = new THREE.Color();
    let k = 0;
    for (let i = 0; i < SAMPLES; i += step) {
      const f = frames[i];
      q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right, f.up, f.fwd.clone().negate()));
      for (const s of [-1, 1]) {
        m.compose(f.pos.clone().addScaledVector(f.right, s * (WIDTH / 2 + 0.4)).addScaledVector(f.up, 0.6), q, sc);
        wall.setMatrixAt(k, m); wall.setColorAt(k, col.set((i / step) % 2 ? '#2bff5a' : '#7dff9a')); k++;
      }
    }
    scene.add(wall);
    // Start / finish banner.
    const f0 = frames[0], arch = new THREE.Group(); arch.position.copy(f0.pos); arch.lookAt(f0.pos.clone().add(f0.fwd)); scene.add(arch);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), new THREE.MeshLambertMaterial({ color: '#ff4f5e' })); p.position.set(s * (WIDTH / 2 + 1), 4, 0); arch.add(p); }
    const cc = document.createElement('canvas'); cc.width = 256; cc.height = 32; const cg = cc.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { cg.fillStyle = (i + j) % 2 ? '#111' : '#fff'; cg.fillRect(i * 16, j * 16, 16, 16); }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 2.8, 1.6, 0.3), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cc) })); banner.position.y = 8; arch.add(banner);
  }
  // Where a point on the track is: distance along it (wraps round) and sideways offset.
  function frameAt(s) { const i = Math.floor((((s % L) + L) % L) / L * SAMPLES) % SAMPLES; return frames[i]; }
  function placeOnTrack(obj, s, d, lift = 0) {
    const f = frameAt(s);
    obj.position.copy(f.pos).addScaledVector(f.right, d).addScaledVector(f.up, lift);
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right, f.up, f.fwd.clone().negate()));
  }

  // ---------- Boost arrows and barriers ----------
  function arrowTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(43,255,90,.25)'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#2bff5a';
    for (const y of [6, 26, 46]) { g.beginPath(); g.moveTo(10, y + 14); g.lineTo(32, y); g.lineTo(54, y + 14); g.lineTo(46, y + 18); g.lineTo(32, y + 8); g.lineTo(18, y + 18); g.closePath(); g.fill(); }
    return new THREE.CanvasTexture(c);
  }
  function hexTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#ff4f5e'; g.lineWidth = 2;
    for (let y = 0; y < 72; y += 11) for (let x = (y / 11) % 2 ? 6 : 0; x < 72; x += 12) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5); } g.closePath(); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function buildPickups() {
    const arrowMat = new THREE.MeshBasicMaterial({ map: arrowTexture(), transparent: true, depthWrite: false });
    const hexMat = new THREE.MeshLambertMaterial({ map: hexTexture(), transparent: true, side: THREE.DoubleSide });
    const frameMat = new THREE.MeshLambertMaterial({ color: '#8a2b3a' });
    for (let k = 0; k < 14; k++) {
      const s = L * (0.06 + k / 14 * 0.92), d = rand(-HALF + 1.5, HALF - 1.5);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 6), arrowMat); m.rotation.x = -Math.PI / 2;
      const g = new THREE.Group(); g.add(m); placeOnTrack(g, s, d, 0.08); scene.add(g);
      pads.push({ s, d });
    }
    for (let k = 0; k < 16; k++) {
      const s = L * (0.1 + (k + 0.5) / 16 * 0.85), d = rand(-HALF + 1, HALF - 1);
      const g = new THREE.Group();
      const net = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.2), hexMat); net.position.y = 1.9; g.add(net);
      for (const x of [-1.8, 1.8]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 0.25), frameMat); post.position.set(x, 1.8, 0); g.add(post); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.25, 0.25), frameMat); bar.position.y = 3.55; g.add(bar);
      placeOnTrack(g, s, d); scene.add(g);
      blocks.push({ s, d });
    }
  }

  // ---------- Cars ----------
  // A low muscle car with stripes, glowing exhausts and tail lights.
  function buildCar(color, stripe) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const box = (w, h, d, c, x, y, z, basic) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); body.add(m); return m; };
    box(2.2, 0.6, 4.4, color, 0, 0.65, 0);
    box(1.8, 0.55, 2, color, 0, 1.2, 0.3);
    box(1.7, 0.45, 0.05, '#1b2026', 0, 1.2, -0.72); box(1.7, 0.45, 0.05, '#1b2026', 0, 1.2, 1.32);
    if (stripe) for (const x of [-0.25, 0.25]) { box(0.22, 0.02, 4.42, stripe, x, 0.96, 0); box(0.22, 0.02, 2.02, stripe, x, 1.48, 0.3); }
    for (const x of [-0.65, 0.65]) { box(0.55, 0.18, 0.05, '#ff2a2a', x, 0.75, 2.21, true); box(0.4, 0.15, 0.05, '#fff6c2', x, 0.75, -2.21, true); box(0.3, 0.3, 0.05, '#ffb030', x * 0.9, 0.4, 2.22, true); }
    for (const x of [-1.05, 1.05]) for (const z of [-1.4, 1.4]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12), new THREE.MeshLambertMaterial({ color: '#15171c' }));
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); body.add(w);
    }
    return g;
  }
  function makeCars() {
    for (const c of cars) scene.remove(c.mesh);
    cars = [];
    for (let k = 0; k < CARS; k++) {
      const mine = k === 0;
      const mesh = buildCar(mine ? '#2f6fe0' : COLORS[(k - 1) % COLORS.length], mine ? '#ffffff' : Math.random() < 0.5 ? '#111111' : null);
      scene.add(mesh);
      // Starting grid: two cars per row, you at the back so there's racing to do.
      const row = Math.floor((CARS - 1 - k) / 2), side = k % 2 ? 1 : -1;
      cars.push({ mesh, mine, s: -6 - row * 7, d: side * 3.5, v: 0, lap: 0, done: 0, boost: 0, bump: 0,
        top: mine ? TOP : TOP * rand(0.8, 0.93), skill: rand(0.3, 1), lane: side * 3.5, laneT: rand(1, 3), name: mine ? 'You' : 'Car ' + k });
    }
    me = cars[0];
  }

  // ---------- Update ----------
  const steerInput = () => ((keys.arrowright || keys.d || hold.right) ? 1 : 0) - ((keys.arrowleft || keys.a || hold.left) ? 1 : 0);
  const progress = c => c.lap * L + c.s;
  function update(dt) {
    if (state === 'count') {
      countT -= dt; $('ttBig').textContent = countT > 0 ? Math.ceil(countT) : 'GO!';
      if (countT <= 0) { state = 'race'; setTimeout(() => { if (state === 'race') $('ttBig').hidden = true; }, 700); }
      return;
    }
    if (state !== 'race' && state !== 'done') return;
    raceT += dt;
    for (const c of cars) {
      if (c.done && !c.mine) { c.v *= 1 - dt; }
      // Steering: you with the keys or touch, computer cars toward a lane that avoids barriers ahead.
      let steer;
      if (c.mine) steer = state === 'race' ? steerInput() : 0;
      else {
        c.laneT -= dt; if (c.laneT < 0) { c.lane = rand(-HALF + 1, HALF - 1); c.laneT = rand(2, 5); }
        for (const b of blocks) {
          const ahead = ((b.s - c.s) % L + L) % L;
          if (ahead < 6 + c.skill * 24 && Math.abs(b.d - c.lane) < 3) c.lane = b.d > 0 ? b.d - 4 : b.d + 4;   // slow spotters swerve too late
        }
        steer = Math.max(-1, Math.min(1, (c.lane - c.d) * 0.5));
      }
      c.d = Math.max(-HALF, Math.min(HALF, c.d + steer * STEER * dt * Math.min(1, c.v / 15 + 0.3)));
      // Speed: everyone speeds up by themselves; boosts make you faster for a moment.
      c.boost = Math.max(0, c.boost - dt); c.bump = Math.max(0, c.bump - dt);
      const top = c.top * (c.boost > 0 ? BOOST : 1) * (c.bump > 0 ? 0.55 : 1);
      c.v += Math.max(-ACCEL * 2, Math.min(ACCEL, (top - c.v) * 2)) * dt;
      if (Math.abs(c.d) >= HALF - 0.01) c.v *= 1 - 0.8 * dt;              // scraping the wall slows you down
      const before = c.s;
      c.s += c.v * dt;
      for (const p of pads) if (crossed(before, c.s, p.s) && Math.abs(p.d - c.d) < 2.6) { c.boost = 1.8; if (c.mine) toast('Speed boost! ⚡'); }
      for (const b of blocks) if (crossed(before, c.s, b.s) && Math.abs(b.d - c.d) < 2.9) { c.bump = 1.1; c.v *= 0.45; if (c.mine) toast('Crash! 💥'); }
      if (c.s >= L) { c.s -= L; c.lap++; if (c.mine && c.lap < LAPS) toast('Lap ' + (c.lap + 1) + '!'); }
      if (c.lap >= LAPS && !c.done) { c.done = ++finishers; if (c.mine) finish(); }
    }
    // Cars bump into each other side to side.
    for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
      const p = cars[a], q = cars[b], ds = progress(p) - progress(q), dd = p.d - q.d;
      if (Math.abs(ds) < 4.4 && Math.abs(dd) < 2.2) {
        const push = (2.2 - Math.abs(dd)) / 2 * Math.sign(dd || 1);
        p.d = Math.max(-HALF, Math.min(HALF, p.d + push)); q.d = Math.max(-HALF, Math.min(HALF, q.d - push));
        if (ds > 0) q.v = Math.min(q.v, p.v); else p.v = Math.min(p.v, q.v);
      }
    }
    const place = placeOf(me);
    $('ttPos').textContent = `${place}/${CARS}`; $('ttPlace').textContent = ordinal(place);
    $('ttLap').textContent = `${Math.min(me.lap + 1, LAPS)}/${LAPS}`; $('ttMph').textContent = Math.round(me.v * 2.2) + ' MPH';
    $('ttTime').textContent = clock(raceT);
  }
  const crossed = (a, b, x) => (a < x && b >= x) || (a < x + L && b >= x + L);
  function placeOf(c) { if (c.done) return c.done; return finishers + 1 + cars.filter(o => !o.done && o !== c && progress(o) > progress(c)).length; }
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const clock = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}:${String(Math.floor(t * 1000 % 1000)).padStart(3, '0')}`;
  let toastT = 0;
  function toast(text) { const el = $('ttToast'); el.textContent = text; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1100); }

  // ---------- Drawing ----------
  const camPos = V(0, 10, 20), camLook = V();
  function draw(t) {
    for (const c of cars) {
      placeOnTrack(c.mesh, c.s, c.d);
      c.mesh.children[0].rotation.z = 0;
    }
    if (me) {
      const f = frameAt(me.s), carPos = me.mesh.position;
      const want = carPos.clone().addScaledVector(f.fwd, -9).addScaledVector(f.up, 3.6);
      camPos.lerp(want, state === 'menu' ? 1 : 0.18); camLook.lerp(carPos.clone().addScaledVector(f.fwd, 10).addScaledVector(f.up, 1.2), 0.25);
      camera.position.copy(camPos); camera.lookAt(camLook);
      camera.fov += ((me.boost > 0 ? 82 : 68) - camera.fov) * 0.08; camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  }

  // ---------- Screens ----------
  function show(id) {
    for (const p of ['ttMenu', 'ttOver']) $(p).hidden = p !== id;
    const racing = state === 'race' || state === 'count';
    $('ttHud').hidden = !racing; if (!racing) { $('ttBig').hidden = true; $('ttToast').hidden = true; }
  }
  function toMenu() { state = 'menu'; makeCars(); $('ttBest').textContent = best; $('ttBank').textContent = bankNow(); show('ttMenu'); }
  function start() {
    makeCars(); raceT = 0; finishers = 0; countT = 3; state = 'count';
    $('ttPos').textContent = `${CARS}/${CARS}`; $('ttPlace').textContent = ordinal(CARS); $('ttLap').textContent = `1/${LAPS}`; $('ttMph').textContent = '0 MPH'; $('ttTime').textContent = clock(0);
    show(null); $('ttBig').hidden = false; $('ttBig').textContent = '3';
  }
  function finish() {
    state = 'done';
    const place = me.done, score = (CARS + 1 - place) * 10, coins = (CARS + 1 - place) * 2;
    addCoins(coins);
    if (place === 1) Celebrate.win();
    const newBest = score > best; if (newBest) { best = score; store.set('best', best); }
    $('ttOverTitle').textContent = place === 1 ? 'You won the race! 🏆' : place <= 3 ? `${ordinal(place)} place! 🏅` : `You came ${ordinal(place)}`;
    $('ttOverScore').textContent = clock(raceT); $('ttOverCoins').textContent = coins; $('ttOverBest').textContent = best;
    $('ttNote').textContent = newBest ? 'New best score!' : `You have ${bankNow()} coins to spend in the Skin Shop.`;
    $('ttBoardStatus').textContent = 'Saving your score…';
    show('ttOver');
    Leaderboard.submit('turbotrack', { name: playerName() || 'Mystery Racer', score }).then(r => {
      $('ttBoardStatus').textContent = r.ok ? (r.improved ? 'Your new best is on the leaderboard!' : `Your best is still ${r.best}.`)
        : r.reason === 'offline' ? '' : r.reason === 'readonly' ? 'You need more access to add scores. Ask the owner to give you access.' : 'Your score couldn’t be saved this time.';
    });
  }
  Leaderboard.watch('turbotrack', 5, rows => {
    const box = $('ttBoard'), list = $('ttBoardList');
    box.hidden = !rows; if (!rows) return;
    list.innerHTML = '';
    if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No scores yet. Be the first!'; list.appendChild(li); return; }
    rows.forEach((row, i) => {
      const li = document.createElement('li'); if (row.me) li.className = 'me';
      for (const [cls, text] of [['rank', i + 1], ['name', row.name || 'Mystery Racer'], ['pts', row.score]]) {
        const span = document.createElement('span'); span.className = cls; span.textContent = text; li.appendChild(span);
      }
      list.appendChild(li);
    });
  });

  // ---------- Input ----------
  // Keys: ← → or A D to steer. Touch / mouse: hold the left or right half of the screen.
  window.addEventListener('keydown', e => {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (/^(a|d|arrow(left|right))$/.test(k)) { keys[k] = true; if (state === 'race') e.preventDefault(); }
    else if ((k === ' ' || k === 'enter') && (state === 'menu' || state === 'done')) { e.preventDefault(); start(); }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; hold.left = hold.right = false; });
  const holds = new Map();
  const sync = () => { const v = [...holds.values()]; hold.left = v.includes('left'); hold.right = v.includes('right'); };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {} holds.set(e.pointerId, e.clientX < canvas.clientWidth / 2 ? 'left' : 'right'); sync(); });
  canvas.addEventListener('pointermove', e => { if (holds.has(e.pointerId)) { holds.set(e.pointerId, e.clientX < canvas.clientWidth / 2 ? 'left' : 'right'); sync(); } });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => { holds.delete(e.pointerId); sync(); });
  $('ttPlay').onclick = start;
  $('ttAgain').onclick = start;
  $('ttMenuBtn').onclick = toMenu;
  for (const id of ['ttLobby', 'ttOverLobby']) $(id).onclick = () => window.Lobby && Lobby.show();

  // ---------- Loop ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
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
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#8a93b8');
    scene.fog = new THREE.Fog('#8a93b8', 120, 420);
    camera = new THREE.PerspectiveCamera(68, 1, 0.1, 900);
    scene.add(new THREE.HemisphereLight('#e6e9ff', '#4a4f66', 1));
    const sun = new THREE.DirectionalLight('#ffffff', 0.5); sun.position.set(40, 80, 30); scene.add(sun);
    // Far-off snowy mountains and a misty ground way below.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: '#6d7590' })); ground.rotation.x = -Math.PI / 2; ground.position.y = -40; scene.add(ground);
    for (let i = 0; i < 30; i++) {
      const a = i / 30 * Math.PI * 2, d = rand(520, 700), h = rand(80, 180);
      const mtn = new THREE.Mesh(new THREE.ConeGeometry(rand(60, 120), h, 5), new THREE.MeshLambertMaterial({ color: '#9aa2c0', flatShading: true }));
      mtn.position.set(180 + Math.cos(a) * d, -40 + h / 2, -120 + Math.sin(a) * d); scene.add(mtn);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(mtn.geometry.parameters.radius * 0.35, h * 0.35, 5), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }));
      cap.position.set(mtn.position.x, -40 + h * 0.83, mtn.position.z); scene.add(cap);
    }
    buildTrack(); buildPickups();
    return true;
  }
  window.TurboTrack = {
    open() {
      root.hidden = false; active = true;
      if (!setup()) { $('ttNote').textContent = 'This game needs 3D graphics, which this browser has turned off.'; return; }
      resize(); toMenu(); last = performance.now(); requestAnimationFrame(loop);
    },
    close() { active = false; root.hidden = true; for (const k in keys) keys[k] = false; hold.left = hold.right = false; },
    // For tests: race with a simple pilot (steer away from barriers, toward boosts) for some seconds.
    _race(seconds, smart = true) {
      start(); countT = 0; update(0.01);
      for (let t = 0; t < seconds && state === 'race'; t += 1 / 60) {
        keys.arrowleft = keys.arrowright = false;
        if (smart) {
          let want = me.d;
          for (const p of pads) { const a = ((p.s - me.s) % L + L) % L; if (a < 40) want = p.d; }
          for (const b of blocks) { const a = ((b.s - me.s) % L + L) % L; if (a < 30 && Math.abs(b.d - want) < 3.2) want = b.d > 0 ? b.d - 4.5 : b.d + 4.5; }
          if (want > me.d + 0.4) keys.arrowright = true; else if (want < me.d - 0.4) keys.arrowleft = true;
        }
        update(1 / 60);
      }
      keys.arrowleft = keys.arrowright = false;
      return { state, place: placeOf(me), lap: me.lap, t: +raceT.toFixed(1), mph: Math.round(me.v * 2.2), L: Math.round(L) };
    },
  };
})();

// Sky Hop: bounce up an endless tower of platforms. Loaded by index.html after rail-rush.js,
// so it can dress the hopper in the player's Dodge and Weave look and share the coin bank.
(() => {
  const root = document.getElementById('skyhop');
  const canvas = document.getElementById('hopCanvas');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);

  const VIEW_H = 720;             // the game world is always 720 units tall; width follows the screen
  const GRAVITY = 1700, JUMP = -860, SPRING = -1450, MOVE = 520;
  const PW = 84, PH = 14;         // platform size
  const store = {
    get(k, d) { try { const v = localStorage.getItem('skyhop.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('skyhop.' + k, JSON.stringify(v)); } catch {} },
  };

  let active = false, state = 'menu', last = 0, scale = 1, W = 400;
  let player, platforms, coins, camY, topY, score, runCoins, keys = {}, touchDir = 0, best = store.get('best', 0);

  // ---------- Shared with Dodge and Weave ----------
  function look() {
    // Use the player's runner colors when Dodge and Weave is loaded.
    try {
      const cfg = avatarCfg, costume = COSTUMES[cfg.outfit];
      const P = costume ? costume.parts : { skin: cfg.skin, shirt: cfg.shirt, pants: cfg.pants, shoes: cfg.shoes };
      return { skin: P.skin, shirt: P.shirt, pants: P.pants, shoes: P.shoes, hair: (costume && costume.brows) || cfg.hairColor || '#3a2414', eyes: (costume && costume.eyes && [].concat(costume.eyes)[0]) || cfg.eyes || '#5a3a22' };
    } catch { return { skin: '#f1c19b', shirt: '#ff4f7b', pants: '#2f80ff', shoes: '#ffffff', hair: '#5a3a22', eyes: '#7a3b2e' }; }
  }
  // Coins go into Dodge and Weave's bank (its `bank` variable when loaded, otherwise straight to storage).
  function addCoins(n) {
    try { bank += n; } catch { bank_ = (bankNow() || 0) + n; }
    try { localStorage.setItem('railrush.bank', JSON.stringify(bankNow())); } catch {}
  }
  let bank_ = null;
  const bankNow = () => { try { return bank; } catch { if (bank_ != null) return bank_; try { return JSON.parse(localStorage.getItem('railrush.bank')) || 0; } catch { return 0; } } };
  const playerName = () => { try { return runnerName; } catch { try { return JSON.parse(localStorage.getItem('railrush.name')) || ''; } catch { return ''; } } };

  // ---------- World ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  function platformAt(y) {
    const h = -y / 10; // height climbed so far, in meters
    const r = Math.random();
    let type = 'normal';
    if (h > 40 && r < Math.min(0.35, 0.1 + h / 1500)) type = 'moving';
    else if (h > 80 && r < Math.min(0.55, 0.3 + h / 2000)) type = 'breaking';
    const p = { x: rand(10, W - PW - 10), y, type, vx: type === 'moving' ? rand(60, 130) * (Math.random() < 0.5 ? -1 : 1) : 0, broken: false, spring: false };
    if (type === 'normal' && Math.random() < 0.08) p.spring = true;
    if (Math.random() < 0.35) coins.push({ x: p.x + PW / 2, y: y - 40, taken: false });
    return p;
  }
  function gap() { const h = -topY / 10; return rand(70, Math.min(170, 95 + h / 8)); }
  function fill() {
    while (topY > camY - 200) {
      topY -= gap();
      platforms.push(platformAt(topY));
      // A breaking platform never stands alone: add a safe one nearby so the tower stays climbable.
      if (platforms[platforms.length - 1].type === 'breaking') { topY -= 30; platforms.push({ x: rand(10, W - PW - 10), y: topY, type: 'normal', vx: 0, broken: false, spring: false }); }
    }
  }
  function reset() {
    platforms = []; coins = []; camY = 0; score = 0; runCoins = 0;
    player = { x: W / 2 - 17, y: VIEW_H - 120, vx: 0, vy: JUMP, w: 34, h: 46, face: 1, highest: VIEW_H - 120 };
    platforms.push({ x: W / 2 - PW / 2, y: VIEW_H - 60, type: 'normal', vx: 0, broken: false, spring: false });
    topY = VIEW_H - 60;
    fill();
  }

  // ---------- Update ----------
  function update(dt) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) || touchDir;
    player.vx += (dir * MOVE - player.vx) * Math.min(1, dt * 10);
    if (dir) player.face = dir;
    player.x += player.vx * dt;
    if (player.x > W) player.x = -player.w; else if (player.x < -player.w) player.x = W; // wrap around the edges
    const prevBottom = player.y + player.h;
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    for (const p of platforms) {
      if (p.type === 'moving') { p.x += p.vx * dt; if (p.x < 0 || p.x > W - PW) p.vx *= -1; }
      if (p.broken) { p.y += 400 * dt; continue; }
      const bottom = player.y + player.h;
      if (player.vy > 0 && prevBottom <= p.y && bottom >= p.y && player.x + player.w > p.x + 4 && player.x < p.x + PW - 4) {
        if (p.type === 'breaking') { p.broken = true; continue; }
        player.y = p.y - player.h;
        player.vy = p.spring && Math.abs(player.x + player.w / 2 - (p.x + PW / 2)) < 26 ? SPRING : JUMP;
      }
    }
    for (const c of coins) {
      if (!c.taken && Math.abs(player.x + player.w / 2 - c.x) < 28 && Math.abs(player.y + player.h / 2 - c.y) < 32) { c.taken = true; runCoins++; }
    }
    camY = Math.min(camY, player.y - VIEW_H * 0.42);
    player.highest = Math.min(player.highest, player.y);
    score = Math.max(0, Math.floor((VIEW_H - 120 - player.highest) / 10));
    platforms = platforms.filter(p => p.y < camY + VIEW_H + 60);
    coins = coins.filter(c => !c.taken && c.y < camY + VIEW_H + 60);
    fill();
    $('hopScore').textContent = score + ' m';
    $('hopCoins').textContent = runCoins;
    if (player.y > camY + VIEW_H + 40) fall();
  }

  // ---------- Drawing ----------
  function sky() {
    const h = Math.min(1, score / 600); // the sky darkens into space as you climb
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, `hsl(${205 + h * 50}, ${80 - h * 30}%, ${72 - h * 60}%)`);
    g.addColorStop(1, `hsl(${200 + h * 40}, ${85 - h * 30}%, ${86 - h * 62}%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, VIEW_H);
    ctx.fillStyle = `rgba(255,255,255,${0.15 + h * 0.75})`;
    for (let i = 0; i < 40; i++) { // stars and specks drift slower than the platforms
      const sx = (i * 97.3) % W, sy = ((i * 53.7 - camY * 0.2) % VIEW_H + VIEW_H) % VIEW_H;
      ctx.fillRect(sx, sy, h > 0.4 ? 2 : 1.5, h > 0.4 ? 2 : 1.5);
    }
    if (h < 0.6) {
      ctx.fillStyle = `rgba(255,255,255,${0.75 - h})`;
      for (let i = 0; i < 5; i++) {
        const cx = (i * 131 + 40) % (W + 120) - 60, cy = ((i * 211 - camY * 0.4) % (VIEW_H + 200) + VIEW_H + 200) % (VIEW_H + 200) - 100;
        cloud(cx, cy, 30 + (i % 3) * 10);
      }
    }
  }
  function cloud(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.arc(x + r, y - r * 0.4, r * 0.9, 0, 7); ctx.arc(x + r * 2, y, r * 0.8, 0, 7); ctx.fill(); }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function drawPlatform(p) {
    const y = p.y - camY;
    const fill = p.type === 'moving' ? '#5fb8f0' : p.type === 'breaking' ? '#c9915a' : '#4cc36b';
    ctx.lineWidth = 3; ctx.strokeStyle = '#1b1530'; ctx.fillStyle = fill;
    roundRect(p.x, y, PW, PH, 7); ctx.fill(); ctx.stroke();
    if (p.type === 'breaking') { ctx.beginPath(); ctx.moveTo(p.x + 30, y + 2); ctx.lineTo(p.x + 40, y + 9); ctx.lineTo(p.x + 50, y + 3); ctx.stroke(); }
    if (p.spring) {
      const sx = p.x + PW / 2 - 10;
      ctx.fillStyle = '#ffcf1a'; roundRect(sx, y - 14, 20, 14, 3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 3, y - 4); ctx.lineTo(sx + 17, y - 4); ctx.moveTo(sx + 3, y - 9); ctx.lineTo(sx + 17, y - 9); ctx.stroke();
    }
  }
  function drawCoin(c) {
    const y = c.y - camY, s = Math.abs(Math.cos(performance.now() / 250 + c.x));
    ctx.fillStyle = '#ffcf1a'; ctx.strokeStyle = '#1b1530'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(c.x, y, 11 * (0.3 + 0.7 * s), 11, 0, 0, 7); ctx.fill(); ctx.stroke();
  }
  // The hopper: a little anime version of the player's runner.
  function drawPlayer(L) {
    const { x, w, h, face } = player, y = player.y - camY, cx = x + w / 2;
    const squash = Math.max(0.85, Math.min(1.15, 1 - player.vy / 6000));
    ctx.save(); ctx.translate(cx, y + h); ctx.scale(1 / squash, squash); ctx.translate(-cx, -(y + h));
    ctx.lineWidth = 3; ctx.strokeStyle = '#1b1530';
    ctx.fillStyle = L.pants; roundRect(cx - 12, y + 32, 10, 12, 4); ctx.fill(); ctx.stroke(); roundRect(cx + 2, y + 32, 10, 12, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = L.shoes; roundRect(cx - 14, y + 41, 13, 6, 3); ctx.fill(); ctx.stroke(); roundRect(cx + 1, y + 41, 13, 6, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = L.shirt; roundRect(cx - 13, y + 18, 26, 18, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(cx, y + 10, 13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = L.hair; ctx.beginPath(); ctx.arc(cx, y + 6, 13, Math.PI, 0); ctx.fill(); ctx.stroke();
    for (const s of [-1, 1]) { // big anime eyes looking where you're going
      const ex = cx + s * 5 + face * 2;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(ex, y + 11, 3.2, 4.2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = L.eyes; ctx.beginPath(); ctx.ellipse(ex + face * 0.6, y + 11.5, 2.2, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(ex + face * 0.6, y + 9.5, 1.2, 1.2);
    }
    ctx.restore();
  }
  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    sky();
    for (const p of platforms) drawPlatform(p);
    for (const c of coins) drawCoin(c);
    if (player) drawPlayer(look());
  }

  // ---------- Screens ----------
  function show(id) { for (const p of ['hopMenu', 'hopOver']) $(p).hidden = p !== id; $('hopHud').hidden = state !== 'play'; }
  function toMenu() {
    state = 'menu'; reset(); player.vy = 0;
    $('hopBest').textContent = best; $('hopBank').textContent = bankNow();
    show('hopMenu');
  }
  function start() { reset(); state = 'play'; show(null); }
  function fall() {
    state = 'over';
    addCoins(runCoins);
    const newBest = score > best; if (newBest) { best = score; store.set('best', best); }
    $('hopOverScore').textContent = score + ' m'; $('hopOverCoins').textContent = runCoins; $('hopOverBest').textContent = best + ' m';
    $('hopNote').textContent = newBest ? 'New best height!' : `You have ${bankNow()} coins to spend in Dodge and Weave.`;
    $('hopBoardStatus').textContent = score > 0 ? 'Saving your score…' : '';
    show('hopOver');
    if (score > 0) Leaderboard.submit('skyhop', { name: playerName() || 'Mystery Hopper', score }).then(r => {
      $('hopBoardStatus').textContent = r.ok ? (r.improved ? 'Your new best is on the leaderboard!' : `Your best is still ${r.best} m.`)
        : r.reason === 'offline' ? '' : r.reason === 'readonly' ? 'You need more access to add scores. Ask the owner to give you access.' : 'Your score couldn’t be saved this time.';
    });
  }
  Leaderboard.watch('skyhop', 5, rows => {
    const box = $('hopBoard'), list = $('hopBoardList');
    box.hidden = !rows; if (!rows) return;
    list.innerHTML = '';
    if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No scores yet. Be the first!'; list.appendChild(li); return; }
    rows.forEach((row, i) => {
      const li = document.createElement('li'); if (row.me) li.className = 'me';
      for (const [cls, text] of [['rank', i + 1], ['name', row.name || 'Mystery Hopper'], ['pts', row.score + ' m']]) {
        const span = document.createElement('span'); span.className = cls; span.textContent = text; li.appendChild(span);
      }
      list.appendChild(li);
    });
  });

  // ---------- Input ----------
  const keyDir = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
  window.addEventListener('keydown', e => {
    if (!active) return;
    const k = keyDir[e.key.toLowerCase()];
    if (k) { keys[k] = true; e.preventDefault(); }
    else if ((e.key === 'Enter' || e.key === ' ') && state !== 'play') { start(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { const k = keyDir[e.key.toLowerCase()]; if (k) keys[k] = false; });
  canvas.addEventListener('pointerdown', e => { const r = canvas.getBoundingClientRect(); touchDir = e.clientX - r.left < r.width / 2 ? -1 : 1; });
  canvas.addEventListener('pointermove', e => { if (!touchDir) return; const r = canvas.getBoundingClientRect(); touchDir = e.clientX - r.left < r.width / 2 ? -1 : 1; });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(ev, () => { touchDir = 0; });
  $('hopPlay').onclick = start;
  $('hopAgain').onclick = start;
  $('hopMenuBtn').onclick = toMenu;
  for (const id of ['hopLobby', 'hopOverLobby']) $(id).onclick = () => window.Lobby && Lobby.show();

  // ---------- Loop ----------
  function resize() {
    const cw = canvas.clientWidth || window.innerWidth, ch = canvas.clientHeight || window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    scale = canvas.height / VIEW_H; W = canvas.width / scale;
  }
  window.addEventListener('resize', () => { if (active) resize(); });
  function loop(t) {
    if (!active) return;
    const dt = Math.min((t - last) / 1000, 0.033); last = t;
    if (state === 'play') update(dt);
    else if (state === 'menu') { player.y = VIEW_H - 120 + Math.sin(t / 300) * 14 - 14; } // bob on the start platform
    draw();
    requestAnimationFrame(loop);
  }
  window.SkyHop = {
    open() { root.hidden = false; active = true; resize(); toMenu(); last = performance.now(); requestAnimationFrame(loop); },
    close() { active = false; root.hidden = true; keys = {}; touchDir = 0; },
  };
})();

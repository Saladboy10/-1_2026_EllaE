// Jimmy Yum-Yum (files and storage keep the old "star catcher" name): a hungry boy named Jimmy catches falling burgers and hot dogs in his huge mouth, dodges the
// broccoli and carrots, and grabs hearts for extra lives.
// Every burger or hot dog caught also adds a coin to the Dodge and Weave bank. Loaded by index.html after rail-rush.js.
(() => {
  const root = document.getElementById('starcatcher');
  const canvas = document.getElementById('scCanvas');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('starcatcher.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('starcatcher.' + k, JSON.stringify(v)); } catch {} },
  };

  let W = 400, H = 600, active = false, last = 0, shake = 0;
  let state = 'menu';                         // menu | play | paused | over
  // 3 levels in every game, one for each difficulty: Level 1 is Easy, Level 2 Medium and Level 3 Hard.
  // Last 20 seconds to move up a level, and beat Level 3 to win. You can also start on Level 2 or 3.
  // `level` is how fast things fall within a level (it creeps up as the level goes on).
  // Harder modes give more points per food, so the one leaderboard stays fair.
  const DIFFS = {
    easy: { name: 'Easy', points: 5, veg: l => Math.min(0.08 + l * 0.01, 0.18), heart: 0.06, speed: l => 90 + l * 10, every: l => Math.max(0.8, 1.2 - l * 0.03), count: () => 1 },
    medium: { name: 'Medium', points: 10, veg: l => Math.min(0.15 + l * 0.04, 0.45), heart: 0.03, speed: l => 140 + l * 25, every: l => Math.max(0.25, 0.9 - l * 0.06), count: () => 1 },
    hard: { name: 'Hard', points: 20, veg: l => Math.min(0.38 + l * 0.02, 0.5), heart: 0.03, speed: l => 220 + l * 30, every: l => Math.max(0.1, 0.28 - l * 0.02), count: () => 2 + (Math.random() < 0.4 ? 1 : 0) },
  };
  const LEVEL_TIME = 20, LEVELS = 3, ORDER = ['easy', 'medium', 'hard'];
  let diff = 'easy', firstStage = 1;              // you start on Level 1 (Easy) unless you pick another level
  let player, items, particles, score, lives, level, spawnTimer, stars, stage, stageT, banner, best = store.get('best', 0);
  const keys = {};
  let pointerX = null;
  const twinkles = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.3, p: Math.random() * Math.PI * 2 }));

  // ---------- Shared with Dodge and Weave ----------
  let bank_ = null;
  const bankNow = () => { try { return bank; } catch { if (bank_ != null) return bank_; try { return JSON.parse(localStorage.getItem('railrush.bank')) || 0; } catch { return 0; } } };
  function addCoins(n) {
    try { bank += n; } catch { bank_ = (bankNow() || 0) + n; }
    try { localStorage.setItem('railrush.bank', JSON.stringify(bankNow())); } catch {}
  }
  const playerName = () => { try { return runnerName; } catch { try { return JSON.parse(localStorage.getItem('railrush.name')) || ''; } catch { return ''; } } };

  // ---------- Game ----------
  function reset() {
    player = { x: W / 2, y: H - 95, w: 90, h: 30, speed: 520, open: 0, chew: 0, hurt: 0, move: 0, look: 0 };
    items = []; particles = [];
    score = 0; lives = 3; level = 1; spawnTimer = 0; stars = 0; stage = firstStage; stageT = 0; diff = ORDER[stage - 1]; banner = { text: `Level ${stage}: ${DIFFS[diff].name}`, t: 1.8 };
  }
  function spawn() {
    const D = DIFFS[diff];
    for (let i = D.count(); i > 0; i--) {                 // on Hard, lots fall at once
      const roll = Math.random();
      const type = roll < D.veg(level) ? (Math.random() < 0.5 ? 'broccoli' : 'carrot') : roll > 1 - D.heart ? 'heart' : Math.random() < 0.5 ? 'burger' : 'hotdog';
      const r = type === 'heart' ? 16 : 20;
      items.push({ type, r, x: r + Math.random() * (W - 2 * r), y: -r - Math.random() * 60 * (i - 1), vy: D.speed(level) + Math.random() * 60, spin: Math.random() * Math.PI * 2 });
    }
  }
  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 180;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, color });
    }
  }
  function update(dt) {
    const dir = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
    if (dir) { player.x += dir * player.speed * dt; pointerX = null; }
    else if (pointerX !== null) {
      const diff = pointerX - player.x;
      player.x += Math.sign(diff) * Math.min(Math.abs(diff), player.speed * 1.6 * dt);
    }
    const before = player.x;
    player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));
    player.y = H - 95;
    player.move += Math.abs(player.x - before) * 0.05;
    // Open wide when food is coming close to the mouth.
    let near = 0, lookX = 0;
    for (const it of items) {
      if (it.type === 'broccoli' || it.type === 'carrot' || it.y > player.y) continue;
      const d = Math.hypot(it.x - player.x, (player.y - it.y) * 0.8);
      if (d < 200) { const k = 1 - d / 200; if (k > near) { near = k; lookX = Math.max(-1, Math.min(1, (it.x - player.x) / 120)); } }
    }
    player.open += ((player.chew > 0 ? 0 : near) - player.open) * Math.min(1, dt * 10);
    player.look += (lookX - player.look) * Math.min(1, dt * 8);
    player.chew = Math.max(0, player.chew - dt); player.hurt = Math.max(0, player.hurt - dt);

    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawn(); spawnTimer = DIFFS[diff].every(level); }
    for (const it of items) {
      it.y += it.vy * dt; it.spin += dt * 2;
      const caught = it.y + it.r > player.y - player.h / 2 && it.y - it.r < player.y + player.h / 2 && Math.abs(it.x - player.x) < player.w / 2 + it.r * 0.6;
      if (caught) {
        it.dead = true;
        if (it.type === 'burger' || it.type === 'hotdog') { score += DIFFS[diff].points; stars++; player.chew = 0.35; burst(it.x, it.y, it.type === 'burger' ? '#e0a040' : '#ffd34d'); }
        else if (it.type === 'heart') { lives = Math.min(lives + 1, 5); player.chew = 0.35; burst(it.x, it.y, '#ff6b9a'); }
        else { lives--; player.hurt = 0.6; burst(it.x, it.y, it.type === 'carrot' ? '#ff8a1f' : '#3fae3a', 24); shake = 0.3; }   // yuck, vegetables!
      } else if (it.y - it.r > H) it.dead = true;
    }
    items = items.filter(it => !it.dead);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    level = 1 + Math.floor(stageT / 7);
    banner.t = Math.max(0, banner.t - dt);
    if (lives <= 0) return gameOver(false);
    // Last 20 seconds to move up a level; last through Level 3 and you win.
    stageT += dt;
    if (stageT >= LEVEL_TIME) {
      if (stage >= LEVELS) return gameOver(true);
      stage++; stageT = 0; diff = ORDER[stage - 1];
      banner = { text: `Level ${stage}: ${DIFFS[diff].name}!`, t: 2 };
      items = items.filter(it => it.type !== 'broccoli' && it.type !== 'carrot');   // a fresh start for the new level
      burst(player.x, player.y - 40, '#ffd34d', 30);
    }
  }

  // ---------- Drawing ----------
  // A cheeseburger: sesame bun, lettuce, cheese and a patty. Drawn about 2r wide, wobbling as it falls.
  function drawBurger(x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(rot) * 0.35); ctx.scale(r / 20, r / 20);
    ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#d9913a'; ctx.beginPath(); ctx.roundRect(-20, 8, 40, 9, [2, 2, 7, 7]); ctx.fill();          // bottom bun
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#6b3a1f'; ctx.beginPath(); ctx.roundRect(-21, 0, 42, 9, 4); ctx.fill();                    // patty
    ctx.fillStyle = '#ffcf2e'; ctx.beginPath(); ctx.moveTo(-21, -1); ctx.lineTo(21, -1); ctx.lineTo(12, 6); ctx.lineTo(4, 1); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();  // cheese
    ctx.fillStyle = '#5cc24a'; ctx.beginPath(); ctx.moveTo(-22, -3);                                             // wavy lettuce
    for (let i = 0; i <= 8; i++) ctx.lineTo(-22 + i * 5.5, i % 2 ? 1 : -4);
    ctx.lineTo(22, -3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8a447'; ctx.beginPath(); ctx.moveTo(-20, -3); ctx.bezierCurveTo(-20, -22, 20, -22, 20, -3); ctx.closePath(); ctx.fill();  // top bun
    ctx.fillStyle = '#fff3d6';
    for (const [sx, sy] of [[-9, -12], [-2, -15], [6, -13], [12, -8], [-14, -7], [2, -8]]) { ctx.beginPath(); ctx.ellipse(sx, sy, 1.8, 1, 0.4, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  // A hot dog: a sausage in a bun with a zigzag of mustard.
  function drawHotdog(x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3 + Math.sin(rot) * 0.35); ctx.scale(r / 20, r / 20);
    ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#b94a2c'; ctx.beginPath(); ctx.roundRect(-26, -5, 52, 10, 5); ctx.fill();                  // sausage
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8b062'; ctx.beginPath(); ctx.roundRect(-21, -1, 42, 11, 6); ctx.fill();                  // bun
    ctx.fillStyle = '#d99a4c'; ctx.fillRect(-19, 3, 38, 2);
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-20, -2);  // mustard
    for (let i = 1; i <= 10; i++) ctx.lineTo(-20 + i * 4, i % 2 ? -5 : 0);
    ctx.stroke();
    ctx.restore();
  }
  function drawHeart(x, y, r) {
    ctx.save(); ctx.translate(x, y); ctx.scale(r / 16, r / 16); ctx.beginPath();
    ctx.moveTo(0, 6); ctx.bezierCurveTo(-16, -6, -8, -18, 0, -8); ctx.bezierCurveTo(8, -18, 16, -6, 0, 6);
    ctx.fillStyle = '#ff6b9a'; ctx.shadowColor = '#ff6b9a'; ctx.shadowBlur = 12; ctx.fill(); ctx.restore();
  }
  // Broccoli: a pale stalk with a bumpy green top.
  function drawBroccoli(x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(rot) * 0.4); ctx.scale(r / 20, r / 20);
    ctx.strokeStyle = '#1f4a1c'; ctx.lineWidth = 2;
    ctx.fillStyle = '#9ccf6a'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-5, 18); ctx.quadraticCurveTo(0, 21, 5, 18); ctx.lineTo(6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3fae3a';
    for (const [bx, by, br] of [[-11, -3, 8], [11, -3, 8], [-6, -11, 9], [6, -11, 9], [0, -4, 9], [0, -16, 7]]) { ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#2d8a2a'; for (const [bx, by] of [[-8, -9], [5, -14], [9, -2], [-2, -3]]) { ctx.beginPath(); ctx.arc(bx, by, 2, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  // A carrot: orange with lines and a leafy green top.
  function drawCarrot(x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.5 + Math.sin(rot) * 0.4); ctx.scale(r / 20, r / 20);
    ctx.strokeStyle = '#7a3a0a'; ctx.lineWidth = 2;
    ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.quadraticCurveTo(0, -14, 8, -10); ctx.lineTo(1, 22); ctx.lineTo(-1, 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (const [lx, ly] of [[-5, -3], [4, 4], [-3, 11]]) { ctx.moveTo(lx, ly); ctx.lineTo(lx + 4, ly + 1); } ctx.stroke();
    ctx.fillStyle = '#4cb848'; ctx.strokeStyle = '#1f4a1c';
    for (const a of [-0.5, 0, 0.5]) { ctx.save(); ctx.translate(0, -12); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -8, 3.5, 9, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  // The catcher: a hungry cartoon boy with a huge mouth. It opens wide as food comes near,
  // chomps when he catches it, and his face turns green with X eyes when a vegetable hits him.
  function drawBoy(t) {
    const p = player, x = p.x, mouthY = p.y, hy = mouthY - 14;           // head centre
    const bob = Math.sin(p.move) * 3, chewK = p.chew > 0 ? Math.abs(Math.sin(p.chew * 28)) : 0;
    const R = 50, INK = '#1b1530';
    ctx.save(); ctx.translate(0, bob); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    // Body and waving arms.
    ctx.fillStyle = '#ff5b5b'; ctx.beginPath(); ctx.roundRect(x - 34, hy + R - 8, 68, 80, 18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 20, hy + R + 14, 40, 6);
    ctx.fillStyle = '#f1c19b';
    for (const s of [-1, 1]) {
      const a = -s * (0.6 + Math.sin(t / 150 + s) * 0.25 + p.open * 1.4);       // arms wave, and go up when food is coming
      ctx.save(); ctx.translate(x + s * 30, hy + R + 6); ctx.rotate(a);
      ctx.fillStyle = '#ff5b5b'; ctx.beginPath(); ctx.roundRect(-8, -6, 16, 26, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f1c19b'; ctx.beginPath(); ctx.arc(0, 26, 8, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // Head.
    ctx.fillStyle = p.hurt > 0 ? '#c9dc8e' : '#f1c19b';          // turns green when he gets a vegetable
    ctx.beginPath(); ctx.arc(x, hy, R, 0, 7); ctx.fill(); ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * R, hy + 2, 9, 0, 7); ctx.fill(); ctx.stroke(); }   // ears
    // Spiky hair.
    ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.moveTo(x - R + 2, hy - 10);
    for (let i = 0; i <= 8; i++) ctx.lineTo(x - R + 4 + i * (2 * R - 8) / 8, hy - R - (i % 2 ? 14 : 2) + Math.abs(i - 4) * 3);
    ctx.lineTo(x + R - 2, hy - 10); ctx.quadraticCurveTo(x, hy - R + 6, x - R + 2, hy - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Eyes: watch the food, squeeze shut when chewing, X's when hurt.
    for (const s of [-1, 1]) {
      const ex = x + s * 18, ey = hy - 18 - p.open * 6;
      if (p.hurt > 0) {
        ctx.beginPath(); ctx.moveTo(ex - 6, ey - 6); ctx.lineTo(ex + 6, ey + 6); ctx.moveTo(ex + 6, ey - 6); ctx.lineTo(ex - 6, ey + 6); ctx.stroke();
      } else if (p.chew > 0) {
        ctx.beginPath(); ctx.arc(ex, ey + 2, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(ex, ey, 9, 11 + p.open * 3, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + p.look * 4, ey - 1 - p.open * 3, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex + p.look * 4 + 2, ey - 3 - p.open * 3, 1.6, 0, 7); ctx.fill();
      }
    }
    // Puffy cheeks while chewing.
    if (p.chew > 0) { ctx.fillStyle = '#f7a3a0'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 34, hy + 8, 12, 9, 0, 0, 7); ctx.fill(); } }
    // The huge mouth.
    const mw = 42 + p.open * 10, mh = p.hurt > 0 ? 6 : 9 + p.open * 34 + chewK * 6;
    const my = mouthY + 4;
    ctx.fillStyle = '#5a0f1f'; ctx.beginPath(); ctx.ellipse(x, my, mw, mh, 0, 0, 7); ctx.fill(); ctx.stroke();
    if (mh > 12) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, my, mw - 2, mh - 2, 0, 0, 7); ctx.clip();
      ctx.fillStyle = '#ff7b93'; ctx.beginPath(); ctx.ellipse(x, my + mh * 0.75, mw * 0.6, mh * 0.5, 0, 0, 7); ctx.fill();   // tongue
      ctx.fillStyle = '#ffffff'; for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * 10 - 4, my - mh, 8, 7);                    // teeth
      ctx.restore();
    }
    ctx.restore();
  }
  function draw(t) {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 12 * shake, (Math.random() - 0.5) * 12 * shake);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#2a1b5c');
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    for (const s of twinkles) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 900 + s.p));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (player && state !== 'menu') {
      for (const it of items) { if (it.type === 'burger') drawBurger(it.x, it.y, it.r, it.spin); else if (it.type === 'hotdog') drawHotdog(it.x, it.y, it.r, it.spin); else if (it.type === 'heart') drawHeart(it.x, it.y, it.r); else if (it.type === 'broccoli') drawBroccoli(it.x, it.y, it.r, it.spin); else drawCarrot(it.x, it.y, it.r, it.spin); }
      for (const p of particles) { ctx.globalAlpha = Math.max(p.life / 0.6, 0); ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
      ctx.globalAlpha = 1;
      drawBoy(t);
      ctx.fillStyle = '#f4f1ff'; ctx.font = 'bold 22px Nunito, system-ui, sans-serif'; ctx.textBaseline = 'top';
      ctx.textAlign = 'left'; ctx.fillText(`Score ${score}`, 16, 16);
      ctx.font = '16px Nunito, system-ui, sans-serif'; ctx.fillText(`Level ${stage} of ${LEVELS} (${DIFFS[diff].name})   Best ${best}`, 16, 44);
      // How long until the next level: a bar along the top.
      const k = stageT / LEVEL_TIME, bw = Math.min(260, W - 32);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.roundRect(16, 68, bw, 10, 5); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.roundRect(16, 68, Math.max(10, bw * k), 10, 5); ctx.fill();
      ctx.fillStyle = '#f4f1ff'; ctx.font = '13px Nunito, system-ui, sans-serif'; ctx.fillText(`${Math.ceil(LEVEL_TIME - stageT)}s to ${stage < LEVELS ? 'Level ' + (stage + 1) : 'win!'}`, 16, 84);
      if (banner.t > 0) {                               // big "Level 2!" in the middle
        ctx.save(); ctx.globalAlpha = Math.min(1, banner.t * 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.min(64, W / 11)}px Bungee, Nunito, system-ui, sans-serif`; ctx.lineWidth = 8; ctx.strokeStyle = '#1b1530';
        ctx.strokeText(banner.text, W / 2, H * 0.38); ctx.fillStyle = '#ffd34d'; ctx.fillText(banner.text, W / 2, H * 0.38); ctx.restore();
      }
      ctx.textAlign = 'right'; ctx.font = '22px system-ui, sans-serif';
      ctx.fillText('❤️'.repeat(Math.max(lives, 0)), W - 16, 16);
    }
    ctx.restore();
  }

  // ---------- Screens ----------
  function show(id) { for (const p of ['scMenu', 'scOver', 'scPaused']) $(p).hidden = p !== id; $('scPause').hidden = state !== 'play'; }
  function toMenu() { state = 'menu'; reset(); $('scBest').textContent = best; $('scBank').textContent = bankNow(); show('scMenu'); }
  function start(d) {
    if (typeof d === 'string') firstStage = ORDER.indexOf(d) + 1;
    reset(); state = 'play'; show(null); last = performance.now();
  }
  function togglePause() {
    if (state === 'play') { state = 'paused'; show('scPaused'); }
    else if (state === 'paused') { state = 'play'; show(null); last = performance.now(); }
  }
  function gameOver(won) {
    state = 'over';
    if (won) { score += DIFFS[diff].points * 10; stars += 10; Celebrate.win(); }   // a bonus (and a party) for beating all 3 levels
    addCoins(stars);
    $('scOverTitle').textContent = won ? 'You beat all 3 levels! 🏆' : 'Game over';
    const newBest = score > best; if (newBest) { best = score; store.set('best', best); }
    $('scOverMode').textContent = DIFFS[diff].name;
    $('scOverScore').textContent = score; $('scOverCoins').textContent = stars; $('scOverBest').textContent = best;
    $('scNote').textContent = (won ? 'Jimmy is full! ' : `You reached Level ${stage}. `) + (newBest ? 'New best score! 🎉' : `You have ${bankNow()} coins to spend in Dodge and Weave.`);
    $('scBoardStatus').textContent = score > 0 ? 'Saving your score…' : '';
    show('scOver');
    if (score > 0) Leaderboard.submit('starcatcher', { name: playerName() || 'Mystery Catcher', score }).then(r => {
      $('scBoardStatus').textContent = r.ok ? (r.improved ? 'Your new best is on the leaderboard!' : `Your best is still ${r.best}.`)
        : r.reason === 'offline' ? '' : r.reason === 'readonly' ? 'You need more access to add scores. Ask the owner to give you access.' : 'Your score couldn’t be saved this time.';
    });
  }
  Leaderboard.watch('starcatcher', 5, rows => {
    const box = $('scBoard'), list = $('scBoardList');
    box.hidden = !rows; if (!rows) return;
    list.innerHTML = '';
    if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No scores yet. Be the first!'; list.appendChild(li); return; }
    rows.forEach((row, i) => {
      const li = document.createElement('li'); if (row.me) li.className = 'me';
      for (const [cls, text] of [['rank', i + 1], ['name', row.name || 'Mystery Catcher'], ['pts', row.score]]) {
        const span = document.createElement('span'); span.className = cls; span.textContent = text; li.appendChild(span);
      }
      list.appendChild(li);
    });
  });

  // ---------- Input ----------
  window.addEventListener('keydown', e => {
    if (!active) return;
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k === 'p' || k === 'escape') togglePause();
    else if ((k === 'enter' || k === ' ') && (state === 'menu' || state === 'over')) { e.preventDefault(); start(state === 'menu' ? 'easy' : undefined); }
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('pointermove', e => { pointerX = e.clientX - canvas.getBoundingClientRect().left; });
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); pointerX = e.clientX - canvas.getBoundingClientRect().left; });
  for (const d of Object.keys(DIFFS)) $('sc-' + d).onclick = () => start(d);
  $('scAgain').onclick = () => start();
  $('scResume').onclick = togglePause;
  $('scPause').onclick = togglePause;
  $('scMenuBtn').onclick = toMenu;
  for (const id of ['scLobby', 'scOverLobby', 'scPausedLobby']) $(id).onclick = () => window.Lobby && Lobby.show();

  // ---------- Loop ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { if (active) resize(); });
  function loop(t) {
    if (!active) return;
    const dt = Math.min((t - last) / 1000, 0.05); last = t;
    if (state === 'play') update(dt);
    if (shake > 0) shake -= dt;
    draw(t);
    requestAnimationFrame(loop);
  }
  window.StarCatcher = {
    open() { root.hidden = false; active = true; resize(); toMenu(); last = performance.now(); requestAnimationFrame(loop); },
    close() { if (state === 'play') state = 'paused'; active = false; root.hidden = true; for (const k in keys) keys[k] = false; },
    _step: (dt, n = 1) => { for (let i = 0; i < n && state === 'play'; i++) update(dt); },
    _lives: n => { lives = n; },
    _state: () => ({ state, diff, stage, stageT: stageT && +stageT.toFixed(1), items: items && items.length, score, lives, level, stars, x: player && player.x }),
  };
})();

// The win celebration every game shares: a giant bouncing rainbow "YOU WON!" and confetti raining
// down the whole screen for a few seconds. Games call Celebrate.win() when you win.
// It sits on top of everything but lets taps through, so the game's own buttons still work.
const Celebrate = (() => {
  const css = `
    #celebrate { position: fixed; inset: 0; z-index: 100; pointer-events: none; display: flex; align-items: center; justify-content: center; }
    #celebrate[hidden] { display: none !important; }
    #celebrate canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
    #celebrate .won { position: relative; display: flex; flex-wrap: wrap; justify-content: center; padding: 0 12px; text-align: center;
      font-family: Bungee, Nunito, system-ui, sans-serif; font-size: clamp(4.5rem, 24vw, 16rem); line-height: .95; column-gap: .35em;
      animation: cel-pop .7s cubic-bezier(.2, 1.6, .4, 1) both, cel-fade 4.6s ease-in forwards; }
    #celebrate .won span { display: inline-block; -webkit-text-stroke: .045em #1b1530; paint-order: stroke fill;
      text-shadow: 0 .06em 0 #1b1530, 0 0 .25em rgba(255,255,255,.7);
      animation: cel-bounce .9s ease-in-out infinite, cel-hue 1.2s linear infinite; }
    #celebrate .won .word { display: flex; white-space: nowrap; }
    @keyframes cel-pop { from { transform: scale(.1) rotate(-12deg); opacity: 0; } to { transform: scale(1) rotate(0); opacity: 1; } }
    @keyframes cel-fade { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes cel-bounce { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-.12em) rotate(4deg); } }
    @keyframes cel-hue { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
  `;
  const RAINBOW = ['#ff3b3b', '#ff8c1a', '#ffd23f', '#3ddc84', '#2fb8ff', '#6b6bff', '#c04bff', '#ff4fd8'];
  let root, canvas, ctx, bits = [], until = 0, raf = 0;

  function setup() {
    if (root) return;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    root = document.createElement('div'); root.id = 'celebrate'; root.hidden = true;
    canvas = document.createElement('canvas'); root.appendChild(canvas);
    document.body.appendChild(root);
    ctx = canvas.getContext('2d');
  }
  function win(text = 'YOU WON!') {
    setup();
    root.querySelector('.won')?.remove();
    // Every letter its own rainbow color, bouncing a beat after the one before.
    const words = document.createElement('div'); words.className = 'won';
    let i = 0;
    for (const w of text.split(' ')) {
      const word = document.createElement('div'); word.className = 'word';       // words only break between each other
      for (const ch of w) {
        const s = document.createElement('span'); s.textContent = ch;
        s.style.color = RAINBOW[i % RAINBOW.length];
        s.style.animationDelay = `${i * 0.08}s, ${i * -0.15}s`;
        word.appendChild(s); i++;
      }
      words.appendChild(word);
    }
    root.appendChild(words);
    root.hidden = false;
    // Confetti: bursts from both bottom corners, then a shower from the top.
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bits = [];
    const add = (x, y, vx, vy) => bits.push({ x, y, vx, vy, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, a: Math.random() * 6, spin: (Math.random() - 0.5) * 14,
      color: RAINBOW[Math.floor(Math.random() * RAINBOW.length)], wob: Math.random() * 6, round: Math.random() < 0.25 });
    for (let i = 0; i < 140; i++) {
      add(0, H, 300 + Math.random() * 700, -(700 + Math.random() * 700));
      add(W, H, -(300 + Math.random() * 700), -(700 + Math.random() * 700));
    }
    for (let i = 0; i < 160; i++) add(Math.random() * W, -20 - Math.random() * H, (Math.random() - 0.5) * 120, 80 + Math.random() * 200);
    until = performance.now() + 4700;
    let last = performance.now();
    cancelAnimationFrame(raf);
    const frame = t => {
      const dt = Math.min((t - last) / 1000, 0.05); last = t;
      ctx.clearRect(0, 0, W, H);
      for (const b of bits) {
        b.vy += 900 * dt; b.vx *= 1 - dt * 1.2; b.vy = Math.min(b.vy, 260);
        b.x += (b.vx + Math.sin(t / 300 + b.wob) * 40) * dt; b.y += b.vy * dt; b.a += b.spin * dt;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.scale(1, Math.abs(Math.cos(b.a * 1.3)) + 0.2);
        ctx.fillStyle = b.color;
        if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.w / 2, 0, 7); ctx.fill(); } else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
      if (t < until) raf = requestAnimationFrame(frame);
      else { root.hidden = true; ctx.clearRect(0, 0, W, H); }
    };
    raf = requestAnimationFrame(frame);
  }
  return { win };
})();

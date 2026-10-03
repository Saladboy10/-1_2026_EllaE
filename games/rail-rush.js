// Dodge and Weave: a 3D endless runner. Loaded by index.html after three.js and leaderboard.js.
const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('railrush.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('railrush.' + k, JSON.stringify(v)); } catch {} },
};

// ---------- Avatar options ----------
const CLOTHES = ['#ff4f7b', '#ffcf1a', '#33c27a', '#2f80ff', '#8a5cff', '#ff8a2a', '#00c2c7', '#1b1530', '#ffffff', '#7a8394'];
const OPTIONS = {
  outfit:    { label: 'Outfit', type: 'style', values: [['custom', 'My own'], ['alien', 'Alina', 50], ['silver', 'Quills', 50], ['gown', 'Big Bertha', 100], ['beehive', 'Marge Simpson', 100], ['merc', 'Red Renaldo', 100]] },
  skin:      { label: 'Skin', type: 'color', values: ['#ffdbc2', '#f1c19b', '#d9a07a', '#b97850', '#8d5534', '#5c3720'] },
  hair:      { label: 'Hair', type: 'style', values: [['none', 'None'], ['short', 'Short'], ['spiky', 'Spiky'], ['long', 'Long'], ['bun', 'Bun'], ['mohawk', 'Mohawk']] },
  hairColor: { label: 'Hair color', type: 'color', values: ['#1c1410', '#5a3a22', '#a8642c', '#e8c46a', '#e2e2e2', '#ff5fa2', '#3fa9ff', '#5cd65c'] },
  shirt:     { label: 'Top', type: 'color', values: CLOTHES },
  pants:     { label: 'Pants', type: 'color', values: CLOTHES },
  shoes:     { label: 'Shoes', type: 'color', values: CLOTHES },
  hat:       { label: 'Hat', type: 'style', values: [['none', 'None'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['headphones', 'Headphones'], ['crown', 'Crown', 150]] },
  hatColor:  { label: 'Hat & bag color', type: 'color', values: CLOTHES },
  extra:     { label: 'Extra', type: 'style', values: [['none', 'None'], ['glasses', 'Glasses'], ['backpack', 'Backpack'], ['cape', 'Cape', 100]] },
  pet:       { label: 'Pet', type: 'style', values: [['none', 'None'], ['pup', 'Milo', 50], ['fox', 'Tails', 50]] },
};
const DEFAULT_AVATAR = { outfit: 'custom', pet: 'none', skin: '#f1c19b', hair: 'short', hairColor: '#5a3a22', shirt: '#ff4f7b', pants: '#2f80ff',
  shoes: '#ffffff', hat: 'cap', hatColor: '#ffcf1a', extra: 'backpack' };

let runnerName = store.get('name', '');
let avatarCfg = { ...DEFAULT_AVATAR, ...store.get('avatar', {}) };
let owned = store.get('owned', []);
for (const [key, opt] of Object.entries(OPTIONS)) {
  if (opt.type !== 'style') continue;
  const v = opt.values.find(x => x[0] === avatarCfg[key]);
  if (!v || (v[2] && !owned.includes(key + ':' + v[0]))) avatarCfg[key] = DEFAULT_AVATAR[key];
}

// ---------- Emotes ----------
const ramp = (t, d, r = 0.25) => Math.max(0, Math.min(1, t / r, (d - t) / r));
const EMOTES = {
  wave: { name: 'Wave', dur: 2.2, pose(a, t, d) {
    const k = ramp(t, d);
    a.arms[1].rotation.z = k * (2.5 + Math.sin(t * 10) * 0.35); a.head.rotation.z = -0.15 * k;
  } },
  dance: { name: 'Dance', dur: 3.2, pose(a, t, d) {
    const k = ramp(t, d), b = t * 7;
    a.body.position.y = 0.95 + Math.abs(Math.sin(b)) * 0.12 * k; a.body.rotation.z = Math.sin(b) * 0.2 * k;
    a.arms[0].rotation.z = -k * (1.6 + Math.sin(b) * 0.9); a.arms[1].rotation.z = k * (1.6 - Math.sin(b) * 0.9);
    a.legs.forEach((l, i) => { l.rotation.x = Math.max(0, Math.sin(b + i * Math.PI)) * 0.8 * k; });
    a.head.rotation.z = Math.sin(b) * 0.2 * k;
  } },
  floss: { name: 'Floss', dur: 3, pose(a, t, d) {
    const k = ramp(t, d), f = Math.sin(t * 9), g = Math.cos(t * 9);
    a.arms.forEach((arm, i) => { arm.rotation.z = f * 0.7 * k; arm.rotation.x = (i ? 1 : -1) * g * 0.45 * k; });
    a.body.rotation.z = -f * 0.18 * k;
  } },
  spin: { name: 'Spin', dur: 1.8, price: 50, pose(a, t, d) {
    const k = ramp(t, d, 0.15), p = t / d, e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p);
    a.root.rotation.y = e * Math.PI * 4; a.arms[0].rotation.z = -1.4 * k; a.arms[1].rotation.z = 1.4 * k; a.legs[0].rotation.x = 0.3 * k;
  } },
  joy: { name: 'Jump for Joy', dur: 1.8, price: 75, pose(a, t, d) {
    const k = ramp(t, d, 0.15), h = Math.abs(Math.sin(t * Math.PI / 0.9));
    a.root.position.y += h * 0.9; a.arms[0].rotation.z = -2.8 * k; a.arms[1].rotation.z = 2.8 * k;
    a.legs[0].rotation.x = h * 0.9; a.legs[1].rotation.x = -h * 0.5;
  } },
  dab: { name: 'Dab', dur: 2, price: 100, pose(a, t, d) {
    const k = ramp(t, d, 0.2);
    a.arms[1].rotation.z = 2.3 * k; a.arms[0].rotation.x = 1.7 * k; a.arms[0].rotation.z = 1.0 * k;
    a.head.rotation.x = -0.35 * k; a.head.rotation.z = 0.35 * k; a.body.rotation.z = -0.1 * k;
  } },
};
const emoteOwned = id => !EMOTES[id].price || owned.includes('emote:' + id);
let emote = null, emoteT = 0;
function playEmote(id) { if (emoteOwned(id)) { emote = id; emoteT = 0; } }

// Buying takes two taps so nothing gets bought by accident.
let pendingBuy = null;
function buy(key, name, price) {
  if (owned.includes(key)) return true;
  if (bank < price) { toast(`${name} costs ${price} coins. You have ${bank}. Keep running!`); return false; }
  if (pendingBuy !== key) { pendingBuy = key; toast(`Tap ${name} again to buy it for ${price} coins.`); renderCustom(); return false; }
  pendingBuy = null; bank -= price; owned.push(key); store.set('bank', bank); store.set('owned', owned);
  toast(`You bought ${name}!`); refreshMenu(); return true;
}
let bank = store.get('bank', 0);
let best = store.get('best', 0);

// ---------- Three.js setup ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: true });
} catch (e) {
  $('#nogl').hidden = false; $('#menu').hidden = true;
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#8fd3ff');
scene.fog = new THREE.Fog('#8fd3ff', 35, 105);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 220);
scene.add(new THREE.HemisphereLight('#ffffff', '#6a7a5a', 0.85));
const sun = new THREE.DirectionalLight('#ffffff', 0.75); sun.position.set(6, 12, 4); scene.add(sun);

const matCache = {}, geoCache = {};
// While roundK > 0 (building a character), boxes come out with soft rounded edges and smooth shading.
let roundK = 0;
const mat = (c, opts) => {
  if (roundK && !opts) return matCache['soft' + c] || (matCache['soft' + c] = new THREE.MeshPhongMaterial({ color: c, shininess: 18, specular: '#2a2a2a' }));
  const key = c + (opts ? JSON.stringify(opts) : '');
  return matCache[key] || (matCache[key] = new THREE.MeshLambertMaterial({ color: c, ...opts }));
};
function roundedBoxGeo(w, h, d, k) {
  const S = 8, g = new THREE.BoxGeometry(w, h, d, S, S, S);
  const half = [w / 2, h / 2, d / 2], r = half.map(x => x * k), lim = half.map((x, a) => x - r[a]);
  const pos = g.attributes.position, nor = g.attributes.normal, v = [0, 0, 0], n = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    v[0] = pos.getX(i); v[1] = pos.getY(i); v[2] = pos.getZ(i);
    let len = 0;
    for (let a = 0; a < 3; a++) {
      const u = v[a] / half[a]; v[a] = Math.sign(u) * (1 - (1 - Math.abs(u)) ** 2) * half[a]; // bunch vertices toward the edges
      n[a] = (v[a] - Math.max(-lim[a], Math.min(lim[a], v[a]))) / r[a]; len += n[a] * n[a];
    }
    len = Math.sqrt(len) || 1;
    let nl = 0;
    for (let a = 0; a < 3; a++) { n[a] /= len; v[a] = Math.max(-lim[a], Math.min(lim[a], v[a])) + n[a] * r[a]; n[a] /= r[a]; nl += n[a] * n[a]; }
    nl = Math.sqrt(nl) || 1;
    pos.setXYZ(i, v[0], v[1], v[2]); nor.setXYZ(i, n[0] / nl, n[1] / nl, n[2] / nl);
  }
  return g;
}
const boxGeo = (w, h, d) => {
  const k = `${w}|${h}|${d}|${roundK}`;
  return geoCache[k] || (geoCache[k] = roundK ? roundedBoxGeo(w, h, d, roundK) : new THREE.BoxGeometry(w, h, d));
};
function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(boxGeo(w, h, d), typeof color === 'string' ? mat(color) : color);
  m.position.set(x || 0, y || 0, z || 0);
  if (parent) parent.add(m);
  return m;
}
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ---------- Environment ----------
const LANES = [-2.4, 0, 2.4];
const ground = new THREE.Mesh(new THREE.PlaneGeometry(9, 260), mat('#9b8c7a'));
ground.rotation.x = -Math.PI / 2; ground.position.z = -100; scene.add(ground);
for (const side of [-1, 1]) {
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(12, 260), mat('#c9c3bb'));
  walk.rotation.x = -Math.PI / 2; walk.position.set(side * 10.5, 0.01, -100); scene.add(walk);
  box(0.4, 0.7, 260, '#b1aaa1', side * 4.6, 0.35, -100, scene);
}
for (const x of LANES) for (const o of [-0.6, 0.6]) box(0.1, 0.14, 260, '#8d94a3', x + o, 0.13, -100, scene);

// Sleepers: one instanced mesh, slid by distance modulo spacing so it loops seamlessly.
const SLEEPER_GAP = 1.5, SLEEPER_ROWS = 110;
const sleepers = new THREE.InstancedMesh(boxGeo(1.8, 0.1, 0.36), mat('#6b4f3a'), SLEEPER_ROWS * 3);
{ const d = new THREE.Object3D(); let i = 0;
  for (let r = 0; r < SLEEPER_ROWS; r++) for (const x of LANES) { d.position.set(x, 0.05, 8 - r * SLEEPER_GAP); d.updateMatrix(); sleepers.setMatrixAt(i++, d.matrix); } }
const sleeperGroup = new THREE.Group(); sleeperGroup.add(sleepers); scene.add(sleeperGroup);

// Buildings: a 48-unit pattern repeated, so sliding by distance % 48 loops seamlessly.
const windowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#3a4566'; g.fillRect(10, 12, 18, 22); g.fillRect(36, 12, 18, 22);
  g.fillStyle = '#7d8bb3'; g.fillRect(10, 12, 6, 22); g.fillRect(36, 12, 6, 22);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
})();
const BUILD_P = 48;
const cityGroup = new THREE.Group(); scene.add(cityGroup);
const BUILD_COLORS = ['#f2a65a', '#e4d6a7', '#9bc1bc', '#ed6a5a', '#c9b6e4', '#f4f1bb', '#8fb8de'];
for (const side of [-1, 1]) {
  const pattern = []; let z = 0;
  while (z < BUILD_P) { const d = Math.min(rand(6, 11), BUILD_P - z); pattern.push({ z: z + d / 2, d, w: rand(5, 8), h: rand(5, 16), c: pick(BUILD_COLORS) }); z += d; }
  for (let rep = 0; rep < 5; rep++) for (const b of pattern) {
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d - 0.4);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * b.d / 3, uv.getY(i) * b.h / 3);
    const m = new THREE.Mesh(geo, mat(b.c, { map: windowTex }));
    m.position.set(side * (8 + b.w / 2), b.h / 2, 6 - rep * BUILD_P - b.z); cityGroup.add(m);
  }
  for (let rep = 0; rep < 15; rep++) { // lamp posts every 16 units
    const pz = 6 - rep * 16;
    box(0.15, 4, 0.15, '#4a4f5c', side * 5.2, 2, pz, cityGroup);
    box(0.9, 0.15, 0.3, '#4a4f5c', side * 4.85, 4, pz, cityGroup);
    box(0.4, 0.12, 0.3, '#fff3b0', side * 4.5, 3.9, pz, cityGroup);
  }
}

// ---------- Avatar ----------
let avatar;
// Outfits based on favourite characters. Each one recolours the base body and adds its own pieces.
const geo = (kind, ...args) => {
  const k = kind + args.join('|');
  return geoCache[k] || (geoCache[k] = new THREE[kind](...args));
};
function cone(r, h, color, x, y, z, parent, rx = 0, rz = 0) {
  const m = new THREE.Mesh(geo('ConeGeometry', r, h, 12), mat(color));
  m.position.set(x, y, z); m.rotation.set(rx, 0, rz); parent.add(m); return m;
}
function ball(r, color, x, y, z, parent, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo('SphereGeometry', r, 20, 14), mat(color));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
}
function tube(rTop, rBottom, h, color, x, y, z, parent) {
  const m = new THREE.Mesh(geo('CylinderGeometry', rTop, rBottom, h, 24), mat(color));
  m.position.set(x, y, z); parent.add(m); return m;
}
const COSTUMES = {
  merc: {
    face: false,
    parts: { skin: '#c8202a', shirt: '#c8202a', sleeve: '#c8202a', hand: '#1f1f24', pants: '#c8202a', shoes: '#c8202a' },
    decorate({ head, body, arms, legs, Y }) {
      const K = '#1f1f24';
      [-1, 1].forEach((s, i) => {
        box(0.2, 0.17, 0.02, K, s * 0.12, 0.33, -0.275, head).rotation.z = -s * 0.25;
        box(0.09, 0.05, 0.025, '#ffffff', s * 0.12, 0.33, -0.28, head).rotation.z = -s * 0.25;
        box(0.3, 0.2, 0.46, K, s * 0.4, Y(1.5), 0, body);
        box(0.07, 0.7, 0.44, K, s * 0.35, Y(1.18), 0, body);
        box(0.15, 0.17, 0.1, '#8a5a32', s * 0.28, Y(0.84), -0.25, body);
        box(0.24, 0.08, 0.26, K, 0, -0.36, 0, arms[i]);
        box(0.3, 0.06, 0.32, K, 0, -0.22, 0, legs[i]);
        const sword = new THREE.Group(); sword.position.set(s * 0.1, Y(1.25), 0.25); sword.rotation.z = s * 0.45; body.add(sword);
        box(0.06, 0.85, 0.06, '#2b2b30', 0, 0, 0, sword);
        box(0.05, 0.3, 0.05, '#c8202a', 0, 0.55, 0, sword);
      });
      box(0.78, 0.12, 0.46, '#7a5230', 0, Y(0.84), 0, body);
      box(0.15, 0.15, 0.03, '#c8202a', 0, Y(0.84), -0.245, body);
      box(0.04, 0.15, 0.035, K, 0, Y(0.84), -0.25, body);
      box(0.07, 1.0, 0.45, K, 0, Y(1.18), 0, body).rotation.z = 0.7;
    },
  },
  pup: {
    face: false,
    parts: { skin: '#e9a55c', shirt: '#e9a55c', sleeve: '#e9a55c', hand: '#f6dcb0', pants: '#e9a55c', shoes: '#f6dcb0' },
    decorate({ head, body, Y }) {
      const O = '#e9a55c', C = '#f6dcb0';
      for (const s of [-1, 1]) {
        box(0.07, 0.07, 0.02, '#2a1a14', s * 0.12, 0.36, -0.275, head);
        cone(0.11, 0.24, O, s * 0.17, 0.66, 0, head, 0, -s * 0.25);
        box(0.08, 0.32, 0.42, C, s * 0.3, 0.2, 0, head);
      }
      box(0.28, 0.18, 0.16, C, 0, 0.18, -0.33, head);
      box(0.11, 0.08, 0.05, '#2a1a14', 0, 0.24, -0.42, head);
      box(0.08, 0.07, 0.04, '#f07a8a', 0, 0.08, -0.38, head);
      ball(0.36, C, 0, Y(1.48), -0.04, body, 1.15, 0.6, 0.85);
      ball(0.24, O, 0, Y(1.1), 0.32, body, 1, 1.2, 1);
      ball(0.17, C, 0, Y(1.36), 0.4, body);
    },
  },
  gown: {
    parts: { skin: '#8a5a3c', shirt: '#f2b53a', sleeve: '#8a5a3c', hand: '#f2b53a', pants: '#8a5a3c', shoes: '#f2b53a' },
    decorate({ head, body, arms, Y }) {
      const G = '#f2b53a', L = '#f8cd6a', H = '#16100c', GOLD = '#e0b030';
      box(0.75, 0.16, 0.43, '#8a5a3c', 0, Y(1.5), 0, body);
      box(0.8, 0.1, 0.46, L, 0, Y(1.41), 0, body);
      tube(0.36, 0.85, 1.0, G, 0, Y(0.48), 0, body);
      tube(0.5, 0.62, 0.12, L, 0, Y(0.72), 0, body);
      tube(0.74, 0.84, 0.1, L, 0, Y(0.22), 0, body);
      for (const arm of arms) box(0.3, 0.16, 0.32, L, 0, -0.02, 0, arm);
      box(0.62, 0.2, 0.6, H, 0, 0.62, 0.02, head);
      box(0.62, 0.95, 0.14, H, 0, 0.15, 0.3, head);
      box(0.64, 0.05, 0.62, GOLD, 0, 0.66, 0.01, head);
      for (const s of [-1, 1]) {
        box(0.08, 0.65, 0.45, H, s * 0.3, 0.3, 0.05, head);
        box(0.05, 0.07, 0.05, GOLD, s * 0.29, 0.14, -0.08, head);
      }
    },
  },
  alien: {
    face: false, thin: true, dance: true,
    parts: { skin: '#8ee04a', shirt: '#8ee04a', sleeve: '#8ee04a', hand: '#8ee04a', pants: '#8ee04a', shoes: '#7bcf3a' },
    decorate({ head }) {
      head.scale.set(1.1, 1.25, 1.05);
      for (const s of [-1, 1]) {
        box(0.17, 0.22, 0.02, '#101410', s * 0.13, 0.33, -0.275, head).rotation.z = -s * 0.45;
        box(0.04, 0.04, 0.025, '#ffffff', s * 0.15, 0.38, -0.28, head);
      }
      box(0.06, 0.02, 0.02, '#2c5a18', 0, 0.12, -0.275, head);
    },
  },
  beehive: {
    face: false, tall: 1.1,
    parts: { skin: '#ffd521', shirt: '#c9e08a', sleeve: '#ffd521', hand: '#ffd521', pants: '#ffd521', shoes: '#e0402c' },
    decorate({ head, body, Y }) {
      const B = '#2f5bd6';
      box(0.75, 0.12, 0.43, '#ffd521', 0, Y(1.52), 0, body);
      box(0.72, 0.45, 0.44, '#c9e08a', 0, Y(0.6), 0, body);
      for (let i = 0; i < 7; i++) { const a = (i - 3) / 3 * 1.2; ball(0.055, '#d9443a', Math.sin(a) * 0.23, Y(1.6), -Math.cos(a) * 0.2, body); }
      box(0.58, 0.18, 0.58, B, 0, 0.6, 0.02, head);
      box(0.58, 0.3, 0.1, B, 0, 0.42, 0.26, head);
      tube(0.3, 0.28, 1.0, B, 0, 1.15, 0, head);
      ball(0.3, B, 0, 1.65, 0, head);
      for (const s of [-1, 1]) {
        const eye = tube(0.11, 0.11, 0.03, '#ffffff', s * 0.12, 0.35, -0.29, head); eye.rotation.x = Math.PI / 2;
        box(0.04, 0.04, 0.02, '#111111', s * 0.12, 0.35, -0.31, head);
      }
      box(0.12, 0.03, 0.02, '#8a2f3a', 0, 0.15, -0.275, head);
    },
  },
  silver: {
    face: false, tall: 0.3,
    parts: { skin: '#e6eaf0', shirt: '#e6eaf0', sleeve: '#e6eaf0', hand: '#ffffff', pants: '#e6eaf0', shoes: '#ffffff' },
    decorate({ head, body, arms, legs, Y }) {
      const W = '#e6eaf0';
      box(0.32, 0.2, 0.08, '#f2c99a', 0, 0.17, -0.29, head);
      box(0.07, 0.05, 0.04, '#1b1530', 0, 0.24, -0.34, head);
      for (const s of [-1, 1]) {
        box(0.15, 0.18, 0.02, '#ffffff', s * 0.12, 0.35, -0.28, head);
        box(0.07, 0.1, 0.025, '#e0b020', s * 0.11, 0.35, -0.285, head);
        box(0.03, 0.05, 0.03, '#111111', s * 0.11, 0.35, -0.29, head);
        cone(0.08, 0.18, W, s * 0.2, 0.62, 0.08, head, 0, -s * 0.3);
      }
      for (let i = -2; i <= 2; i++) cone(0.11, 0.6, W, i * 0.1, 0.7, -0.1, head, -0.5, -i * 0.35);
      for (const i of [-1, 0, 1]) cone(0.13, 0.65, W, i * 0.18, 0.35, 0.3, head, 2.0, -i * 0.3);
      cone(0.16, 0.35, '#ffffff', 0, Y(1.42), -0.22, body, Math.PI, 0);
      for (const arm of arms) {
        box(0.27, 0.09, 0.29, '#e8a020', 0, -0.38, 0, arm);
        box(0.1, 0.1, 0.02, '#3ff0f0', 0, -0.55, -0.12, arm);
      }
      for (const leg of legs) {
        box(0.32, 0.05, 0.44, '#3fd6e0', 0, -0.69, -0.05, leg);
        box(0.32, 0.04, 0.44, '#e8a020', 0, -0.64, -0.05, leg);
      }
    },
  },
};

function buildPet(type) {
  if (!type || type === 'none') return null;
  const g = new THREE.Group(), legs = [];
  const pup = type === 'pup';
  const main = pup ? '#e9a55c' : '#f5b82e', light = pup ? '#f6dcb0' : '#ffffff';
  box(0.32, 0.3, 0.5, main, 0, 0.36, 0, g);
  box(0.32, 0.3, 0.3, main, 0, 0.58, -0.32, g);
  box(pup ? 0.14 : 0.22, 0.11, 0.1, light, 0, 0.52, -0.5, g);
  box(0.06, 0.05, 0.03, '#2a1a14', 0, 0.55, -0.56, g);
  for (const s of [-1, 1]) {
    box(0.06, 0.07, 0.02, pup ? '#111111' : '#2f80ff', s * 0.08, 0.63, -0.475, g);
    cone(pup ? 0.06 : 0.08, pup ? 0.13 : 0.22, main, s * 0.1, pup ? 0.78 : 0.84, -0.3, g, 0, -s * 0.25);
  }
  if (pup) {
    ball(0.22, light, 0, 0.42, -0.2, g, 1, 1, 0.8);
    ball(0.16, light, 0, 0.6, 0.25, g);
  } else {
    box(0.2, 0.22, 0.05, light, 0, 0.36, -0.25, g);
    for (const s of [-1, 1]) {
      const tail = new THREE.Group(); tail.position.set(s * 0.08, 0.4, 0.24); tail.rotation.set(-0.4, s * 0.35, 0); g.add(tail);
      box(0.12, 0.12, 0.45, main, 0, 0, 0.22, tail);
      box(0.13, 0.13, 0.12, light, 0, 0, 0.45, tail);
    }
  }
  for (const [x, z] of [[-0.1, -0.15], [0.1, -0.15], [-0.1, 0.15], [0.1, 0.15]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.22, z); g.add(leg);
    box(0.09, 0.22, 0.09, pup ? light : main, 0, -0.11, 0, leg); legs.push(leg);
  }
  g.position.set(-0.95, 0, 0.5);
  return { group: g, legs };
}

function buildAvatar(c) {
  roundK = 0.8;
  try { return buildRunner(c); } finally { roundK = 0; }
}
function buildRunner(c) {
  const costume = COSTUMES[c.outfit];
  const P = costume ? costume.parts : { skin: c.skin, shirt: c.shirt, sleeve: c.shirt, hand: c.skin, pants: c.pants, shoes: c.shoes };
  const t = costume && costume.thin ? 0.55 : 1, tw = t < 1 ? 0.44 : 0.74;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.95; root.add(body);
  const Y = y => y - 0.95;
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * tw * 0.24, Y(0.8), 0); body.add(hip);
    box(0.28 * t, 0.72, 0.3 * t, P.pants, 0, -0.36, 0, hip);
    box(0.3 * t, 0.14, 0.42, P.shoes, 0, -0.74, -0.05, hip);
    legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(s * (tw / 2 + 0.125 * t), Y(1.52), 0); body.add(sh);
    box(0.25 * t, 0.36, 0.28 * t, P.sleeve, 0, -0.15, 0, sh);
    box(0.2 * t, 0.4, 0.22 * t, P.hand, 0, -0.52, 0, sh);
    arms.push(sh);
  }
  box(tw, 0.78, t < 1 ? 0.3 : 0.42, P.shirt, 0, Y(1.18), 0, body);
  const head = new THREE.Group(); head.position.y = Y(1.58); body.add(head);
  box(0.54, 0.54, 0.54, P.skin, 0, 0.29, 0, head);
  if (!costume || costume.face !== false) {
    for (const s of [-1, 1]) box(0.08, 0.11, 0.02, '#1b1530', s * 0.12, 0.33, -0.275, head);
    box(0.16, 0.035, 0.02, '#8a2f3a', 0, 0.17, -0.275, head);
  }

  let cape = null;
  if (costume) {
    costume.decorate({ head, body, arms, legs, Y });
  } else {
    const hc = c.hairColor;
    if (c.hair === 'short' || c.hair === 'long' || c.hair === 'bun') {
      box(0.58, 0.14, 0.58, hc, 0, 0.61, 0, head);
      box(0.58, 0.34, 0.1, hc, 0, 0.43, 0.25, head);
      box(0.58, 0.08, 0.12, hc, 0, 0.52, -0.25, head);
    }
    if (c.hair === 'long') {
      box(0.6, 0.75, 0.12, hc, 0, 0.2, 0.28, head);
      for (const s of [-1, 1]) box(0.07, 0.5, 0.48, hc, s * 0.3, 0.33, 0.04, head);
    }
    if (c.hair === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat(hc)); bun.position.set(0, 0.74, 0.16); head.add(bun);
    }
    const hatted = c.hat !== 'none' && c.hat !== 'headphones';
    if (c.hair === 'spiky' || (c.hair === 'mohawk' && hatted)) box(0.56, 0.08, 0.56, hc, 0, 0.58, 0, head);
    if (c.hair === 'spiky' && !hatted) {
      const cone = new THREE.ConeGeometry(0.13, 0.32, 4);
      for (const [x, z] of [[-0.16, -0.12], [0.16, -0.12], [0, 0], [-0.16, 0.16], [0.16, 0.16]]) {
        const m = new THREE.Mesh(cone, mat(hc)); m.position.set(x, 0.75, z); head.add(m);
      }
    }
    if (c.hair === 'mohawk' && !hatted) box(0.12, 0.26, 0.56, hc, 0, 0.68, 0.02, head);
  
    const hat = c.hatColor;
    if (c.hat === 'cap') {
      box(0.6, 0.17, 0.6, hat, 0, 0.64, 0, head);
      box(0.52, 0.04, 0.3, hat, 0, 0.57, -0.42, head);
    } else if (c.hat === 'beanie') {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hat));
      b.position.y = 0.5; b.scale.y = 0.9; head.add(b);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat('#ffffff')); pom.position.y = 0.83; head.add(pom);
    } else if (c.hat === 'headphones') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.045, 6, 16, Math.PI), mat(hat)); band.position.y = 0.3; head.add(band);
      for (const s of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 12), mat(hat));
        cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.31, 0.3, 0); head.add(cup);
      }
    } else if (c.hat === 'crown') {
      const gold = mat('#ffcf1a', { emissive: '#5a4000' });
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.14, 10), gold); ring.position.y = 0.66; head.add(ring);
      const cone = new THREE.ConeGeometry(0.07, 0.2, 4);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const m = new THREE.Mesh(cone, gold); m.position.set(Math.sin(a) * 0.21, 0.83, Math.cos(a) * 0.21); head.add(m); }
      const gem = box(0.08, 0.08, 0.02, '#ff4f7b', 0, 0.66, -0.275, head);
    }
  
    if (c.extra === 'glasses') {
      for (const s of [-1, 1]) { box(0.19, 0.13, 0.03, '#1b1530', s * 0.13, 0.33, -0.285, head); box(0.13, 0.08, 0.035, '#7fd3ff', s * 0.13, 0.33, -0.29, head); }
      box(0.08, 0.03, 0.03, '#1b1530', 0, 0.35, -0.285, head);
    } else if (c.extra === 'backpack') {
      box(0.58, 0.62, 0.24, hat, 0, Y(1.2), 0.33, body);
      box(0.4, 0.22, 0.08, '#1b1530', 0, Y(1.05), 0.47, body);
    } else if (c.extra === 'cape') {
      cape = new THREE.Group(); cape.position.set(0, Y(1.52), 0.24); body.add(cape);
      box(0.7, 1.0, 0.05, '#d62f4f', 0, -0.5, 0, cape);
    }
  }
  const pet = buildPet(c.pet);
  if (pet) root.add(pet.group);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.12;
  return { root, body, legs, arms, head, cape, shadow, pet, tall: (costume && costume.tall) || 0, dance: !!(costume && costume.dance) };
}
function rebuildAvatar() {
  const prev = avatar;
  avatar = buildAvatar(avatarCfg);
  if (prev) { avatar.root.position.copy(prev.root.position); avatar.root.rotation.copy(prev.root.rotation); scene.remove(prev.root); scene.remove(prev.shadow); }
  scene.add(avatar.root); scene.add(avatar.shadow);
}
rebuildAvatar();

// ---------- Obstacles & coins ----------
const TRAIN_COLORS = ['#e94f4f', '#3a7bd5', '#f2b632', '#3cb371', '#8a5cff'];
const coinMat = mat('#ffcf1a', { emissive: '#6b4a00' });
const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 16);
const things = [];
function addThing(obj, kind, lane, z, len) {
  obj.position.x = LANES[lane]; obj.position.z = z;
  obj.userData = { kind, len }; scene.add(obj); things.push(obj);
}
function addObstacle(kind, lane, z) {
  const g = new THREE.Group();
  if (kind === 'train') {
    const len = Math.round(rand(9, 13)), col = pick(TRAIN_COLORS);
    box(2.1, 2.6, len, col, 0, 1.45, 0, g);
    box(2.14, 0.3, len, '#ffffff', 0, 1.0, 0, g);
    box(1.9, 0.2, len - 0.4, '#d7dbe2', 0, 2.85, 0, g);
    box(1.6, 0.85, 0.04, '#1f2a3a', 0, 2.0, len / 2 + 0.01, g);
    for (const s of [-1, 1]) {
      box(0.28, 0.18, 0.04, '#fff3b0', s * 0.7, 0.75, len / 2 + 0.01, g);
      for (let wz = -len / 2 + 1.2; wz < len / 2 - 0.8; wz += 1.6) box(0.04, 0.7, 1.0, '#1f2a3a', s * 1.06, 2.0, wz, g);
    }
    addThing(g, 'train', lane, z, len);
  } else if (kind === 'low') {
    for (const s of [-1, 1]) box(0.14, 0.9, 0.14, '#4a4f5c', s * 0.9, 0.45, 0, g);
    for (let i = 0; i < 5; i++) box(0.4, 0.34, 0.16, i % 2 ? '#ffffff' : '#ff4f7b', -0.8 + i * 0.4, 0.72, 0, g);
    addThing(g, 'low', lane, z, 0.3);
  } else {
    for (const s of [-1, 1]) box(0.14, 2.5, 0.14, '#4a4f5c', s * 0.95, 1.25, 0, g);
    for (let i = 0; i < 6; i++) box(0.35, 0.6, 0.16, i % 2 ? '#1b1530' : '#ffcf1a', -0.875 + i * 0.35, 2.05, 0, g);
    addThing(g, 'high', lane, z, 0.3);
  }
}
function addCoin(lane, z, y) {
  const m = new THREE.Mesh(coinGeo, coinMat); m.rotation.x = Math.PI / 2; m.position.y = y;
  addThing(m, 'coin', lane, z, 0);
}
let prevSafe = 1;
function spawnRow(z) {
  const safe = Math.max(0, Math.min(2, prevSafe + Math.floor(Math.random() * 3) - 1)); prevSafe = safe;
  const types = [0, 1, 2].map(l => {
    const r = Math.random();
    if (l === safe) return r < 0.35 ? (r < 0.17 ? 'low' : 'high') : null;
    return r < 0.45 ? 'train' : r < 0.6 ? 'low' : r < 0.75 ? 'high' : null;
  });
  types.forEach((t, l) => t && addObstacle(t, l, z));
  if (types[safe] === 'low') for (let i = -2; i <= 2; i++) addCoin(safe, z + i * 1.5, 1 + 1.6 * Math.cos(i / 2.5 * Math.PI / 2));
  else if (Math.random() < 0.8) for (let i = 0; i < 5; i++) addCoin(safe, z + 3 + i * 1.8, types[safe] === 'high' ? 0.55 : 1);
}
function clearThings() { for (const t of things) scene.remove(t); things.length = 0; }

// ---------- Game state ----------
const SPAWN_Z = -105, G = 34, JUMP_V = 11.5, ROLL_TIME = 0.7, START_SPEED = 15, MAX_SPEED = 38;
let state = 'menu';
let dist = 0, runDist = 0, speed = 0, coinsRun = 0, lastRowZ = 0, rowGap = 20, animT = 0, shake = 0, deadT = 0;
const player = { lane: 1, x: 0, y: 0, vy: 0, roll: 0 };
const view = { x: 0, y: 0 };

function show(id) {
  for (const p of ['#menu', '#custom', '#over', '#paused', '#codes']) $(p).hidden = p !== id;
  $('#codesBtn').hidden = id !== '#menu';
  $('#hud').hidden = !(state === 'play' || state === 'pause' || state === 'over');
}
function refreshMenu() {
  renderMenuEmotes();
  $('#menuBest').textContent = best; $('#menuBank').textContent = bank; $('#customBank').textContent = bank;
}
function toMenu() {
  state = 'menu'; clearThings(); player.lane = 1; player.x = 0; player.y = 0; player.vy = 0; player.roll = 0;
  resetPose(); refreshMenu(); show('#menu');
}
function toCustom() { state = 'custom'; clearThings(); resetPose(); renderCustom(); show('#custom'); }
function startRun() {
  ensureAudio();
  state = 'play'; clearThings();
  Object.assign(player, { lane: 1, x: 0, y: 0, vy: 0, roll: 0 });
  runDist = 0; speed = START_SPEED; coinsRun = 0; lastRowZ = -22; rowGap = 20; prevSafe = 1; deadT = 0;
  resetPose(); avatar.root.rotation.y = 0;
  $('#score').textContent = '0'; $('#coins').textContent = '0';
  show(null);
  const tip = $('#tip'); tip.hidden = false; tip.style.opacity = 1;
  clearTimeout(tip._t); tip._t = setTimeout(() => { tip.style.opacity = 0; }, 2600);
}
function crash() {
  state = 'over'; deadT = 0; shake = 0.5; sfx('crash');
  const score = Math.floor(runDist);
  bank += coinsRun; store.set('bank', bank);
  const newBest = score > best; if (newBest) { best = score; store.set('best', best); }
  $('#overScore').textContent = score; $('#overCoins').textContent = coinsRun; $('#overBest').textContent = best;
  const who = runnerName ? `, ${runnerName}` : '';
  $('#overNote').textContent = newBest ? `New best score${who}!` : `Nice run${who}! You have ${bank} coins to spend on your avatar.`;
  $('#tip').hidden = true;
  setTimeout(() => { if (state === 'over') show('#over'); }, 900);
  submitScore(score);
}

// ---------- Secret codes ----------
// Codes are stored scrambled, so they can't be read from the page. To add one, scramble the
// code word in capitals with codeHash() and add a line here. A prize can give coins and/or
// unlock items ("outfit:merc", "pet:fox", "emote:dab", "hat:crown", "extra:cape").
// Each code works for only CODE_LIMIT players in total (a code can set its own `max`).
const CODE_LIMIT = 3;
const CODES = {
  '13190cf8': { coins: 200 },
  'ff0c36a1': { unlock: ['emote:spin', 'emote:joy', 'emote:dab'] },
};
function codeHash(text) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(text)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const codeInput = $('#codeInput');
function itemName(key) {
  const [group, id] = key.split(':');
  if (group === 'emote') return EMOTES[id] ? EMOTES[id].name : id;
  const v = OPTIONS[group] && OPTIONS[group].values.find(x => x[0] === id);
  return v ? v[1] : id;
}
function codeMessage(text, good) { const m = $('#codeMsg'); m.textContent = text; m.className = 'code-msg ' + (good ? 'good' : 'bad'); }
let redeeming = false;
async function redeemCode() {
  if (redeeming) return;
  const word = codeInput.value.trim().toUpperCase().replace(/\s+/g, '');
  if (!word) { codeMessage('Type a code first.', false); return; }
  const id = codeHash(word), prize = CODES[id];
  if (!prize) { codeMessage('That code doesn’t work. Check the spelling!', false); return; }
  if (owned.includes('code:' + id)) { codeMessage('You already used that code.', false); return; }
  const max = prize.max || CODE_LIMIT;
  redeeming = true; $('#redeemBtn').disabled = true; codeMessage('Checking your code…', true);
  const claim = await Leaderboard.claimCode(id, max);
  redeeming = false; $('#redeemBtn').disabled = false;
  if (!claim.ok) {
    const why = {
      'already': 'You already used that code.',
      'used-up': `Too late! ${max} players already used this code.`,
      'busy': 'Lots of people are trying this code. Try again in a moment.',
      'readonly': 'Only players with Contributor access can use codes. Ask the owner to share the game with you as a Contributor.',
      'error': 'Your code couldn’t be checked. Try again.',
    }[claim.reason];
    if (why) { codeMessage(why, false); if (claim.reason === 'already') { owned.push('code:' + id); store.set('owned', owned); } return; }
    // 'offline' (opened as a plain file): there's no shared record, so only the once-per-player rule applies.
  }
  const got = [];
  if (prize.coins) { bank += prize.coins; got.push(`${prize.coins} coins`); }
  for (const key of prize.unlock || []) { if (!owned.includes(key)) owned.push(key); got.push(itemName(key)); }
  owned.push('code:' + id);
  store.set('bank', bank); store.set('owned', owned);
  codeInput.value = '';
  const spots = claim.ok ? ` (${claim.used} of ${max} spots used)` : '';
  const list = got.length > 1 ? got.slice(0, -1).join(', ') + ' and ' + got[got.length - 1] : got[0];
  codeMessage(`Code worked! You got ${list}.${spots}`, true);
  sfx('coin'); refreshMenu();
}
$('#codesBtn').onclick = () => { codeMessage('', true); show('#codes'); codeInput.focus(); };
$('#redeemBtn').onclick = redeemCode;
$('#codesBackBtn').onclick = toMenu;

// ---------- Leaderboard ----------
let boardRows = null;
const outfitLabel = () => (OPTIONS.outfit.values.find(v => v[0] === avatarCfg.outfit && v[0] !== 'custom') || [])[1] || '';
function setBoardStatus(text) { $('#boardStatus').textContent = text; }
function submitScore(score) {
  setBoardStatus(score > 0 ? 'Saving your score…' : '');
  if (score <= 0) return;
  Leaderboard.submit('railrush', { name: runnerName || 'Mystery Runner', score, outfit: outfitLabel() }).then(r => {
    const nameHint = runnerName ? '' : ' Add your name in Avatar so friends know it’s you.';
    if (r.ok) setBoardStatus((r.improved ? 'Your new best is on the leaderboard!' : `Your best is still ${r.best}.`) + nameHint);
    else if (r.reason === 'readonly') setBoardStatus('Only players with Contributor access can add scores. Ask the owner to share it with you as a Contributor.');
    else if (r.reason === 'offline') setBoardStatus('');
    else setBoardStatus('Your score couldn’t be saved this time. Try another run.');
  });
}
function boardRow(row, rank) {
  const li = document.createElement('li'); if (row.me) li.className = 'me';
  for (const [cls, text] of [['rank', rank], ['name', row.name || 'Mystery Runner'], ['pts', row.score]]) {
    const span = document.createElement('span'); span.className = cls; span.textContent = text; li.appendChild(span);
  }
  return li;
}
function renderBoard() {
  const box = $('#overBoard'), list = $('#boardList');
  box.hidden = !boardRows;
  if (!boardRows) return;
  list.innerHTML = '';
  if (!boardRows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No scores yet. Be the first!'; list.appendChild(li); return; }
  boardRows.slice(0, 5).forEach((row, i) => list.appendChild(boardRow(row, i + 1)));
  const mine = boardRows.findIndex(r => r.me);
  if (mine >= 5) list.appendChild(boardRow(boardRows[mine], mine + 1));
}
Leaderboard.watch('railrush', 10, rows => { boardRows = rows; renderBoard(); });
function pause() { if (state === 'play') { state = 'pause'; show('#paused'); } }
function resume() { if (state === 'pause') { state = 'play'; show(null); } }

function resetPose() {
  const a = avatar; a.body.rotation.set(0, 0, 0); a.body.scale.set(1, 1, 1); a.body.position.y = 0.95;
}

// ---------- Input ----------
function move(dir) {
  if (state !== 'play') return;
  const next = Math.max(0, Math.min(2, player.lane + dir));
  if (next !== player.lane) { player.lane = next; sfx('swish'); }
}
function jump() {
  if (state !== 'play') return;
  if (player.y <= 0.001) { player.vy = JUMP_V; player.roll = 0; sfx('jump'); }
}
function roll() {
  if (state !== 'play') return;
  if (player.y > 0.001) player.vy = -22;
  player.roll = ROLL_TIME; sfx('roll');
}
window.addEventListener('keydown', e => {
  if (!active) return;
  if (e.target === nameInput) { if (e.key === 'Enter') nameInput.blur(); return; }
  if (e.target === codeInput) { if (e.key === 'Enter') redeemCode(); return; }
  const k = e.key.toLowerCase();
  if (['arrowleft', 'a'].includes(k)) move(-1);
  else if (['arrowright', 'd'].includes(k)) move(1);
  else if (['arrowup', 'w', ' '].includes(k)) { if (state === 'play') { jump(); e.preventDefault(); } }
  else if (['arrowdown', 's'].includes(k)) roll();
  else if (k === 'p' || k === 'escape') state === 'play' ? pause() : resume();
  else if (k === 'enter' && (state === 'menu' || state === 'over')) startRun();
  else if (/^[1-6]$/.test(k) && (state === 'menu' || state === 'custom')) playEmote(Object.keys(EMOTES)[+k - 1]);
});
let touchStart = null;
const app = $('#app');
$('#c').addEventListener('pointerdown', e => { touchStart = { x: e.clientX, y: e.clientY }; });
$('#c').addEventListener('pointermove', e => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else dy < 0 ? jump() : roll();
  touchStart = null;
});
window.addEventListener('pointerup', () => { touchStart = null; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

$('#playBtn').onclick = startRun;
$('#againBtn').onclick = startRun;
$('#customBtn').onclick = toCustom;
$('#overCustomBtn').onclick = toCustom;
$('#overMenuBtn').onclick = toMenu;
$('#doneBtn').onclick = toMenu;
$('#pauseBtn').onclick = () => state === 'play' ? pause() : resume();
$('#resumeBtn').onclick = resume;
$('#quitBtn').onclick = toMenu;
$('#randomBtn').onclick = () => {
  for (const [key, opt] of Object.entries(OPTIONS)) {
    const choices = opt.values.filter(v => opt.type === 'color' || !v[2] || owned.includes(key + ':' + v[0]));
    const v = pick(choices); avatarCfg[key] = opt.type === 'color' ? v : v[0];
  }
  store.set('avatar', avatarCfg); rebuildAvatar(); renderCustom();
};

// ---------- Customizer ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function renderCustom() {
  const wrap = $('#options'); wrap.innerHTML = '';
  for (const [key, opt] of Object.entries(OPTIONS)) {
    if (avatarCfg.outfit !== 'custom' && key !== 'outfit' && key !== 'pet') {
      if (key === 'skin') { const note = document.createElement('p'); note.className = 'hint'; note.textContent = 'This outfit sets your look. Pick “My own” to choose hair, clothes and hats yourself.'; wrap.appendChild(note); }
      continue;
    }
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend'); lg.textContent = opt.label; fs.appendChild(lg);
    const chips = document.createElement('div'); chips.className = 'chips'; fs.appendChild(chips);
    for (const v of opt.values) {
      const b = document.createElement('button'); b.type = 'button';
      let value, locked = false, price = 0, name = '';
      if (opt.type === 'color') {
        value = v; b.className = 'swatch'; b.style.setProperty('--c', v); b.setAttribute('aria-label', `${opt.label} ${v}`);
      } else {
        [value, name, price] = v; locked = !!price && !owned.includes(key + ':' + value);
        b.className = 'chip' + (locked ? ' locked' : '');
        b.innerHTML = locked ? `${pendingBuy === key + ':' + value ? 'Tap again to buy' : name} · <span class="coin"></span> ${price}` : name;
      }
      b.setAttribute('aria-pressed', String(avatarCfg[key] === value));
      b.onclick = () => {
        if (locked && !buy(key + ':' + value, name, price)) return;
        pendingBuy = null;
        avatarCfg[key] = value; store.set('avatar', avatarCfg); rebuildAvatar(); renderCustom();
      };
      chips.appendChild(b);
    }
    wrap.appendChild(fs);
  }
  const fs = document.createElement('fieldset');
  fs.innerHTML = '<legend>Emotes</legend><div class="chips"></div>';
  for (const [id, e] of Object.entries(EMOTES)) {
    const b = document.createElement('button'); b.type = 'button';
    const locked = !emoteOwned(id), key = 'emote:' + id;
    b.className = 'chip' + (locked ? ' locked' : '');
    b.innerHTML = locked ? `${pendingBuy === key ? 'Tap again to buy' : e.name} · <span class="coin"></span> ${e.price}` : e.name;
    b.onclick = () => {
      if (locked && !buy(key, e.name, e.price)) return;
      pendingBuy = null; playEmote(id); renderCustom();
    };
    fs.lastChild.appendChild(b);
  }
  wrap.appendChild(fs);
}
function renderMenuEmotes() {
  const bar = $('#menuEmotes'); bar.innerHTML = '';
  for (const [id, e] of Object.entries(EMOTES)) {
    if (!emoteOwned(id)) continue;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = e.name;
    b.onclick = () => playEmote(id);
    bar.appendChild(b);
  }
}

// ---------- Sound ----------
let actx = null, muted = false;
function ensureAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch {} }
function tone(f1, f2, dur, type = 'square', vol = 0.06) {
  if (!actx || muted) return;
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
}
function sfx(name) {
  if (name === 'coin') tone(988, 1760, 0.12, 'square', 0.04);
  else if (name === 'jump') tone(260, 620, 0.18);
  else if (name === 'roll') tone(400, 150, 0.15, 'triangle', 0.08);
  else if (name === 'swish') tone(500, 800, 0.06, 'triangle', 0.04);
  else if (name === 'crash') tone(180, 40, 0.5, 'sawtooth', 0.1);
}

// ---------- Update loop ----------
function update(dt) {
  const a = avatar;
  if (state === 'play') {
    speed = Math.min(MAX_SPEED, speed + 0.35 * dt);
    const dz = speed * dt; dist += dz; runDist += dz;
    for (const t of things) t.position.z += dz;
    lastRowZ += dz;
    while (lastRowZ - rowGap >= SPAWN_Z) { lastRowZ -= rowGap; spawnRow(lastRowZ); rowGap = rand(18, 26); }

    player.x += (LANES[player.lane] - player.x) * Math.min(1, dt * 15);
    if (player.y > 0 || player.vy > 0) {
      player.vy -= G * dt; player.y += player.vy * dt;
      if (player.y <= 0) { player.y = 0; player.vy = 0; }
    }
    if (player.roll > 0) player.roll = Math.max(0, player.roll - dt);
    const rolling = player.roll > 0;

    for (let i = things.length - 1; i >= 0; i--) {
      const t = things[i], u = t.userData;
      if (t.position.z - u.len / 2 > 10) { scene.remove(t); things.splice(i, 1); continue; }
      const dx = Math.abs(t.position.x - player.x), dzc = Math.abs(t.position.z);
      if (u.kind === 'coin') {
        t.rotation.z += dt * 4;
        if (dx < 0.9 && dzc < 0.8 && t.position.y > player.y - 0.4 && t.position.y < player.y + (rolling ? 1.2 : 2.1)) {
          scene.remove(t); things.splice(i, 1); coinsRun++; sfx('coin'); $('#coins').textContent = coinsRun;
        }
        continue;
      }
      if (dzc > u.len / 2 + 0.35) continue;
      if ((u.kind === 'train' && dx < 1.3) || (u.kind === 'low' && dx < 1.2 && player.y < 0.85) ||
          (u.kind === 'high' && dx < 1.2 && !rolling)) { crash(); break; }
    }
    $('#score').textContent = Math.floor(runDist);
  } else if (state === 'menu' || state === 'custom') {
    dist += 6 * dt;
  }

  // Avatar pose
  a.root.position.set(player.x, player.y, 0);
  a.shadow.position.x = player.x; const sh = Math.max(0.4, 1 - player.y / 3); a.shadow.scale.set(sh, sh, sh);
  if (state === 'over') {
    deadT += dt; const p = Math.min(1, deadT / 0.4);
    a.body.rotation.x = p * 1.4; a.body.position.y = 0.95 - p * 0.55;
    if (player.y > 0) player.y = Math.max(0, player.y - dt * 6);
  } else if (state !== 'pause') {
    const running = state === 'play';
    animT += dt * (running ? speed * 0.55 : state === 'menu' ? 9 : 2.5);
    const s = Math.sin(animT), amp = state === 'custom' ? 0.25 : 0.9;
    const air = running && player.y > 0.05, rolling = running && player.roll > 0;
    a.legs[0].rotation.x = air ? -0.7 : s * amp; a.legs[1].rotation.x = air ? 0.4 : -s * amp;
    a.arms[0].rotation.x = air ? 2.6 : -s * amp * 0.9; a.arms[1].rotation.x = air ? 2.6 : s * amp * 0.9;
    if (rolling) {
      const p = 1 - player.roll / ROLL_TIME;
      a.body.rotation.x = -p * Math.PI * 2; a.body.scale.set(0.8, 0.6, 0.8); a.body.position.y = 0.55;
    } else {
      a.body.rotation.x = running ? -0.12 : 0; a.body.scale.set(1, 1, 1);
      a.body.rotation.z = state === 'menu' && a.dance ? Math.sin(animT * 0.5) * 0.35 : 0;
      a.body.position.y = 0.95 + (state === 'custom' ? 0 : Math.abs(Math.cos(animT)) * 0.06);
    }
    if (a.pet) {
      a.pet.legs.forEach((l, i) => { l.rotation.x = Math.sin(animT * 1.2 + (i % 3 ? Math.PI : 0)) * 0.8 * amp; });
      a.pet.group.position.y = Math.abs(Math.sin(animT * 1.2)) * 0.08 * amp;
    }
    if (a.cape) a.cape.rotation.x = -(running ? 0.5 + speed * 0.01 : 0.2) - Math.sin(animT * 2) * 0.08;
    if (state === 'menu') a.root.rotation.y = Math.sin(performance.now() / 1600) * 0.5;
    else if (state === 'custom') a.root.rotation.y += dt * 0.7;
    for (const arm of a.arms) arm.rotation.z = 0;
    a.head.rotation.set(0, 0, 0);
    if (emote && (state === 'menu' || state === 'custom')) {
      const e = EMOTES[emote];
      emoteT += dt;
      if (emoteT >= e.dur) emote = null;
      else {
        a.body.rotation.set(0, 0, 0); a.body.position.y = 0.95; a.root.rotation.y = 0;
        for (const l of a.legs) l.rotation.x = 0;
        for (const arm of a.arms) arm.rotation.x = 0;
        e.pose(a, emoteT, e.dur);
      }
    } else emote = null;
  }

  sleeperGroup.position.z = dist % SLEEPER_GAP;
  cityGroup.position.z = dist % BUILD_P;

  // Camera: in front of the runner on menus, behind during a run.
  const front = state === 'menu' || state === 'custom';
  const narrow = app.clientWidth <= 760 && state === 'custom';
  const tall = avatar.tall;
  const tp = front ? new THREE.Vector3(0, (narrow ? 1.3 : 1.6) + tall * 0.5, (narrow ? -7 : -4.4) - tall * 1.6) : new THREE.Vector3(player.x * 0.6, 3.6, 6.8);
  const tl = front ? new THREE.Vector3(0, 1.1 + tall * 0.5, 0) : new THREE.Vector3(player.x * 0.6, 1.2, -8);
  const k = Math.min(1, dt * (front ? 3 : 5));
  camera.position.lerp(tp, k);
  camLook.lerp(tl, k);
  camera.lookAt(camLook);
  if (shake > 0 && !reducedMotion) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  shake = Math.max(0, shake - dt);

  // Shift the view so the avatar sits in the space a panel leaves open.
  let ox = 0, oy = 0;
  const w = app.clientWidth, h = app.clientHeight;
  const panel = state === 'custom' ? $('#custom') : state === 'menu' ? ($('#codes').hidden ? $('#menu') : $('#codes')) : null;
  if (panel && !panel.hidden) {
    const r = panel.getBoundingClientRect();
    if (state === 'custom' && w > 760) ox = (w - r.left) / 2; else oy = Math.max(0, (h - r.top) / 2 - h * 0.05);
  }
  view.x += (ox - view.x) * Math.min(1, dt * 6); view.y += (oy - view.y) * Math.min(1, dt * 6);
  camera.setViewOffset(w, h, view.x, view.y, w, h);
}
const camLook = new THREE.Vector3(0, 1.1, 0);
camera.position.set(0, 1.6, -4.4);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Name tag floats above the runner's head.
const nameInput = $('#runnerName'), nameTag = $('#nameTag'), tagPos = new THREE.Vector3();
nameInput.value = runnerName;
nameInput.addEventListener('input', () => { runnerName = nameInput.value.trim(); store.set('name', runnerName); });
function placeNameTag() {
  avatar.head.getWorldPosition(tagPos);
  tagPos.y += 0.85 + avatar.tall;
  tagPos.project(camera);
  const show = runnerName && state !== 'pause' && $('#over').hidden && tagPos.z < 1;
  nameTag.hidden = !show;
  if (!show) return;
  nameTag.textContent = runnerName;
  nameTag.style.left = ((tagPos.x + 1) / 2 * app.clientWidth) + 'px';
  nameTag.style.top = ((1 - tagPos.y) / 2 * app.clientHeight) + 'px';
}

function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
// The lobby opens and closes the game; while closed nothing updates or renders.
let active = false;
window.RailRush = {
  open() { active = true; last = performance.now(); toMenu(); },
  close() { active = false; nameTag.hidden = true; },
};
$('#lobbyLink').onclick = () => window.Lobby && Lobby.show();

function loop(t) {
  const dt = Math.min((t - last) / 1000, 0.05); last = t;
  if (active) {
    update(dt);
    placeNameTag();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}
toMenu();
requestAnimationFrame(loop);

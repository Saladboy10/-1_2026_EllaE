// Dodge and Weave: a 3D endless runner. Loaded by index.html after three.js and leaderboard.js.
const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('railrush.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('railrush.' + k, JSON.stringify(v)); } catch {} },
};

// ---------- Avatar options ----------
const CLOTHES = ['#ff4f7b', '#ffcf1a', '#33c27a', '#2f80ff', '#8a5cff', '#ff8a2a', '#00c2c7', '#1b1530', '#ffffff', '#7a8394'];
const OPTIONS = {
  outfit:    { label: 'Outfit', type: 'style', values: [['custom', 'My own'], ['alien', 'Alina', 50], ['silver', 'Quills', 50], ['gown', 'Big Bertha', 100], ['beehive', 'Marge Simpson', 100], ['merc', 'Red Renaldo', 100], ['straw', 'Luffy', 100], ['swords', 'Zoro', 100], ['deku', 'Deku', 100], ['denki', 'Denki', 100], ['uraraka', 'Uraraka', 100], ['allmight', 'All Might', 100], ['shoto', 'Shoto', 100], ['aizawa', 'Aizawa', 100], ['messi', 'Messi', 50]] },
  skin:      { label: 'Skin', type: 'color', values: ['#ffdbc2', '#f1c19b', '#d9a07a', '#b97850', '#8d5534', '#5c3720'] },
  hair:      { label: 'Hair', type: 'style', values: [['none', 'None'], ['short', 'Short'], ['spiky', 'Spiky'], ['long', 'Long'], ['bun', 'Bun'], ['mohawk', 'Mohawk']] },
  hairColor: { label: 'Hair color', type: 'color', values: ['#1c1410', '#5a3a22', '#a8642c', '#e8c46a', '#e2e2e2', '#ff5fa2', '#3fa9ff', '#5cd65c'] },
  expression: { label: 'Expression', type: 'style', values: [['normal', 'Normal'], ['happy', 'Happy'], ['angry', 'Angry'], ['sad', 'Sad'], ['surprised', 'Surprised'], ['wink', 'Wink'], ['cool', 'Cool']] },
  mouth:     { label: 'Mouth', type: 'style', values: [['smile', 'Smile'], ['grin', 'Big grin'], ['teeth', 'Gritted teeth'], ['smirk', 'Smirk'], ['shout', 'Shout'], ['o', 'Surprised'], ['frown', 'Frown'], ['tongue', 'Tongue out'], ['line', 'Straight']] },
  eyes:      { label: 'Eyes', type: 'color', values: ['#7a3b2e', '#c2264f', '#3a6fd8', '#2f9e5a', '#8a5cff', '#e0b020', '#5a3a22', '#1c1410'] },
  shirt:     { label: 'Top', type: 'color', values: CLOTHES },
  pants:     { label: 'Pants', type: 'color', values: CLOTHES },
  shoes:     { label: 'Shoes', type: 'color', values: CLOTHES },
  hat:       { label: 'Hat', type: 'style', values: [['none', 'None'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['headphones', 'Headphones'], ['crown', 'Crown', 150]] },
  hatColor:  { label: 'Hat & bag color', type: 'color', values: CLOTHES },
  extra:     { label: 'Extra', type: 'style', values: [['none', 'None'], ['glasses', 'Glasses'], ['backpack', 'Backpack'], ['cape', 'Cape', 100]] },
  pet:       { label: 'Pet', type: 'style', values: [['none', 'None'], ['pup', 'Milo', 50], ['fox', 'Tails', 50], ['dragon', 'Ember', 75]] },
};
const DEFAULT_AVATAR = { outfit: 'custom', pet: 'none', expression: 'normal', mouth: 'smile', eyes: '#7a3b2e', skin: '#f1c19b', hair: 'short', hairColor: '#5a3a22', shirt: '#ff4f7b', pants: '#2f80ff',
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
const mix = (from, to, w) => from + (to - from) * w;
const smooth = (start, end, t) => { const u = Math.max(0, Math.min(1, (t - start) / (end - start))); return u * u * (3 - 2 * u); };
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
  duggee: { name: 'The Duggee', dur: 3.4, price: 50, pose(a, t, d) {
    const k = ramp(t, d), b = t * 6, sw = Math.sin(b);
    a.body.rotation.x = 0.14 * k; a.body.rotation.z = sw * 0.18 * k;
    a.body.position.y = 0.95 - Math.abs(sw) * 0.08 * k;
    a.arms[1].rotation.z = k * (3.3 + sw * 0.25); a.arms[1].rotation.x = k * (0.25 + sw * 0.2);
    a.arms[0].rotation.z = -k * (0.5 + sw * 0.3); a.arms[0].rotation.x = k * Math.cos(b) * 0.6;
    a.legs.forEach((l, i) => { l.rotation.x = Math.max(0, Math.sin(b + i * Math.PI)) * 0.4 * k; });
    a.head.rotation.z = -sw * 0.15 * k; a.head.rotation.x = 0.1 * k;
  } },
  moonwalk: { name: 'Moonwalk', dur: 4, price: 50, pose(a, t, d) {
    // Slide backwards for most of it, then glide back to the start.
    // Turned side-on so the slide shows.
    const k = ramp(t, d), p = t / d, s = Math.sin(t * 7);
    a.root.rotation.y = Math.PI / 2 * k;
    a.root.position.x += 1.4 * (p < 0.8 ? p / 0.8 : (1 - p) / 0.2);
    a.legs[0].rotation.x = 0.35 * s * k; a.legs[1].rotation.x = -0.35 * s * k;
    a.body.rotation.x = -0.08 * k; a.body.position.y = 0.95 - Math.abs(s) * 0.04 * k;
    a.arms[0].rotation.x = -0.25 * s * k; a.arms[1].rotation.x = 0.25 * s * k;
    a.arms[0].rotation.z = -0.15 * k; a.arms[1].rotation.z = 0.15 * k;
    a.head.rotation.z = 0.12 * k;
  } },
  worm: { name: 'The Worm', dur: 3.6, price: 50, pose(a, t, d) {
    // Drop to the floor face down, then ripple like a worm.
    const k = ramp(t, d, 0.4), b = t * 6;
    a.root.rotation.y = Math.PI / 2 * k; // side-on so the wiggle shows
    a.body.rotation.x = (-Math.PI / 2 + Math.sin(b) * 0.25) * k;
    a.body.position.y = 0.95 - k * (0.6 - Math.abs(Math.sin(b)) * 0.18);
    a.legs.forEach(l => { l.rotation.x = (Math.sin(b + 1.2) * 0.5 - 0.2) * k; });
    a.arms.forEach(arm => { arm.rotation.x = (1.3 + Math.sin(b) * 0.35) * k; });
    a.head.rotation.x = (0.5 + Math.sin(b - 0.8) * 0.2) * k;
  } },
  ransom: { name: 'Ransom', dur: 3.4, price: 50, pose(a, t, d) {
    // Bouncy arm rolls in front, nodding to the beat.
    const k = ramp(t, d), b = t * 7, s = Math.sin(b), c = Math.cos(b);
    a.body.position.y = 0.95 - Math.abs(s) * 0.07 * k; a.body.rotation.z = Math.sin(b / 2) * 0.12 * k;
    a.arms[0].rotation.x = (1.3 + s * 0.4) * k; a.arms[0].rotation.z = (-0.3 + c * 0.3) * k;
    a.arms[1].rotation.x = (1.3 - s * 0.4) * k; a.arms[1].rotation.z = (0.3 + c * 0.3) * k;
    a.legs.forEach((l, i) => { l.rotation.x = Math.max(0, Math.sin(b / 2 + i * Math.PI)) * 0.35 * k; });
    a.head.rotation.x = s * 0.12 * k;
  } },
  thatway: { name: 'I Want It That Way', dur: 4.2, price: 50, pose(a, t, d) {
    // Hand on heart, reach out to the crowd, then point to the sky.
    const k = ramp(t, d), toReach = smooth(1.2, 1.6, t), toSky = smooth(2.6, 3.0, t);
    a.arms[1].rotation.x = k * mix(mix(1.6, 1.4, toReach), 0.3, toSky);
    a.arms[1].rotation.z = k * mix(mix(-0.7, 0.5, toReach), 2.9, toSky);
    a.arms[0].rotation.x = k * mix(1.2 * toReach, 0, toSky);
    a.arms[0].rotation.z = k * mix(-0.4 * toReach, -0.2, toSky);
    a.head.rotation.x = k * mix(mix(-0.15, 0, toReach), 0.3, toSky);
    a.body.rotation.z = Math.sin(t * 2.5) * 0.1 * k;
    a.legs[1].rotation.x = 0.25 * toReach * k;
  } },
};
const emoteOwned = id => !EMOTES[id].price || owned.includes('emote:' + id);
let emote = null, emoteT = 0;
function playEmote(id, tryingOut) { if (tryingOut || emoteOwned(id)) { emote = id; emoteT = 0; } }

// Buying takes two taps so nothing gets bought by accident.
let pendingBuy = null;
// The first tap on something locked lets you try it (wear it, or watch the emote); the second tap buys it.
function buy(key, name, price, tryIt) {
  if (owned.includes(key)) return true;
  if (pendingBuy !== key) {
    pendingBuy = key; tryIt();
    toast(bank >= price ? `Trying ${name}. Tap it again to buy it for ${price} coins.` : `Trying ${name}. It costs ${price} coins and you have ${bank}.`);
    renderCustom(); return false;
  }
  if (bank < price) { toast(`${name} costs ${price} coins. You have ${bank}. Play any game to collect more!`); return false; }
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
// Characters use anime-style toon shading: flat color with one crisp shadow band.
const toonRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.LuminanceFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
const mat = (c, opts) => {
  if (roundK && !opts) return matCache['toon' + c] || (matCache['toon' + c] = new THREE.MeshToonMaterial({ color: c, gradientMap: toonRamp }));
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
// ---------- Anime head, face and hair ----------
// The head is round with a pointed anime chin: a lathe of this side profile [radius, height].
const HEAD_PROFILE = [[0, 0.02], [0.07, 0.03], [0.15, 0.08], [0.21, 0.15], [0.25, 0.23], [0.27, 0.31], [0.275, 0.38],
  [0.265, 0.45], [0.235, 0.51], [0.18, 0.555], [0.1, 0.58], [0, 0.59]];
function headR(y) {
  const P = HEAD_PROFILE;
  if (y <= P[0][1]) return P[0][0];
  for (let i = 1; i < P.length; i++) if (y <= P[i][1]) { const [r0, y0] = P[i - 1], [r1, y1] = P[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); }
  return 0;
}
const headGeo = () => geoCache.head || (geoCache.head = new THREE.LatheGeometry(HEAD_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 28));
// A curved line: up=true is ∩, up=false is ∪.
function arc(r, tube, color, x, y, z, parent, up, tilt = 0) {
  const m = new THREE.Mesh(geo('TorusGeometry', r, tube, 6, 18, Math.PI), mat(color));
  m.position.set(x, y, z); m.rotation.z = (up ? 0 : Math.PI) + tilt; m.userData.noLine = true; parent.add(m); return m;
}
const BROWS = { normal: [0.455, 0.24], happy: [0.475, -0.1], angry: [0.43, 0.55], sad: [0.465, -0.38], surprised: [0.5, -0.08], wink: [0.455, 0.24], cool: [0.45, 0] };
const LIDS = { angry: [0.37, 0.38], sad: [0.37, -0.32], cool: [0.35, 0] };
function animeFace(head, c, costume, skin) {
  const iris = (costume && costume.eyes) || c.eyes || '#7a3b2e', brow = (costume && costume.brows) || c.hairColor || '#1b1530';
  // An outfit's own face shows unless the player picked a different one.
  const ex = (c.expression && c.expression !== 'normal') ? c.expression : (costume && costume.expression) || 'normal';
  const mouth = (c.mouth && c.mouth !== 'smile') ? c.mouth : (costume && costume.mouth) || 'smile';
  const ink = '#120d18', lip = '#7a1f2c';
  for (const s of [-1, 1]) {
    const x = s * 0.12, eye = Array.isArray(iris) ? iris[s < 0 ? 0 : 1] : iris;
    const irisDark = '#' + new THREE.Color(eye).multiplyScalar(0.5).getHexString();
    if (ex === 'happy' || (ex === 'wink' && s === -1)) {
      arc(0.058, 0.015, ink, x, 0.3, -0.285, head, true);
    } else {
      const wide = ex === 'surprised' ? 1.15 : 1, pupil = ex === 'surprised' ? 0.65 : 1;
      ball(0.08 * wide, '#ffffff', x, 0.3, -0.25, head, 1, 1.35, 0.35);
      ball(0.056 * pupil, eye, x, 0.29, -0.272, head, 0.9, 1.25, 0.3).userData.noLine = true;
      ball(0.05 * pupil, irisDark, x, 0.315, -0.276, head, 0.95, 0.6, 0.3).userData.noLine = true;
      ball(0.028 * pupil, ink, x, 0.29, -0.284, head, 0.9, 1.2, 0.3);
      ball(0.02, '#ffffff', x + s * 0.016, 0.325, -0.296, head, 1, 1, 0.4);
      ball(0.01, '#ffffff', x - s * 0.02, 0.262, -0.296, head, 1, 1, 0.4);
      box(0.19, 0.036, 0.03, ink, s * 0.125, 0.392, -0.266, head).rotation.z = -s * 0.12;
      box(0.06, 0.026, 0.03, ink, s * 0.215, 0.4, -0.25, head).rotation.z = s * 0.55;
      if (LIDS[ex]) { const [ly, lr] = LIDS[ex]; const lid = box(0.2, 0.08, 0.035, skin, x, ly, -0.274, head); lid.rotation.z = s * lr; lid.userData.noLine = true; }
    }
    const [by, br] = BROWS[ex] || BROWS.normal;
    box(0.15, 0.03, 0.03, brow, x, by, -0.272, head).rotation.z = s * br;
    ball(0.06, skin, s * 0.28, 0.27, 0.02, head, 0.5, 1, 0.8);
  }
  ball(0.022, skin, 0, 0.205, -0.28, head, 0.8, 1.2, 0.9).userData.noLine = true;
  const mouthY = 0.125, mz = -0.276;
  if (mouth === 'smile') arc(0.05, 0.011, lip, 0, mouthY + 0.01, mz, head, false);
  else if (mouth === 'frown') arc(0.045, 0.011, lip, 0, mouthY - 0.02, mz, head, true);
  else if (mouth === 'smirk') arc(0.042, 0.011, lip, 0.025, mouthY + 0.01, mz, head, false, 0.4);
  else if (mouth === 'tongue') { arc(0.05, 0.011, lip, 0, mouthY + 0.01, mz, head, false); ball(0.024, '#ff7b8a', 0.015, mouthY - 0.035, mz + 0.004, head, 1, 1.3, 0.4); }
  else if (mouth === 'line') box(0.11, 0.016, 0.02, lip, 0, mouthY, mz, head);
  else if (mouth === 'o') ball(0.028, lip, 0, mouthY, mz + 0.004, head, 1, 1.3, 0.3);
  else if (mouth === 'grin' || mouth === 'shout') {
    const m = new THREE.Mesh(geo('CircleGeometry', mouth === 'shout' ? 0.075 : 0.07, 18, Math.PI, Math.PI), mat(lip));
    m.rotation.y = Math.PI; m.position.set(0, mouthY + 0.025, mz - 0.003); m.userData.noLine = true; head.add(m);
    if (mouth === 'shout') m.scale.y = 1.6;
    box(mouth === 'shout' ? 0.13 : 0.11, 0.022, 0.012, '#ffffff', 0, mouthY + 0.013, mz - 0.006, head).userData.noLine = true;
    if (mouth === 'grin') ball(0.026, '#ff7b8a', 0, mouthY - 0.02, mz - 0.002, head, 1.3, 0.7, 0.3).userData.noLine = true;
  } else if (mouth === 'teeth') {
    box(0.15, 0.055, 0.012, '#ffffff', 0, mouthY, mz - 0.004, head);
    for (const tx of [-0.045, 0, 0.045]) box(0.006, 0.05, 0.014, ink, tx, mouthY, mz - 0.008, head).userData.noLine = true;
    box(0.14, 0.005, 0.014, ink, 0, mouthY, mz - 0.008, head).userData.noLine = true;
  }
}
// A flat V of bare skin on the chest, for open collars and robes.
function vNeck(body, skin, halfWidth, height, y) {
  const v = new THREE.Mesh(geo('ConeGeometry', halfWidth, height, 16), mat(skin));
  v.rotation.z = Math.PI; v.scale.z = 0.06; v.position.set(0, y, -0.205); v.userData.noLine = true; body.add(v); return v;
}
// One lock of anime hair: a cone growing from `from` toward `dir`.
function strand(head, color, from, dir, r, len) {
  dir = dir.clone().normalize();
  const m = new THREE.Mesh(geo('ConeGeometry', r, len, 10), mat(color));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  m.position.copy(from).addScaledVector(dir, len / 2); m.userData.free = true; head.add(m); return m;
}
// Anime hair: a cap with swoopy bangs and side locks; long adds flowing strands down the back.
function animeHair(head, color, style) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  ball(0.29, color, 0, 0.43, 0.07, head);
  for (const [x, tilt] of [[-0.17, -0.35], [-0.08, -0.12], [0.02, 0.1], [0.12, 0.3], [0.2, 0.45]]) strand(head, color, V(x, 0.56, -0.2), V(tilt, -1, -0.4), 0.07, 0.24);
  for (const s of [-1, 1]) strand(head, color, V(s * 0.26, 0.45, -0.05), V(s * 0.15, -1, -0.1), 0.07, style === 'long' ? 0.5 : 0.3);
  if (style === 'long') for (let i = 0; i < 6; i++) { const x = -0.22 + i * 0.088; strand(head, color, V(x, 0.4, 0.2), V(x * 0.4, -1, 0.15), 0.1, 0.78); }
  if (style === 'short') for (const x of [-0.15, 0, 0.15]) strand(head, color, V(x, 0.3, 0.24), V(x * 0.5, -1, 0.4), 0.09, 0.2);
  if (style === 'bun') ball(0.16, color, 0, 0.72, 0.16, head);
}

// Big anime spikes bursting out of a cap of hair, with bangs over the forehead.
function animeSpikes(head, color) {
  ball(0.29, color, 0, 0.43, 0.07, head);
  const up = new THREE.Vector3(0, 1, 0), center = new THREE.Vector3(0, 0.36, 0.04);
  const spike = (dir, r, len, from) => {
    dir.normalize();
    const m = new THREE.Mesh(geo('ConeGeometry', r, len, 10), mat(color));
    m.quaternion.setFromUnitVectors(up, dir);
    m.position.copy(from || center.clone().addScaledVector(dir, 0.27)).addScaledVector(dir, len / 2);
    m.userData.free = true; head.add(m);
  };
  spike(new THREE.Vector3(0, 1, 0.1), 0.12, 0.42);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3; spike(new THREE.Vector3(Math.sin(a) * 0.75, 0.75, Math.cos(a) * 0.75), 0.12, 0.42); }
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    if (Math.cos(a) < -0.5) continue; // keep the face clear
    spike(new THREE.Vector3(Math.sin(a), 0.25, Math.cos(a)), 0.11, 0.36);
  }
  for (const x of [-0.17, -0.06, 0.06, 0.17]) spike(new THREE.Vector3(x * 1.5, -0.9, -0.35), 0.065, 0.2, new THREE.Vector3(x, 0.56, -0.21));
}

// A rounded tube from y=top down to y=bottom inside its parent.
function limb(rTop, rBottom, top, bottom, color, parent) {
  const m = new THREE.Mesh(geo('CylinderGeometry', rTop, rBottom, top - bottom, 16), mat(color));
  m.position.y = (top + bottom) / 2; parent.add(m); return m;
}
function tube(rTop, rBottom, h, color, x, y, z, parent) {
  const m = new THREE.Mesh(geo('CylinderGeometry', rTop, rBottom, h, 24), mat(color));
  m.position.set(x, y, z); parent.add(m); return m;
}
// Freckles or blush on both cheeks.
function cheeks(head, color, freckles) {
  for (const s of [-1, 1]) {
    if (freckles) for (const [dx, dy] of [[0, 0], [0.03, -0.02], [-0.025, -0.025]]) ball(0.009, color, s * (0.15 + dx), 0.215 + dy, -0.27, head, 1, 1, 0.5);
    else ball(0.04, color, s * 0.16, 0.22, -0.262, head, 1.3, 0.7, 0.3).userData.noLine = true;
  }
}
// Messy hair: a cap with short locks sticking out all over and bangs in front.
function messyHair(head, color, len = 0.18, bangs = 0.16) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  ball(0.29, color, 0, 0.43, 0.06, head);
  for (let ring = 0; ring < 3; ring++) {
    const n = [6, 9, 10][ring], up = [0.85, 0.45, 0.05][ring];
    for (let i = 0; i < n; i++) {
      const a = (i + ring * 0.5) / n * Math.PI * 2, dir = V(Math.sin(a), up, Math.cos(a));
      if (ring === 2 && Math.cos(a) < -0.3) continue; // keep the face clear
      strand(head, color, V(0, 0.42, 0.06).addScaledVector(dir.clone().normalize(), 0.26), dir, 0.08, len);
    }
  }
  for (const x of [-0.16, -0.05, 0.06, 0.16]) strand(head, color, V(x, 0.56, -0.2), V(x * 1.2, -1, -0.45), 0.065, bangs);
}
const COSTUMES = {
  messi: {
    eyes: '#5a3a22', brows: '#3a2414',
    parts: { skin: '#e9b48e', shirt: '#f4f6fa', sleeve: '#f4f6fa', hand: '#e9b48e', pants: '#1b1b1b', shin: '#f4f6fa', shoes: '#2a2a2a' },
    decorate({ head, body, arms, legs, Y }) {
      const sky = '#7ec8ee', ink = '#1b1b1b';
      animeHair(head, '#4a2f1d', 'short');
      for (const [bx, by, bz, sx, sy] of [[0, 0.06, -0.08, 1.4, 0.8], [-0.15, 0.14, -0.09, 0.8, 1.4], [0.15, 0.14, -0.09, 0.8, 1.4]]) {
        const b = ball(0.085, '#7a5a40', bx, by, bz, head, sx, sy, 0.9); b.userData.noLine = true; b.userData.free = true; // beard on the chin and jaw
      }
      for (const x of [-0.22, 0, 0.22]) box(0.1, 0.6, 0.44, sky, x, Y(1.27), 0, body);      // striped shirt
      box(0.06, 0.24, 0.02, ink, -0.06, Y(1.3), 0.222, body);                               // number 10 on the back
      const zero = new THREE.Mesh(geo('TorusGeometry', 0.07, 0.025, 8, 16), mat(ink)); zero.scale.y = 1.6; zero.position.set(0.08, Y(1.3), 0.222); body.add(zero);
      box(0.28, 0.07, 0.3, '#e8c040', 0, -0.18, 0, arms[1]);                                 // captain's armband
      for (const arm of arms) box(0.27, 0.05, 0.3, sky, 0, -0.29, 0, arm);                   // sleeve trim
      for (const leg of legs) box(0.26, 0.05, 0.26, sky, 0, -0.43, 0, leg);                  // sock bands
    },
  },
  shoto: {
    eyes: ['#3fc6d6', '#9aa3ad'], brows: '#c9ccd2', expression: 'cool', mouth: 'line',
    parts: { skin: '#f6d6c0', shirt: '#2c3e6e', sleeve: '#2c3e6e', hand: '#f6d6c0', pants: '#2c3e6e', shoes: '#1f2a44' },
    decorate({ head, body, Y }) {
      const V = (x, y, z) => new THREE.Vector3(x, y, z), red = '#c8322e', white = '#eef0f3';
      for (const [col, start] of [[red, 0], [white, Math.PI]]) {                        // hair split down the middle
        const cap = new THREE.Mesh(geo('SphereGeometry', 0.29, 20, 14, start, Math.PI), mat(col));
        cap.position.set(0, 0.43, 0.06); head.add(cap);
      }
      for (const [x, tilt] of [[-0.17, -0.3], [-0.06, -0.1], [0.06, 0.1], [0.17, 0.3]]) strand(head, x < 0 ? red : white, V(x, 0.56, -0.2), V(tilt, -1, -0.4), 0.075, 0.25);
      for (const s of [-1, 1]) strand(head, s < 0 ? red : white, V(s * 0.25, 0.45, -0.06), V(s * 0.12, -1, -0.1), 0.075, 0.28);
      const scar = ball(0.085, '#b4524a', -0.13, 0.32, -0.255, head, 1.25, 1.1, 0.35); scar.userData.noLine = true; // burn scar
      for (const s of [-1, 1]) { const strap = box(0.07, 0.75, 0.45, '#e8e8ec', s * 0.1, Y(1.27), 0, body); strap.rotation.z = s * 0.45; } // harness
      box(0.78, 0.09, 0.44, '#e8e8ec', 0, Y(0.98), 0, body);
    },
  },
  aizawa: {
    eyes: '#2a2a2a', brows: '#1b1b1b', expression: 'cool', mouth: 'line',
    parts: { skin: '#efcaa8', shirt: '#1b1b1b', sleeve: '#1b1b1b', hand: '#efcaa8', pants: '#1b1b1b', shoes: '#1b1b1b' },
    decorate({ head, body, Y }) {
      const V = (x, y, z) => new THREE.Vector3(x, y, z), scarf = '#c8ccd2';
      messyHair(head, '#151515', 0.22, 0.22);
      for (const s of [-1, 1]) for (const z of [-0.04, 0.1, 0.22]) strand(head, '#151515', V(s * 0.25, 0.42, z), V(s * 0.25, -1, 0.1), 0.08, 0.45);
      ball(0.13, '#8a7464', 0, 0.12, -0.17, head, 1.2, 0.7, 0.7).userData.noLine = true;  // stubble
      for (const [y, r] of [[1.62, 0.2], [1.55, 0.25], [1.48, 0.3]]) {                     // capture scarf wraps
        const wrap = new THREE.Mesh(geo('TorusGeometry', r, 0.055, 8, 20), mat(scarf));
        wrap.rotation.x = Math.PI / 2; wrap.position.set(0, Y(y), 0.02); body.add(wrap);
      }
      box(0.22, 0.07, 0.06, '#f2c230', 0, Y(1.58), -0.25, body);                           // goggles around the neck
    },
  },
  deku: {
    eyes: '#2f9e5a', brows: '#173d2e',
    parts: { skin: '#f3c9a6', shirt: '#2b6e55', sleeve: '#2b6e55', hand: '#f4f4f4', pants: '#2b6e55', shoes: '#d42a2a' },
    decorate({ head, body, legs, Y }) {
      messyHair(head, '#1f4d3a', 0.2, 0.17);
      cheeks(head, '#a8642c', true);
      box(0.78, 0.09, 0.44, '#1b1b1b', 0, Y(0.98), 0, body);                       // belt
      for (const s of [-1, 1]) box(0.13, 0.14, 0.09, '#1b1b1b', s * 0.26, Y(0.98), -0.24, body);
      box(0.3, 0.3, 0.05, '#1f5442', 0, Y(1.36), -0.2, body).userData.noLine = true; // darker chest panel
      for (const leg of legs) box(0.26, 0.12, 0.26, '#1b1b1b', 0, -0.4, -0.02, leg); // knee pads
    },
  },
  denki: {
    eyes: '#e0b020', brows: '#c9a43a', mouth: 'smirk',
    parts: { skin: '#f3c9a6', shirt: '#1b1b1b', sleeve: '#1b1b1b', hand: '#f3c9a6', pants: '#1b1b1b', shoes: '#1b1b1b' },
    decorate({ head, body, Y }) {
      const gold = '#f2d250';
      messyHair(head, gold, 0.24, 0.18);
      [[-0.2, 0.62, 0.5], [-0.16, 0.55, -0.5], [-0.2, 0.48, 0.5]].forEach(([x, y, r]) => {     // black lightning streak
        const b = box(0.1, 0.035, 0.03, '#1b1b1b', x, y, -0.25, head); b.rotation.z = r; b.userData.free = true;
      });
      box(0.06, 0.08, 0.06, '#f2d250', -0.29, 0.25, 0, head);                                  // earpiece
      [[0.12, 1.45, -0.7], [0.04, 1.33, 0.7], [0.12, 1.2, -0.7]].forEach(([x, y, r]) => {        // white lightning on the jacket
        box(0.2, 0.05, 0.02, '#ffffff', x - 0.06, Y(y), -0.215, body).rotation.z = r;
      });
    },
  },
  uraraka: {
    eyes: '#7a4a2a', brows: '#4a2a18',
    parts: { skin: '#f6d2b8', shirt: '#1b1b1b', sleeve: '#f28ab0', hand: '#f6f6f6', pants: '#1b1b1b', shoes: '#f28ab0' },
    decorate({ head, body, arms, legs, Y }) {
      const brown = '#5a3320', V = (x, y, z) => new THREE.Vector3(x, y, z);
      ball(0.29, brown, 0, 0.43, 0.06, head);
      for (const [x, tilt] of [[-0.17, -0.3], [-0.06, -0.1], [0.05, 0.1], [0.16, 0.3]]) strand(head, brown, V(x, 0.56, -0.2), V(tilt, -1, -0.4), 0.075, 0.24);
      for (const s of [-1, 1]) { strand(head, brown, V(s * 0.25, 0.45, -0.08), V(s * 0.1, -1, -0.15), 0.08, 0.36); strand(head, brown, V(s * 0.2, 0.4, 0.16), V(s * 0.15, -1, 0.2), 0.11, 0.3); }
      cheeks(head, '#f28ab0', false);
      box(0.5, 0.3, 0.05, '#f28ab0', 0, Y(1.36), -0.2, body).userData.noLine = true;  // pink chest panel
      box(0.78, 0.08, 0.44, '#f28ab0', 0, Y(0.98), 0, body);
      for (const arm of arms) box(0.2, 0.08, 0.2, '#f28ab0', 0, -0.58, 0, arm);        // wrist pads
      for (const leg of legs) box(0.24, 0.2, 0.24, '#f28ab0', 0, -0.62, 0, leg);       // tall boots
    },
  },
  allmight: {
    eyes: '#3a6fd8', brows: '#c9a43a', mouth: 'grin', scale: 1.18,
    parts: { skin: '#f3c9a6', shirt: '#2f5bd6', sleeve: '#2f5bd6', hand: '#f2c230', pants: '#2f5bd6', shoes: '#d42a2a' },
    decorate({ head, body, legs, Y }) {
      const gold = '#f2d250', V = (x, y, z) => new THREE.Vector3(x, y, z);
      ball(0.29, gold, 0, 0.43, 0.06, head);
      for (const s of [-1, 1]) strand(head, gold, V(s * 0.06, 0.56, -0.17), V(s * 0.35, 1, 0.25), 0.075, 0.5);   // the two famous spikes
      for (const [x, z] of [[-0.24, 0.1], [0.24, 0.1], [-0.14, 0.24], [0.14, 0.24], [0, 0.27]]) strand(head, gold, V(x, 0.4, z), V(x, -0.4, 1), 0.08, 0.22);
      for (const s of [-1, 1]) ball(0.17, '#2f5bd6', s * 0.42, Y(1.45), 0, body);       // big shoulders
      box(0.66, 0.08, 0.44, '#ffffff', 0, Y(1.42), 0, body);                             // red and white chest stripes
      box(0.66, 0.08, 0.44, '#d42a2a', 0, Y(1.33), 0, body);
      box(0.78, 0.1, 0.44, '#f2c230', 0, Y(0.98), 0, body);                              // yellow belt
      for (const leg of legs) box(0.24, 0.24, 0.24, '#d42a2a', 0, -0.62, 0, leg);        // red boots
    },
  },
  straw: {
    eyes: '#1c1410', brows: '#1c1410', mouth: 'shout',
    parts: { skin: '#f1c19b', shirt: '#d42a2a', sleeve: '#f1c19b', hand: '#f1c19b', pants: '#3a6fd8', shin: '#f1c19b', shoes: '#c8a060' },
    decorate({ head, body, legs, Y }) {
      const straw = '#e0c27a';
      animeHair(head, '#1c1410', 'short');
      tube(0.52, 0.52, 0.03, straw, 0, 0.56, 0.02, head);
      tube(0.27, 0.3, 0.2, straw, 0, 0.68, 0.02, head);
      tube(0.305, 0.305, 0.06, '#c8202a', 0, 0.61, 0.02, head);
      box(0.06, 0.012, 0.012, '#8a3b2e', -0.13, 0.22, -0.275, head).rotation.z = 0.3;   // scar under the eye
      vNeck(body, '#f1c19b', 0.12, 0.2, Y(1.5));                                        // open collar
      for (const s of [-1, 1]) for (const y of [1.18, 1.36]) ball(0.026, '#e8c040', s * 0.11, Y(y), -0.215, body);
      box(0.78, 0.09, 0.44, '#e8c040', 0, Y(0.98), 0, body);                             // sash
      for (const leg of legs) box(0.3, 0.07, 0.3, '#f4f4f4', 0, -0.36, 0, leg);          // fluffy cuffs
    },
  },
  swords: {
    eyes: '#1c1410', brows: '#2f6b3a', expression: 'wink', mouth: 'grin',
    parts: { skin: '#e0a878', shirt: '#2f7a3a', sleeve: '#2f7a3a', hand: '#e0a878', pants: '#1f2a24', shoes: '#1b1b1b' },
    decorate({ head, body, arms, Y }) {
      const green = '#5fbf6a', V = (x, y, z) => new THREE.Vector3(x, y, z);
      ball(0.285, green, 0, 0.42, 0.06, head);
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; strand(head, green, V(Math.sin(a) * 0.17, 0.55, Math.cos(a) * 0.17 + 0.04), V(Math.sin(a) * 0.5, 1, Math.cos(a) * 0.5), 0.06, 0.13); }
      for (const x of [-0.14, 0, 0.14]) strand(head, green, V(x, 0.56, -0.17), V(x, -0.4, -1), 0.05, 0.1);
      box(0.012, 0.2, 0.012, '#8a3b2e', -0.12, 0.31, -0.29, head);                      // scar over the closed eye
      for (const dz of [-0.03, 0, 0.03]) box(0.012, 0.07, 0.012, '#e8c040', -0.29, 0.13, dz, head); // earrings
      vNeck(body, '#e0a878', 0.2, 0.5, Y(1.34));                                        // open robe
      const scar = box(0.014, 0.46, 0.012, '#8a3b2e', 0, Y(1.3), -0.228, body); scar.rotation.z = 0.6;
      for (let i = -3; i <= 3; i++) box(0.04, 0.008, 0.012, '#8a3b2e', -Math.sin(0.6) * i * 0.06, Y(1.3) + Math.cos(0.6) * i * 0.06, -0.23, body).rotation.z = 0.6 + Math.PI / 2;
      box(0.78, 0.14, 0.44, '#1f5a2a', 0, Y(0.98), 0, body);                             // sash
      box(0.26, 0.08, 0.26, '#1b1b1b', 0, -0.13, 0, arms[1]);                            // bandana on the arm
      [['#f2f2f2', 0.24], ['#1b1b1b', 0.31], ['#8a1f2a', 0.38]].forEach(([c, x], i) => {  // three swords at the hip
        const sword = new THREE.Group(); sword.position.set(x, Y(0.92), 0.05 - i * 0.05); sword.rotation.set(0.15, 0, 1.25); body.add(sword);
        box(0.05, 0.78, 0.05, c, 0, -0.1, 0, sword); box(0.06, 0.22, 0.06, '#2a2a2a', 0, 0.38, 0, sword); box(0.13, 0.03, 0.09, '#d4af37', 0, 0.27, 0, sword);
      });
    },
  },
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
        box(0.22, 0.08, 0.22, K, 0, -0.56, 0, arms[i]);
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
    eyes: '#5a3a22', brows: '#16100c',
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
        box(0.22, 0.09, 0.22, '#e8a020', 0, -0.56, 0, arm);
        box(0.08, 0.08, 0.02, '#3ff0f0', 0, -0.66, -0.07, arm);
      }
      for (const leg of legs) {
        box(0.24, 0.04, 0.38, '#3fd6e0', 0, -0.74, -0.06, leg);
        box(0.24, 0.03, 0.38, '#e8a020', 0, -0.7, -0.06, leg);
      }
    },
  },
};

function buildPet(type) {
  if (!type || type === 'none') return null;
  const g = new THREE.Group(), legs = [];
  if (type === 'dragon') return buildDragon(g, legs);
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

// Ember: a small green dragon with flapping wings, horns and a spiky tail.
function buildDragon(g, legs) {
  const main = '#3fbf5f', belly = '#f3e08a', spike = '#ff7a2f', wings = [];
  box(0.34, 0.3, 0.5, main, 0, 0.38, 0, g);
  box(0.24, 0.22, 0.04, belly, 0, 0.36, -0.25, g);
  box(0.32, 0.28, 0.3, main, 0, 0.62, -0.34, g);
  box(0.22, 0.12, 0.14, main, 0, 0.56, -0.54, g);
  for (const s of [-1, 1]) {
    box(0.03, 0.03, 0.02, '#1b1530', s * 0.05, 0.6, -0.615, g);
    box(0.07, 0.08, 0.02, '#ffd23f', s * 0.08, 0.68, -0.495, g);
    box(0.03, 0.05, 0.025, '#111111', s * 0.08, 0.68, -0.5, g);
    cone(0.045, 0.16, belly, s * 0.1, 0.83, -0.28, g, -0.4, -s * 0.2);
    const wing = new THREE.Group(); wing.position.set(s * 0.17, 0.5, -0.05); g.add(wing); wings.push(wing);
    box(0.36, 0.03, 0.26, spike, s * 0.18, 0, 0.04, wing);
    box(0.36, 0.035, 0.04, main, s * 0.18, 0.01, -0.09, wing);
  }
  for (const z of [-0.12, 0.05, 0.2]) cone(0.05, 0.12, spike, 0, 0.58, z, g);
  const tail = new THREE.Group(); tail.position.set(0, 0.38, 0.25); tail.rotation.x = 0.35; g.add(tail);
  box(0.16, 0.14, 0.32, main, 0, 0, 0.16, tail);
  box(0.1, 0.09, 0.22, main, 0, -0.02, 0.4, tail);
  cone(0.07, 0.14, spike, 0, -0.02, 0.56, tail, Math.PI / 2, 0);
  for (const [x, z] of [[-0.11, -0.15], [0.11, -0.15], [-0.11, 0.15], [0.11, 0.15]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.24, z); g.add(leg);
    box(0.1, 0.24, 0.1, main, 0, -0.12, 0, leg); legs.push(leg);
  }
  g.position.set(-0.95, 0, 0.5);
  return { group: g, legs, wings };
}

function buildAvatar(c) {
  roundK = 0.8;
  try { const rig = buildRunner(c); addOutlines(rig.root); return rig; } finally { roundK = 0; }
}
// Ink outlines like an anime drawing: a slightly puffed-out, inside-out copy of each part, drawn dark.
const outlineMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * 0.014, 1.0); }',
  fragmentShader: 'void main() { gl_FragColor = vec4(0.09, 0.07, 0.14, 1.0); }',
});
function addOutlines(root) {
  const parts = [];
  root.traverse(o => { if (o.isMesh && !o.userData.outline && !o.userData.noLine) parts.push(o); });
  for (const part of parts) {
    if (!part.geometry.boundingSphere) part.geometry.computeBoundingSphere();
    const size = part.geometry.boundingSphere.radius * Math.max(part.scale.x, part.scale.y, part.scale.z);
    if (size < 0.05) continue; // faces, buttons and other tiny details stay unlined
    const line = new THREE.Mesh(part.geometry, outlineMat); line.userData.outline = true; part.add(line);
  }
}
function buildRunner(c) {
  const costume = COSTUMES[c.outfit];
  const P = costume ? costume.parts : { skin: c.skin, shirt: c.shirt, sleeve: c.shirt, hand: c.skin, pants: c.pants, shoes: c.shoes };
  const t = costume && costume.thin ? 0.55 : 1, tw = t < 1 ? 0.44 : 0.74;
  const root = new THREE.Group(), body = new THREE.Group();
  body.position.y = 0.95; root.add(body);
  const Y = y => y - 0.95;
  const legs = [], arms = [];
  // Limbs are rounded tubes with ball joints at the hips, knees, shoulders and elbows, so
  // nothing floats apart. Elbows and knees are their own groups so they can bend.
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * tw * 0.24, Y(0.8), 0); body.add(hip);
    ball(0.15 * t, P.pants, 0, 0, 0, hip);
    limb(0.13 * t, 0.11 * t, 0, -0.38, P.pants, hip);
    const knee = new THREE.Group(); knee.position.y = -0.38; hip.add(knee);
    ball(0.11 * t, P.shin || P.pants, 0, 0, 0, knee);
    limb(0.11 * t, 0.085 * t, 0, -0.33, P.shin || P.pants, knee);
    box(0.19 * t + 0.03, 0.12, 0.36, P.shoes, 0, -0.37, -0.06, knee);
    hip.knee = knee; legs.push(hip);

    const sh = new THREE.Group(); sh.position.set(s * (tw / 2 + 0.08 * t), Y(1.5), 0); body.add(sh);
    ball(0.14 * t, P.sleeve, 0, 0, 0, sh);
    limb(0.115 * t, 0.095 * t, 0, -0.32, P.sleeve, sh);
    const elbow = new THREE.Group(); elbow.position.y = -0.32; sh.add(elbow);
    ball(0.095 * t, P.hand, 0, 0, 0, elbow);
    limb(0.09 * t, 0.07 * t, 0, -0.27, P.hand, elbow);
    ball(0.085 * t, P.hand, 0, -0.34, 0, elbow, 0.9, 1.15, 0.75);
    sh.elbow = elbow; arms.push(sh);
  }
  box(tw, 0.62, t < 1 ? 0.3 : 0.42, P.shirt, 0, Y(1.27), 0, body);
  box(tw * 0.86, 0.36, t < 1 ? 0.27 : 0.38, P.pants, 0, Y(0.9), 0, body);
  // Neck joins the head to the shoulders; the head is a little smaller than the old cartoon one.
  tube(0.09 * t + 0.02, 0.1 * t + 0.03, 0.2, P.skin, 0, Y(1.62), 0, body);
  const head = new THREE.Group(); head.position.y = Y(1.64); head.scale.setScalar(0.84); body.add(head);
  const skull = new THREE.Mesh(headGeo(), mat(P.skin)); skull.userData.skull = true; head.add(skull);
  if (!costume || costume.face !== false) animeFace(head, c, costume, P.skin);

  let cape = null;
  if (costume) {
    costume.decorate({ head, body, arms, legs, Y });
    if (costume.scale) root.scale.setScalar(costume.scale);
    for (const [groups, cut] of [[arms, -0.34], [legs, -0.4]]) for (const g of groups) {
      const joint = g.elbow || g.knee;
      for (const part of [...g.children]) if (part !== joint && part.position.y < cut) { part.position.y -= joint.position.y; joint.add(part); }
    }
  } else {
    const hc = c.hairColor;
    if (c.hair === 'short' || c.hair === 'long' || c.hair === 'bun') animeHair(head, hc, c.hair);
    const hatted = c.hat !== 'none' && c.hat !== 'headphones';
    if (c.hair === 'spiky' || (c.hair === 'mohawk' && hatted)) box(0.56, 0.08, 0.56, hc, 0, 0.58, 0, head);
    if (c.hair === 'spiky' && !hatted) animeSpikes(head, hc);
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
  // Pieces placed on the front of the head sit on its curved surface.
  for (const part of head.children) {
    const { x, y, z } = part.position;
    if (part.userData.skull || part.userData.free || z > -0.15) continue;
    const r = headR(y);
    part.position.z = z + 0.27 - Math.sqrt(Math.max(0, r * r - x * x));
  }
  const pet = buildPet(c.pet);
  if (pet) { root.add(pet.group); pet.group.scale.setScalar(1 / root.scale.x); }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.12;
  return { root, body, legs, arms, head, cape, shadow, pet, tall: (costume && costume.tall) || 0, dance: !!(costume && costume.dance) };
}
function rebuildAvatar(cfg = avatarCfg) {
  const prev = avatar;
  avatar = buildAvatar(cfg);
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
function toCustom() { pendingBuy = null; state = 'custom'; clearThings(); resetPose(); renderCustom(); show('#custom'); }
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
  '79a25fd8': { coins: 100, unlock: ['pet:pup'], max: 8 },
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
      'readonly': 'You need more access to use codes. Ask the owner to give you access.',
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
    else if (r.reason === 'readonly') setBoardStatus('You need more access to add scores. Ask the owner to give you access.');
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
  else if (/^[1-9]$/.test(k) && Object.keys(EMOTES)[+k - 1] && (state === 'menu' || state === 'custom')) playEmote(Object.keys(EMOTES)[+k - 1]);
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
$('#overMenuBtn').onclick = toMenu;
$('#doneBtn').onclick = () => {
  if (pendingBuy) { pendingBuy = null; rebuildAvatar(); }
  if (shopMode) { shopMode = false; window.Lobby && Lobby.show(); } else toMenu();   // the Skin Shop goes back to the lobby
};
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
    const faceRow = (key === 'expression' || key === 'mouth') && !(COSTUMES[avatarCfg.outfit] && COSTUMES[avatarCfg.outfit].face === false);
    if (avatarCfg.outfit !== 'custom' && key !== 'outfit' && key !== 'pet' && !faceRow) {
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
        b.className = 'chip' + (locked ? ' locked' : '') + (pendingBuy === key + ':' + value ? ' trying' : '');
        b.innerHTML = locked ? `${pendingBuy === key + ':' + value ? 'Tap again to buy' : name} · <span class="coin"></span> ${price}` : name;
      }
      b.setAttribute('aria-pressed', String(avatarCfg[key] === value));
      b.onclick = () => {
        if (locked && !buy(key + ':' + value, name, price, () => rebuildAvatar({ ...avatarCfg, [key]: value }))) return;
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
    b.className = 'chip' + (locked ? ' locked' : '') + (pendingBuy === key ? ' trying' : '');
    b.innerHTML = locked ? `${pendingBuy === key ? 'Tap again to buy' : e.name} · <span class="coin"></span> ${e.price}` : e.name;
    b.onclick = () => {
      if (locked && !buy(key, e.name, e.price, () => playEmote(id, true))) return;
      if (pendingBuy) rebuildAvatar(); // stop wearing anything being tried on
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
    // Knees bend as each leg swings back; elbows stay bent while running.
    for (const l of a.legs) l.knee.rotation.x = air ? -1.0 : -Math.max(0, -l.rotation.x) * 1.3 - (state === 'custom' ? 0 : 0.1);
    for (const arm of a.arms) arm.elbow.rotation.x = air ? 0.3 : state === 'custom' ? 0.2 : 1.2;
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
      if (a.pet.wings) a.pet.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.3 + Math.sin(animT * 2.4) * 0.5); });
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
        for (const l of a.legs) { l.rotation.x = 0; l.knee.rotation.x = 0; }
        for (const arm of a.arms) { arm.rotation.x = 0; arm.elbow.rotation.x = 0; }
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
nameInput.addEventListener('input', () => { runnerName = nameInput.value.trim(); store.set('name', runnerName); checkSecretName(); });
// A secret runner name unlocks everything in the shop. It's stored scrambled, like the codes.
const SECRET_NAME = '028d1ebc';
function checkSecretName() {
  if (codeHash(runnerName.toUpperCase().replace(/\s+/g, '')) !== SECRET_NAME) return;
  const all = [];
  for (const [key, opt] of Object.entries(OPTIONS)) if (opt.type === 'style') for (const v of opt.values) if (v[2]) all.push(key + ':' + v[0]);
  for (const [id, e] of Object.entries(EMOTES)) if (e.price) all.push('emote:' + id);
  const fresh = all.filter(k => !owned.includes(k));
  if (!fresh.length) return;
  owned.push(...fresh); store.set('owned', owned);
  toast('Secret name! Everything is unlocked.');
  if (state === 'custom') renderCustom();
  refreshMenu();
}
checkSecretName();
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
let active = false, shopMode = false;
window.RailRush = {
  open() { active = true; shopMode = false; last = performance.now(); toMenu(); },
  // The lobby's Skin Shop: the avatar maker on its own, and Done goes back to the lobby.
  openShop() { active = true; shopMode = true; last = performance.now(); toCustom(); $('#doneBtn').textContent = 'Pick this skin!'; },
  close() { active = false; shopMode = false; nameTag.hidden = true; $('#doneBtn').textContent = 'Done'; },
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

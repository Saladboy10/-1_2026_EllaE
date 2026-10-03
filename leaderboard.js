// Shared storage for every game in the lobby: leaderboards and limited secret codes.
// Each game keeps its own board: one entry per player holding their best score.
// Secret codes can only be claimed by a set number of players; each player's claimed
// codes live in claims/<player id>.
// This only works in the published game (it needs the shared database); opened as a
// plain file, every call quietly reports that it is unavailable.
const Leaderboard = (() => {
  let ready = null, myId = null;

  function connect() {
    if (!ready) {
      ready = (async () => {
        if (!window.claude || !window.claude.use) return null;
        const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
        if (!db || !user) return null;
        myId = await user.id();
        return myId ? db : null;
      })().catch(() => null);
    }
    return ready;
  }

  // Save a finished run. Keeps the player's best score; updates their name if it changed.
  // Resolves { ok, best, improved } or { ok: false, reason: 'offline' | 'readonly' | 'error' }.
  async function submit(game, { name, score, outfit }) {
    const db = await connect();
    if (!db) return { ok: false, reason: 'offline' };
    const ref = db.collection(game).doc(myId);
    try {
      const snap = await ref.get();
      const prev = snap.exists ? snap.data() : null;
      const improved = !prev || score > prev.score;
      if (!improved && prev.name === name) return { ok: true, best: prev.score, improved: false };
      const body = improved
        ? { name, score, outfit: outfit || '', at: Date.now() }
        : { ...prev, name };
      await ref.set(body);
      return { ok: true, best: body.score, improved };
    } catch (e) {
      return { ok: false, reason: e && e.code === 'invalid_argument' ? 'readonly' : 'error' };
    }
  }

  // Live top-n list. Calls back with rows [{ name, score, outfit, me }] or null when unavailable.
  function watch(game, n, callback) {
    connect().then(db => {
      if (!db) { callback(null); return; }
      db.collection(game).orderBy('score', 'desc').limit(n).onSnapshot(
        snap => callback(snap.docs.map(d => ({ ...d.data(), me: d.id === myId }))),
        () => callback(null),
      );
    });
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Claim a secret code for this player if fewer than `max` players have it.
  // Resolves { ok: true, used, max } or { ok: false, reason: 'already' | 'used-up' | 'busy' | 'readonly' | 'offline' | 'error' }.
  async function claimCode(code, max) {
    const db = await connect();
    if (!db) return { ok: false, reason: 'offline' };
    try {
      // A short lock on the code so two players can't take the last spot at the same moment.
      const lock = db.doc('codelocks/' + code);
      let held = false;
      for (let i = 0; i < 4 && !held; i++) {
        held = (await lock.acquire({ holder: myId, ttlMs: 8000 })).acquired;
        if (!held) await wait(700);
      }
      if (!held) return { ok: false, reason: 'busy' };
      const mine = db.collection('claims').doc(myId);
      const snap = await mine.get();
      const codes = snap.exists ? [...(snap.data().codes || [])] : [];
      if (codes.includes(code)) return { ok: false, reason: 'already' };
      const taken = await db.collection('claims').where('codes', 'array-contains', code).get();
      if (taken.size >= max) return { ok: false, reason: 'used-up', max };
      codes.push(code);
      await mine.set({ codes });
      return { ok: true, used: taken.size + 1, max };
    } catch (e) {
      return { ok: false, reason: e && e.code === 'invalid_argument' ? 'readonly' : 'error' };
    }
  }

  return { submit, watch, claimCode };
})();

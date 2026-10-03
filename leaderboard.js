// Shared leaderboards for every game in the lobby.
// Each game keeps its own board: one entry per player holding their best score.
// Boards only work in the published game (they need the shared database); opened
// as a plain file, every call quietly reports that the board is unavailable.
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

  return { submit, watch };
})();

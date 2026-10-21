// A room session is a small store plus the actions the room screen may take. Two
// backends implement it, and the screens cannot tell them apart:
//
//   remote.js  a real room in Firestore, shared by everyone holding its code
//   local.js   practice against bots, all in this browser, nothing written anywhere
//
// State (both backends):
//   me          the player id of whoever is using this screen
//   room        { code, hostUid, hostName, status, current, plan, minutes, hostPlays, expiresAt }
//   players     { pid: { name, bot } }
//   round       the current round's terms, info, status and, once settled, its value
//   market      { q, trades, price, lastBy, lastAt }
//   positions   { pid: { shares, cash, k, fees } }   (a phone sees its own until the round settles)
//   hand        my card in a card round, or null
//   tape        [{ t, price, pid, d }] for the chart
//   history     { n: { round, q, positions } } for every settled round
//   vault       the host's hidden value and reveal schedule (host only)
//   hands       every dealt card (host only)
//   error       the last refusal, for a toast

export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      listeners.forEach((f) => f());
    },
    subscribe(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
}

export const emptySession = {
  ready: false,
  me: null,
  room: null,
  players: {},
  round: null,
  market: null,
  positions: {},
  hand: null,
  tape: [],
  history: {},
  vault: null,
  hands: {},
  error: null,
};

// Firestore Timestamps to milliseconds, one level deep.
export function plain(data) {
  if (!data) return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = v && typeof v.toMillis === "function" ? v.toMillis() : v;
  return out;
}

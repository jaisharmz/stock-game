// Practice: the same room, run entirely in this browser against bots. Nothing is written
// anywhere, so it costs no database quota and works signed out. "The house" deals, so
// you are never the dealer.

import { createStore, emptySession } from "./store.js";
import { dealFor, runHost } from "./hostLoop.js";
import { botName } from "./botNames.js";
import { fill, refusal, emptyPosition } from "../engine/curve.js";
import { KINDS } from "../engine/kinds.js";
import { ROOM_GRACE_MS } from "../engine/host.js";

const HOUSE = "house";
const ME = "you";

export function localSession({ name = "You", minutes, plan, bots }) {
  const players = { [ME]: { name, bot: false } };
  const count = {};
  for (const kind of bots) {
    count[kind] = (count[kind] ?? 0) + 1;
    players[`bot-${kind}${count[kind]}`] = { name: botName(kind, count[kind]), bot: true };
  }
  const store = createStore({
    ...emptySession,
    ready: true,
    joined: true,
    me: ME,
    players,
    room: { code: "PRACTICE", hostUid: HOUSE, hostName: "The house", status: "lobby", current: -1, plan, minutes, hostPlays: false, expiresAt: Date.now() + minutes * 60000 + ROOM_GRACE_MS },
  });
  const session = { kind: "local", store, hostId: HOUSE, me: ME };
  const lastAt = {};

  session.trade = async (pid, d) => {
    const s = store.get();
    const r = s.round;
    const t = Date.now();
    if (!r || r.status !== "live" || t < r.startsAt || t >= r.endsAt) throw new Error("The round is not open.");
    if (t - (lastAt[pid] ?? 0) < 250) throw new Error("Refused: you are trading too fast.");
    const pos = s.positions[pid] ?? emptyPosition(r);
    const why = refusal(r, s.market.q, pos.shares, d);
    if (why) throw new Error(why);
    const done = fill(r, s.market.q, pos, d);
    lastAt[pid] = t;
    store.set({
      market: { q: s.market.q + d, trades: s.market.trades + 1, price: done.fill.price, lastBy: pid, lastAt: t },
      positions: { ...s.positions, [pid]: done.pos },
      tape: [...s.tape, { t, price: done.fill.price, pid, d }],
    });
  };
  session.order = (d) => session.trade(ME, d).catch((e) => {
    store.set({ error: e.message });
    throw e;
  });

  session.lobby = {
    start: async () => store.set((s) => ({ room: { ...s.room, status: "playing", current: 0 } })),
    end: async () => store.set((s) => ({ room: { ...s.room, status: "done" } })),
  };

  session.host = {
    async deal({ n }) {
      const { round, vault } = await dealFor(store.get(), n, [], Date.now());
      store.set({ round, vault, hands: vault.hands, hand: vault.hands[ME] ?? null, market: { q: 0, trades: 0, price: round.p0, lastBy: "", lastAt: Date.now() }, positions: {}, tape: [] });
    },
    async reveal({ info }) {
      store.set((s) => ({ round: { ...s.round, info } }));
    },
    async settle() {
      const s = store.get();
      const hidden = KINDS[s.round.kind].hidden;
      const round = { ...s.round, status: "settled", settledAt: Date.now(), ...(hidden ? { secret: s.vault.text, value: s.vault.value } : {}) };
      store.set({ round, history: { ...s.history, [round.n]: { round, q: s.market.q, positions: s.positions } } });
    },
    async advance({ n }) {
      store.set((s) => ({ room: { ...s.room, current: n }, round: null, market: null, positions: {}, tape: [], hand: null, vault: null, hands: {} }));
    },
    async finish() {
      store.set((s) => ({ room: { ...s.room, status: "done" } }));
    },
  };

  const stop = runHost(session, Date.now);
  session.dispose = stop;
  return session;
}

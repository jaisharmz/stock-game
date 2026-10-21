// One order is one Firestore transaction across three documents: the market, the trader's
// position, and a new trade record. firestore.rules checks each against the others.

import { doc, getDocFromServer, runTransaction, serverTimestamp } from "firebase/firestore";
import { cost, fee, price, refusal, emptyPosition } from "../engine/curve.js";

export const roundPath = (code, n) => `rooms/${code}/rounds/${n}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function attempt(db, { code, n, round, pid, d }, seen) {
  const base = roundPath(code, n);
  const stateRef = doc(db, base, "market", "state");
  const posRef = doc(db, base, "positions", pid);
  return runTransaction(db, async (tx) => {
    const [state, held] = await Promise.all([tx.get(stateRef), tx.get(posRef)]);
    if (!state.exists()) throw new Error("the market is not open yet");
    const { q, trades } = state.data();
    seen.trades = trades;
    const pos = held.exists() ? held.data() : emptyPosition(round);
    const why = refusal(round, q, pos.shares, d);
    if (why) throw new Error(why);
    const c = cost(round, q, d);
    const f = fee(round, c);
    const k = pos.k + 1;
    const now = serverTimestamp();
    tx.set(stateRef, { q: q + d, trades: trades + 1, price: price(round, q + d), lastBy: pid, lastAt: now });
    tx.set(posRef, { shares: pos.shares + d, cash: pos.cash - c - f, k, fees: pos.fees + f, lastAt: now });
    tx.set(doc(db, base, "trades", `${pid}-${k}`), { pid, d, q, price: price(round, q + d), cost: c, fee: f, at: now });
    return { q: q + d, price: price(round, q + d), cost: c, fee: f };
  });
}

// The rules judge a write against the database as it is at commit, so when two orders
// race, the one that read the market first is refused rather than retried. If someone
// else traded since this order read the market, it is retried against the new state.
export async function placeOrder(db, args, tries = 6) {
  for (let i = 1; ; i++) {
    const seen = {};
    try {
      return await attempt(db, args, seen);
    } catch (e) {
      if (e?.code !== "permission-denied" || i >= tries || seen.trades == null) throw e;
      const now = await getDocFromServer(doc(db, roundPath(args.code, args.n), "market", "state"));
      if (now.data()?.trades === seen.trades) throw e;
      await sleep(20 + Math.random() * 80 * i);
    }
  }
}

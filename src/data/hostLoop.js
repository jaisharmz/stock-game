// The host's screen runs this four times a second: one planner step (deal, reveal,
// settle, advance, finish) and a look from each bot. Both backends share it.

import { planHost, dealRound, EDGE_MS } from "../engine/host.js";
import { botOrder, botPause } from "../engine/bots.js";
import { estimate } from "../engine/kinds.js";
import { emptyPosition } from "../engine/curve.js";
import { QUESTIONS } from "../engine/questions.js";
import { mulberry32, cryptoSeed } from "../engine/rng.js";

export const botKind = (pid) => pid.replace(/^bot-/, "").replace(/\d+$/, "");

// Who gets a card, and which question comes next (the host's own first, then the pack).
export function prepareDeal(state, n, custom = []) {
  const step = state.room.plan[n];
  const hands = Object.keys(state.players).filter((pid) => pid !== state.room.hostUid || state.room.hostPlays);
  const asked = Object.values(state.history).filter((h) => h.round.kind === "question").length;
  const used = new Set(Object.values(state.history).map((h) => h.round.info?.id));
  const pool = QUESTIONS.filter((q) => !used.has(q.id));
  const question = step.kind === "question" ? custom[asked] ?? pool[Math.floor(Math.random() * pool.length)] : undefined;
  return { step, hands, question };
}

export async function dealFor(state, n, custom, now) {
  const { step, hands, question } = prepareDeal(state, n, custom);
  return dealRound({ n, step, rng: mulberry32(cryptoSeed()), hands, now, question });
}

export function runHost(session, now) {
  const rng = mulberry32(cryptoSeed());
  const nextLook = {};
  const tilt = {};
  let busy = false;
  let failures = 0;
  let botBusy = false;

  // The Insider's look at a question's answer is off by a fixed amount for the round.
  const insiderEstimate = (s, pid) => {
    const r = s.round;
    if (r.kind === "cards") return estimate("cards", r.info, s.hands[pid]);
    if (r.kind === "chart") return estimate("chart", r.info);
    if (r.kind === "question" && s.vault?.value != null) {
      const key = `${r.n}:${pid}`;
      tilt[key] ??= rng.normal() * 0.08 * (r.info.hi - r.info.lo) * 100;
      return Math.round(s.vault.value + tilt[key]);
    }
    return null;
  };

  const tick = async () => {
    const s = session.store.get();
    if (!s.room || s.room.hostUid !== session.hostId) return;
    const t = now();
    if (!busy) {
      const action = planHost({ room: s.room, round: s.round, vault: s.vault, now: t });
      if (action) {
        busy = true;
        // A refusal at a round's edge is retried on the next tick; only a repeat is shown.
        session.host[action.type](action)
          .then(() => (failures = 0))
          .catch((e) => {
            failures += 1;
            console.warn("host step refused", action, e);
            if (failures >= 3) session.store.set({ error: `The host screen could not ${action.type} the round: ${e.message}` });
          })
          .finally(() => (busy = false));
      }
    }
    const r = s.round;
    if (!r || r.status !== "live" || !s.market || t < r.startsAt + EDGE_MS || t > r.endsAt - EDGE_MS) return;
    // One bot order at a time, so the bots do not race each other for the market.
    if (botBusy) return;
    const history = [r.p0, ...s.tape.map((x) => x.price)];
    for (const [pid, p] of Object.entries(s.players)) {
      if (!p.bot || (nextLook[pid] ?? 0) > t) continue;
      nextLook[pid] = t + botPause(rng) * 1000;
      const kind = botKind(pid);
      const pos = s.positions[pid] ?? emptyPosition(r);
      const d = botOrder(kind, { m: r, q: s.market.q, n: pos.shares, history, estimate: kind === "informed" ? insiderEstimate(s, pid) : null, rng });
      if (!d) continue;
      botBusy = true;
      session
        .trade(pid, d)
        .catch((e) => console.warn("bot order refused", pid, d, e.message))
        .finally(() => (botBusy = false));
      return;
    }
  };

  const timer = setInterval(tick, 250);
  return () => clearInterval(timer);
}

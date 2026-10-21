import { test } from "node:test";
import assert from "node:assert/strict";
import { cost, fee, liquidation, price, refusal, fill, emptyPosition, potential } from "../src/engine/curve.js";
import { mulberry32, sha256Hex } from "../src/engine/rng.js";
import { QUESTIONS } from "../src/engine/questions.js";
import { KINDS, KIND_ORDER, secretText, parseSecret, estimate } from "../src/engine/kinds.js";
import { BOT_ORDER, botOrder } from "../src/engine/bots.js";
import { worth, roundStandings, roomStandings } from "../src/engine/score.js";
import { defaultPlan, planMinutes, dealRound, planHost, INTERMISSION_MS, EDGE_MS, isRoomCode, newRoomCode } from "../src/engine/host.js";

const m = { p0: 10000, s: 100, feeBps: 10, maxPos: 25, maxOrder: 5, startCash: 100000 };

test("an order costs the steps it walks up the line", () => {
  // the 2023 notebook: buying v at c pays c, c+1, ..., c+v-1
  for (const q of [-7, 0, 12]) {
    for (const d of [1, 2, 5, -1, -3]) {
      let walked = 0;
      if (d > 0) for (let k = 0; k < d; k++) walked += price(m, q + k);
      else for (let k = 1; k <= -d; k++) walked -= price(m, q - k);
      assert.equal(cost(m, q, d), walked, `q=${q} d=${d}`);
      assert.equal(cost(m, q, d), potential(m, q + d) - potential(m, q));
    }
  }
});

test("a round trip costs only the fee", () => {
  const a = fill(m, 3, emptyPosition(m), 5);
  const b = fill(m, 8, a.pos, -5);
  assert.equal(b.pos.shares, 0);
  assert.equal(m.startCash - b.pos.cash, a.fill.fee + b.fill.fee);
});

test("buying cannot raise your own score; others' buying can", () => {
  // last-price scoring rewards pumping: each share bought adds (shares held + 1)
  let pos = emptyPosition(m);
  let q = 0;
  const lastPrice = [];
  const liquid = [];
  for (let i = 0; i < 6; i++) {
    pos = fill({ ...m, feeBps: 0 }, q, pos, 1).pos;
    q += 1;
    lastPrice.push(pos.cash + pos.shares * price(m, q) - m.startCash);
    liquid.push(pos.cash + liquidation(m, q, pos.shares) - m.startCash);
  }
  assert.deepEqual(lastPrice, [1, 3, 6, 10, 15, 21].map((x) => x * 100));
  assert.deepEqual(liquid, [0, 0, 0, 0, 0, 0]);
  // someone else buys 4 more: the holder of 6 gains
  assert.ok(liquidation(m, q + 4, 6) > liquidation(m, q, 6));
});

test("in a free market, profits sum to minus the fees when everyone unwinds", () => {
  const rng = mulberry32(7);
  const fm = { ...m, maxPos: 1000, maxOrder: 1000 };
  const pos = [0, 1, 2, 3].map(() => emptyPosition(fm));
  let q = 0;
  for (let t = 0; t < 400; t++) {
    const i = rng.int(0, 3);
    const d = rng.int(-4, 4) || 1;
    const r = fill(fm, q, pos[i], d);
    pos[i] = r.pos;
    q += d;
  }
  for (let i = 0; i < 4; i++) {
    const r = fill(fm, q, pos[i], -pos[i].shares || 0);
    if (pos[i].shares) {
      q -= pos[i].shares;
      pos[i] = r.pos;
    }
  }
  const profit = pos.reduce((a, p) => a + p.cash - fm.startCash, 0);
  const fees = pos.reduce((a, p) => a + p.fees, 0);
  assert.equal(q, 0);
  assert.equal(profit, -fees);
});

test("refusals match the limits", () => {
  assert.equal(refusal(m, 0, 0, 0) !== null, true);
  assert.match(refusal(m, 0, 0, 6), /5 shares/);
  assert.match(refusal(m, 0, 24, 2), /position limit/);
  assert.match(refusal({ ...m, maxPos: 1000 }, -99, -99, -2), /below zero/);
  assert.equal(refusal(m, 0, 0, -5), null);
});

test("fees floor to the cent", () => {
  assert.equal(fee(m, 10000), 10);
  assert.equal(fee(m, -10999), 10);
  assert.equal(fee(m, 999), 0);
});

// Every built-in answer, checked by a second method.
const sim = (trials, f, seed = 1) => {
  const rng = mulberry32(seed);
  let total = 0;
  for (let i = 0; i < trials; i++) total += f(rng);
  return total / trials;
};
const untilRun = (rng, sides, target, run) => {
  let n = 0;
  let streak = 0;
  while (streak < run) {
    n++;
    streak = rng.int(1, sides) === target ? streak + 1 : 0;
  }
  return n;
};
const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
const checks = {
  "first-six": [() => sim(40000, (r) => untilRun(r, 6, 6, 1)), 0.1],
  "two-heads": [() => sim(40000, (r) => untilRun(r, 2, 1, 2)), 0.1],
  "heads-tails": [() => sim(40000, (r) => { let n = 0, prev = 0; for (;;) { n++; const c = r.int(1, 2); if (prev === 1 && c === 2) return n; prev = c; } }), 0.06],
  "two-sixes": [() => sim(40000, (r) => untilRun(r, 6, 6, 2)), 1],
  banana: [() => new Set(perms([..."BANANA"]).map((p) => p.join(""))).size, 0],
  zeros: [() => { const s = (Array.from({ length: 100 }, (_, i) => BigInt(i + 1)).reduce((a, b) => a * b, 1n)).toString(); return s.length - s.replace(/0+$/, "").length; }, 0],
  primes: [() => Array.from({ length: 1000 }, (_, n) => n).filter((n) => n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d)).length, 0],
  "chess-squares": [() => { let c = 0; for (let k = 1; k <= 8; k++) for (let x = 0; x + k <= 8; x++) for (let y = 0; y + k <= 8; y++) c++; return c; }, 0],
  derangements: [() => perms([0, 1, 2, 3, 4, 5]).filter((p) => p.every((v, i) => v !== i)).length, 0],
  "no-neighbors": [() => { let c = 0; for (let mask = 0; mask < 1024; mask++) if (!(mask & (mask >> 1))) c++; return c; }, 0],
  "four-rolls": [() => { let hit = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) for (let d = 1; d <= 6; d++) if ([a, b, c, d].includes(6)) hit++; return (100 * hit) / 1296; }, 1e-9],
  birthday: [() => 100 * sim(40000, (r) => { const seen = new Set(); for (let i = 0; i < 23; i++) { const b = r.int(1, 365); if (seen.has(b)) return 1; seen.add(b); } return 0; }), 1],
  "all-faces": [() => sim(40000, (r) => { const seen = new Set(); let n = 0; while (seen.size < 6) { n++; seen.add(r.int(1, 6)); } return n; }), 0.15],
  digits: [() => String(2n ** 100n).length, 0],
  "max-two-dice": [() => { let t = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) t += Math.max(a, b); return t / 36; }, 1e-9],
  "full-house": [() => { const ranks = Array.from({ length: 13 }, (_, i) => i); let c = 0; const cards = ranks.flatMap((r) => [0, 1, 2, 3].map(() => r)); const n = cards.length; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let d = b + 1; d < n; d++) for (let e = d + 1; e < n; e++) for (let f = e + 1; f < n; f++) { const cnt = {}; for (const x of [cards[a], cards[b], cards[d], cards[e], cards[f]]) cnt[x] = (cnt[x] ?? 0) + 1; const v = Object.values(cnt).sort().join(""); if (v === "23") c++; } return c; }, 0],
  lattice: [() => { const g = Array.from({ length: 7 }, () => Array(7).fill(1)); for (let i = 1; i < 7; i++) for (let j = 1; j < 7; j++) g[i][j] = g[i - 1][j] + g[i][j - 1]; return g[6][6]; }, 0],
  "first-ace": [() => sim(40000, (r) => { const deck = Array.from({ length: 52 }, (_, i) => i < 4); for (let i = 51; i > 0; i--) { const j = r.int(0, i); [deck[i], deck[j]] = [deck[j], deck[i]]; } return deck.indexOf(true) + 1; }), 0.1],
  handshakes: [() => { let c = 0; for (let a = 0; a < 30; a++) for (let b = a + 1; b < 30; b++) c++; return c; }, 0],
  hats: [() => sim(40000, (r) => { const h = Array.from({ length: 20 }, (_, i) => i); for (let i = 19; i > 0; i--) { const j = r.int(0, i); [h[i], h[j]] = [h[j], h[i]]; } return h.filter((v, i) => v === i).length; }), 0.05],
};

test("every built-in answer agrees with an independent check and sits inside its range", () => {
  assert.equal(Object.keys(checks).length, QUESTIONS.length);
  for (const q of QUESTIONS) {
    const [check, tol] = checks[q.id];
    const got = check();
    assert.ok(Math.abs(got - q.answer()) <= tol, `${q.id}: ${q.answer()} vs ${got}`);
    assert.ok(q.answer() > q.lo && q.answer() < q.hi, `${q.id} out of range`);
    assert.notEqual(Math.round(((q.lo + q.hi) / 2) * 100), Math.round(q.answer() * 100), `${q.id} opens at its answer`);
  }
});

test("each kind deals sane terms, and its secret parses back", async () => {
  for (const kind of KIND_ORDER) {
    const rng = mulberry32(42);
    const made = KINDS[kind].make({ rng, hands: ["a", "b", "c"], durationMs: 180000 });
    for (const key of ["p0", "s", "feeBps", "maxPos", "maxOrder", "startCash"]) assert.ok(Number.isInteger(made.terms[key]) && made.terms[key] >= 0, `${kind}.${key}`);
    assert.ok(made.terms.s >= 1);
    if (made.secret) {
      const text = secretText(made.secret, "salt");
      assert.equal(parseSecret(text).value, made.secret.value);
      assert.equal((await sha256Hex(text)).length, 64);
      for (const r of made.reveals) assert.ok(r.atMs > 0 && r.atMs < 180000);
    }
  }
});

test("a card round pays the sum of the dealt cards, and the chart hides its last four days", () => {
  const rng = mulberry32(3);
  const cards = KINDS.cards.make({ rng, hands: ["a", "b", "c", "d"], durationMs: 240000 });
  const sum = Object.values(cards.secret.detail.hands).reduce((a, b) => a + b, 0);
  assert.equal(cards.secret.value, sum * 100);
  const chart = KINDS.chart.make({ rng, durationMs: 240000 });
  const lastShown = chart.reveals[chart.reveals.length - 1].info.revealed;
  assert.equal(lastShown.length, 16);
  assert.equal(chart.secret.value, chart.secret.detail.future[19]);
});

test("bot estimates move with the evidence", () => {
  const info = { hands: 4, shown: [] };
  assert.equal(estimate("cards", info, null), 4 * 2550);
  assert.ok(estimate("cards", { hands: 4, shown: [50, 49, 48] }, 50) > 4 * 2550);
  assert.equal(estimate("chart", { history: [100, 200], revealed: [300] }, null), 300);
  assert.equal(estimate("free", {}, null), null);
});

test("bots never break the limits", () => {
  const rng = mulberry32(9);
  for (const kind of BOT_ORDER) {
    let q = 0;
    let n = 0;
    const history = [m.p0];
    for (let i = 0; i < 300; i++) {
      const d = botOrder(kind, { m, q, n, history, estimate: kind === "informed" ? 13000 : null, rng });
      if (!d) continue;
      assert.equal(refusal(m, q, n, d), null, `${kind} sent a refused order`);
      q += d;
      n += d;
      history.push(price(m, q));
    }
  }
});

test("standings rank by profit, share ties, and seat the dealer off the podium", () => {
  const round = { ...m, kind: "question", status: "settled", value: 5000 };
  const players = { host: { name: "H" }, a: { name: "A" }, b: { name: "B" }, c: { name: "C" } };
  const positions = {
    host: { shares: 10, cash: m.startCash - 40000, k: 1, fees: 0 },
    a: { shares: 2, cash: m.startCash - 9000, k: 1, fees: 0 },
    b: { shares: -2, cash: m.startCash + 9000, k: 1, fees: 0 },
  };
  const rows = roundStandings({ round, q: 10, positions, players, hostUid: "host" });
  const by = Object.fromEntries(rows.map((r) => [r.pid, r]));
  assert.equal(by.host.dealer, true);
  assert.equal(by.host.rank, null);
  assert.equal(by.a.pnl, 1000);
  assert.equal(by.b.pnl, -1000);
  assert.deepEqual([by.a.rank, by.c.rank, by.b.rank], [1, 2, 3]);
  assert.deepEqual([by.a.points, by.c.points, by.b.points], [1000, 500, 0]);
  const table = roomStandings([rows, rows], players);
  assert.equal(table[0].pid, "a");
  assert.equal(table[0].points, 2000);
  assert.equal(worth({ ...round, kind: "free", status: "settled", value: null }, 0, { shares: 0, cash: 5, k: 0, fees: 0 }), 5);
});

test("plans fit their room length", () => {
  for (const minutes of [10, 20, 30]) {
    const plan = defaultPlan(minutes);
    assert.ok(plan.length >= 3);
    assert.ok(planMinutes(plan) <= minutes, `${minutes}: ${planMinutes(plan)}`);
  }
  assert.deepEqual(defaultPlan(5), [{ kind: "free", seconds: 300 }]);
  assert.deepEqual([...new Set(defaultPlan(30).map((r) => r.kind))], KIND_ORDER);
});

test("the host planner walks a room from deal to finish", async () => {
  const room = { status: "playing", current: 0, plan: [{ kind: "cards", seconds: 60 }, { kind: "free", seconds: 60 }], expiresAt: 1e15 };
  assert.deepEqual(planHost({ room, round: null, now: 0 }), { type: "deal", n: 0 });
  const { round, vault } = await dealRound({ n: 0, step: room.plan[0], rng: mulberry32(1), hands: ["a", "b"], now: 0 });
  assert.equal(planHost({ room, round, vault, now: 1000 }), null);
  const first = planHost({ room, round, vault, now: round.startsAt + vault.reveals[0].atMs });
  assert.equal(first.type, "reveal");
  assert.equal(first.info.step, 1);
  assert.equal(planHost({ room, round, vault, now: round.endsAt })?.type, "reveal");
  assert.deepEqual(planHost({ room, round: { ...round, info: vault.reveals.at(-1).info }, vault, now: round.endsAt + EDGE_MS }), { type: "settle", n: 0 });
  const settled = { ...round, status: "settled" };
  assert.equal(planHost({ room, round: settled, vault, now: round.endsAt + 1000 }), null);
  assert.deepEqual(planHost({ room, round: settled, vault, now: round.endsAt + INTERMISSION_MS }), { type: "advance", n: 1 });
  assert.deepEqual(planHost({ room: { ...room, current: 1 }, round: { ...settled, n: 1 }, now: round.endsAt + INTERMISSION_MS }), { type: "finish" });
});

test("room codes are five unambiguous characters", () => {
  for (let i = 0; i < 50; i++) assert.ok(isRoomCode(newRoomCode()));
  assert.equal(isRoomCode("AB0O1"), false);
});

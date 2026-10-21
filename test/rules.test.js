// Runs firestore.rules in the Firestore emulator: npm run test:rules
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, updateDoc, collection, writeBatch, runTransaction, serverTimestamp, Timestamp, increment } from "firebase/firestore";
import { placeOrder, roundPath } from "../src/data/trade.js";
import { KINDS, secretText } from "../src/engine/kinds.js";
import { cost, fee, price } from "../src/engine/curve.js";
import { mulberry32, sha256Hex } from "../src/engine/rng.js";

const CODE = "ABCDE";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let env;

const google = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "google.com" } }).firestore();
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8181").split(":");
  env = await initializeTestEnvironment({ projectId: "demo-zerosum", firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) } });
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearFirestore());

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
const ms = (t) => Timestamp.fromMillis(t);

async function seedRoom({ hostPlays = false, players = ["bob"], round = {} } = {}) {
  const now = Date.now();
  const terms = { p0: 10000, s: 100, feeBps: 10, maxPos: 25, maxOrder: 5, startCash: 100000 };
  const r = { n: 0, kind: "free", ...terms, info: { step: 0 }, startsAt: ms(now - 1000), endsAt: ms(now + 60000), status: "live", commit: "", ...round };
  await seed(async (db) => {
    await setDoc(doc(db, "access/alice"), { role: "member", via: "seed", at: Timestamp.now(), name: "Alice", email: "alice@example.com" });
    await setDoc(doc(db, `rooms/${CODE}`), { hostUid: "alice", hostName: "Alice", status: "playing", current: 0, plan: [{ kind: r.kind, seconds: 60 }], minutes: 5, hostPlays, createdAt: Timestamp.now(), expiresAt: ms(now + 3600000) });
    for (const pid of [...players, ...(hostPlays ? ["alice"] : [])]) await setDoc(doc(db, `rooms/${CODE}/players/${pid}`), { name: pid, bot: pid.startsWith("bot-"), joinedAt: Timestamp.now() });
    await setDoc(doc(db, roundPath(CODE, 0)), r);
    await setDoc(doc(db, roundPath(CODE, 0), "market", "state"), { q: 0, trades: 0, price: r.p0, lastBy: "", lastAt: Timestamp.now() });
  });
  return { ...r, startsAt: now - 1000, endsAt: r.endsAt.toMillis() };
}

// The honest transaction with one field bent, to show the rules notice.
async function forged(db, { round, pid, d, bend }) {
  const base = roundPath(CODE, 0);
  return runTransaction(db, async (tx) => {
    const st = (await tx.get(doc(db, base, "market", "state"))).data();
    const held = await tx.get(doc(db, base, "positions", pid));
    const pos = held.exists() ? held.data() : { shares: 0, cash: round.startCash, k: 0, fees: 0 };
    const c = cost(round, st.q, d);
    const f = fee(round, c);
    const w = {
      state: { q: st.q + d, trades: st.trades + 1, price: price(round, st.q + d), lastBy: pid, lastAt: serverTimestamp() },
      pos: { shares: pos.shares + d, cash: pos.cash - c - f, k: pos.k + 1, fees: pos.fees + f, lastAt: serverTimestamp() },
      trade: { pid, d, q: st.q, price: price(round, st.q + d), cost: c, fee: f, at: serverTimestamp() },
      tid: `${pid}-${pos.k + 1}`,
    };
    bend(w);
    tx.set(doc(db, base, "market", "state"), w.state);
    tx.set(doc(db, base, "positions", pid), w.pos);
    tx.set(doc(db, base, "trades", w.tid), w.trade);
  });
}

test("the first person to claim an empty deployment owns it, and nobody after", async () => {
  const claim = (db, uid) => {
    const b = writeBatch(db);
    b.set(doc(db, "meta/owner"), { uid, at: serverTimestamp() });
    b.set(doc(db, `access/${uid}`), { role: "admin", via: "owner", at: serverTimestamp(), name: uid, email: `${uid}@example.com` });
    return b.commit();
  };
  await assertFails(setDoc(doc(google("bob"), "access/bob"), { role: "admin", via: "owner", at: serverTimestamp(), name: "bob", email: "bob@example.com" }));
  await assertSucceeds(claim(google("alice"), "alice"));
  await assertFails(claim(google("bob"), "bob"));
  await assertFails(claim(anon("eve"), "eve"));
});

test("invites: admins make them, each use admits one person once", async () => {
  await seed((db) => setDoc(doc(db, "access/alice"), { role: "admin", via: "owner", at: Timestamp.now(), name: "Alice", email: "alice@example.com" }));
  const alice = google("alice");
  const invite = { uses: 0, maxUses: 1, by: "alice", at: serverTimestamp(), expiresAt: ms(Date.now() + 86400000), note: "game night" };
  await assertFails(setDoc(doc(google("bob"), "invites/friends-123"), { ...invite, by: "bob" }));
  await assertSucceeds(setDoc(doc(alice, "invites/friends-123"), invite));
  const redeem = (db, uid, code) => {
    const b = writeBatch(db);
    b.set(doc(db, `access/${uid}`), { role: "member", via: code, at: serverTimestamp(), name: uid, email: `${uid}@example.com` });
    b.update(doc(db, `invites/${code}`), { uses: increment(1) });
    return b.commit();
  };
  await assertFails(setDoc(doc(google("bob"), "access/bob"), { role: "member", via: "friends-123", at: serverTimestamp(), name: "bob", email: "bob@example.com" }));
  await assertFails(redeem(google("bob"), "bob", "no-such-code"));
  await assertSucceeds(redeem(google("bob"), "bob", "friends-123"));
  await assertFails(redeem(google("carol"), "carol", "friends-123"));
  await assertFails(getDocs(collection(google("bob"), "access")));
  await assertSucceeds(getDocs(collection(alice, "access")));
});

test("members host; in open mode anyone signed in may", async () => {
  await seed((db) => setDoc(doc(db, "access/alice"), { role: "admin", via: "owner", at: Timestamp.now(), name: "Alice", email: "alice@example.com" }));
  const room = (uid) => ({ hostUid: uid, hostName: uid, status: "lobby", current: -1, plan: [{ kind: "free", seconds: 300 }], minutes: 5, hostPlays: true, createdAt: serverTimestamp(), expiresAt: ms(Date.now() + 3600000) });
  await assertFails(setDoc(doc(google("carol"), "rooms/QQQQQ"), room("carol")));
  await assertSucceeds(setDoc(doc(google("alice"), "rooms/QQQQQ"), room("alice")));
  await assertFails(setDoc(doc(google("alice"), "rooms/qqqq0"), room("alice")));
  await assertSucceeds(setDoc(doc(google("alice"), "meta/settings"), { mode: "open", by: "alice", at: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(google("carol"), "rooms/WWWWW"), room("carol")));
  await assertFails(setDoc(doc(anon("eve"), "rooms/XXXXX"), room("eve")));
  await assertFails(getDocs(collection(google("carol"), "rooms")));
});

test("a room code lets anyone signed in join, as themselves only", async () => {
  await seedRoom({ players: [] });
  const join = (db, pid) => setDoc(doc(db, `rooms/${CODE}/players/${pid}`), { name: "Carol", bot: false, joinedAt: serverTimestamp() });
  await assertFails(getDocs(collection(google("carol"), `rooms/${CODE}/players`)));
  await assertSucceeds(join(google("carol"), "carol"));
  await assertSucceeds(getDocs(collection(google("carol"), `rooms/${CODE}/players`)));
  await assertFails(join(google("carol"), "dave"));
  await assertFails(join(anon("eve"), "eve"));
  await assertFails(setDoc(doc(google("carol"), `rooms/${CODE}/players/bot-x`), { name: "Bot", bot: true, joinedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(google("alice"), `rooms/${CODE}/players/bot-x`), { name: "Bot", bot: true, joinedAt: serverTimestamp() }));
});

test("an honest order goes through and the books agree", async () => {
  const round = await seedRoom();
  const bob = google("bob");
  await assertSucceeds(placeOrder(bob, { code: CODE, n: 0, round, pid: "bob", d: 3 }));
  await sleep(300);
  await assertSucceeds(placeOrder(bob, { code: CODE, n: 0, round, pid: "bob", d: -5 }));
  const pos = (await getDoc(doc(bob, roundPath(CODE, 0), "positions", "bob"))).data();
  const st = (await getDoc(doc(bob, roundPath(CODE, 0), "market", "state"))).data();
  const first = cost(round, 0, 3);
  const second = cost(round, 3, -5);
  if (pos.shares !== -2 || st.q !== -2 || pos.cash !== round.startCash - first - fee(round, first) - second - fee(round, second)) throw new Error("books disagree");
});

test("every bent field is refused", async () => {
  const round = await seedRoom({ players: ["bob", "carol"] });
  const bob = google("bob");
  const bends = {
    "a cheaper fill": (w) => (w.pos.cash += 50),
    "a smaller fee": (w) => (w.pos.fees -= 1),
    "shares without moving the market": (w) => (w.state.q -= 1),
    "a made-up price": (w) => (w.state.price += 100),
    "a skipped trade count": (w) => (w.state.trades += 1),
    "a trade record that disagrees": (w) => (w.trade.cost += 1),
    "a trade record under another id": (w) => (w.tid = "bob-99"),
    "someone else's name on the order": (w) => (w.state.lastBy = "carol"),
  };
  for (const [what, bend] of Object.entries(bends)) {
    await assertFails(forged(bob, { round, pid: "bob", d: 2, bend }), what);
  }
  await assertFails(forged(bob, { round, pid: "carol", d: 1, bend: () => {} }));
  await assertSucceeds(forged(bob, { round, pid: "bob", d: 2, bend: () => {} }));
});

test("limits, cooldown and the clock are enforced", async () => {
  const round = await seedRoom({ round: { endsAt: ms(Date.now() + 2500) } });
  const bob = google("bob");
  const order = (d) => forged(bob, { round, pid: "bob", d, bend: () => {} });
  await assertFails(order(6));
  await assertSucceeds(order(5));
  await assertFails(order(5));
  await sleep(300);
  await assertSucceeds(order(5));
  await sleep(2600);
  await assertFails(order(-1));
});

test("the host trades for bots, nobody else does", async () => {
  const round = await seedRoom({ players: ["bob", "bot-noise1"] });
  await assertFails(placeOrder(google("bob"), { code: CODE, n: 0, round, pid: "bot-noise1", d: 1 }));
  await assertSucceeds(placeOrder(google("alice"), { code: CODE, n: 0, round, pid: "bot-noise1", d: 1 }));
});

test("cards are private, the vault is the host's, and a settlement must match its commit", async () => {
  const made = KINDS.cards.make({ rng: mulberry32(5), hands: ["bob", "carol"], durationMs: 2000 });
  const text = secretText(made.secret, "salty");
  const round = await seedRoom({ players: ["bob", "carol"], round: { kind: "cards", ...made.terms, info: made.info, commit: await sha256Hex(text), endsAt: ms(Date.now() + 1500) } });
  const alice = google("alice");
  const base = roundPath(CODE, 0);
  await assertSucceeds(setDoc(doc(alice, base, "hands", "bob"), { card: made.secret.detail.hands.bob }));
  await assertSucceeds(setDoc(doc(alice, base, "hands", "carol"), { card: made.secret.detail.hands.carol }));
  await assertFails(setDoc(doc(google("bob"), base, "hands", "bob"), { card: 50 }));
  await assertSucceeds(getDoc(doc(google("bob"), base, "hands", "bob")));
  await assertFails(getDoc(doc(google("bob"), base, "hands", "carol")));
  await assertSucceeds(setDoc(doc(alice, base, "vault", "secret"), { text }));
  await assertFails(getDoc(doc(google("bob"), base, "vault", "secret")));

  const settle = (db, secret, value) => updateDoc(doc(db, base), { status: "settled", secret, value, settledAt: serverTimestamp() });
  await assertFails(settle(alice, text, made.secret.value));
  await sleep(1600);
  await assertFails(settle(google("bob"), text, made.secret.value));
  await assertFails(settle(alice, text.replace("salty", "sweet"), made.secret.value));
  await assertFails(settle(alice, text, made.secret.value + 100));
  await assertSucceeds(settle(alice, text, made.secret.value));
  await assertFails(placeOrder(google("bob"), { code: CODE, n: 0, round, pid: "bob", d: 1 }));
});

test("only the host deals rounds, with sane terms", async () => {
  await seedRoom();
  await seed((db) => updateDoc(doc(db, `rooms/${CODE}`), { current: 1 }));
  const now = Date.now();
  const r = { n: 1, kind: "free", p0: 10000, s: 100, feeBps: 10, maxPos: 25, maxOrder: 5, startCash: 100000, info: { step: 0 }, startsAt: ms(now + 3000), endsAt: ms(now + 183000), status: "live", commit: "" };
  await assertFails(setDoc(doc(google("bob"), roundPath(CODE, 1)), r));
  await assertFails(setDoc(doc(google("alice"), roundPath(CODE, 1)), { ...r, s: 0 }));
  await assertFails(setDoc(doc(google("alice"), roundPath(CODE, 1)), { ...r, endsAt: ms(now + 3000 + 11 * 60000) }));
  await assertFails(setDoc(doc(google("alice"), roundPath(CODE, 2)), { ...r, n: 2 }));
  await assertSucceeds(setDoc(doc(google("alice"), roundPath(CODE, 1)), r));
});

test("orders that race each other all land", async () => {
  const players = ["bob", "carol", "dave", "erin"];
  const round = await seedRoom({ players });
  const results = await Promise.allSettled(players.map((pid) => placeOrder(google(pid), { code: CODE, n: 0, round, pid, d: 1 })));
  const failed = results.filter((r) => r.status === "rejected").map((r) => r.reason?.code ?? r.reason?.message);
  const st = (await getDoc(doc(google("bob"), roundPath(CODE, 0), "market", "state"))).data();
  if (failed.length || st.q !== players.length) throw new Error(`q=${st.q}, refused: ${failed.join(", ")}`);
});

// A real room: Firestore listeners in, rule-checked writes out.

import { doc, collection, query, orderBy, onSnapshot, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, now } from "./firebase.js";
import { createStore, emptySession, plain } from "./store.js";
import { placeOrder, roundPath } from "./trade.js";
import { dealFor, runHost } from "./hostLoop.js";
import { KINDS } from "../engine/kinds.js";
import { botName } from "./botNames.js";
import { newRoomCode, ROOM_GRACE_MS } from "../engine/host.js";

const ts = (ms) => Timestamp.fromMillis(Math.round(ms));
const byId = (snap) => Object.fromEntries(snap.docs.map((d) => [d.id, plain(d.data())]));
const playerName = (user) => (user.displayName || "Trader").split(" ")[0].slice(0, 24);

export function friendly(e) {
  const msg = e?.message ?? String(e);
  if (e?.code === "permission-denied" || /permission/i.test(msg)) return "Refused: the round may have closed, or you are trading too fast.";
  if (e?.code === "failed-precondition" || e?.code === "aborted") return "Busy market, try again.";
  return msg;
}

export async function createRoom(user, { minutes, plan, hostPlays, bots, questions }) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newRoomCode();
    const ref = doc(db, "rooms", code);
    const made = await runTransaction(db, async (tx) => {
      if ((await tx.get(ref)).exists()) return false;
      tx.set(ref, {
        hostUid: user.uid,
        hostName: playerName(user),
        status: "lobby",
        current: -1,
        plan,
        minutes,
        hostPlays,
        createdAt: serverTimestamp(),
        expiresAt: ts(now() + minutes * 60000 + ROOM_GRACE_MS),
      });
      return true;
    });
    if (!made) continue;
    const batch = writeBatch(db);
    if (hostPlays) batch.set(doc(db, "rooms", code, "players", user.uid), { name: playerName(user), bot: false, joinedAt: serverTimestamp() });
    const count = {};
    for (const kind of bots) {
      count[kind] = (count[kind] ?? 0) + 1;
      batch.set(doc(db, "rooms", code, "players", `bot-${kind}${count[kind]}`), { name: botName(kind, count[kind]), bot: true, joinedAt: serverTimestamp() });
    }
    batch.set(doc(db, "rooms", code, "private", "setup"), { questions });
    batch.set(doc(db, "users", user.uid, "games", code), { code, at: serverTimestamp(), host: true });
    await batch.commit();
    return code;
  }
  throw new Error("Could not find a free room code. Try again.");
}

export function remoteSession(user, code) {
  const store = createStore({ ...emptySession, me: user.uid });
  const session = { kind: "remote", store, hostId: user.uid, me: user.uid };
  const unsubs = [];
  let roundUnsubs = [];
  let following = null;
  let attached = false;
  let custom = [];
  let stopHost = null;

  const fail = (e) => store.set({ error: friendly(e) });
  const isHost = () => store.get().room?.hostUid === user.uid;
  const base = (k) => roundPath(code, k);

  async function settledSnapshot(k, round) {
    const [state, positions] = await Promise.all([getDoc(doc(db, base(k), "market", "state")), getDocs(collection(db, base(k), "positions"))]);
    return { round, q: state.data()?.q ?? 0, positions: byId(positions) };
  }

  async function onRoundOpened(k, round) {
    const trades = await getDocs(query(collection(db, base(k), "trades"), orderBy("at")));
    if (following !== k) return;
    const tape = trades.docs.map((d) => {
      const t = plain(d.data());
      return { t: t.at, price: t.price, pid: t.pid, d: t.d };
    });
    store.set((s) => ({ tape: [...tape, ...s.tape.filter((x) => x.t > (tape.at(-1)?.t ?? 0))] }));
    if (isHost()) {
      const [vault, hands] = await Promise.all([getDoc(doc(db, base(k), "vault", "secret")), getDocs(collection(db, base(k), "hands"))]);
      if (following === k) store.set({ vault: vault.data() ?? null, hands: Object.fromEntries(hands.docs.map((d) => [d.id, d.data().card])) });
    }
    if (round.kind === "cards" && store.get().players[user.uid]) {
      const hand = await getDoc(doc(db, base(k), "hands", user.uid)).catch(() => null);
      if (following === k && hand?.exists()) store.set({ hand: hand.data().card });
    }
  }

  async function onRoundSettled(k, round) {
    const snap = await settledSnapshot(k, round);
    store.set((s) => ({ history: { ...s.history, [k]: snap }, positions: following === k ? snap.positions : s.positions }));
  }

  function followRound(k) {
    roundUnsubs.forEach((u) => u());
    roundUnsubs = [];
    following = k;
    store.set({ round: null, market: null, positions: {}, hand: null, tape: [], vault: null, hands: {} });
    if (k < 0) return;
    roundUnsubs.push(
      onSnapshot(doc(db, base(k)), (snap) => {
        if (!snap.exists()) return;
        const round = plain(snap.data());
        const prev = store.get().round;
        store.set({ round });
        if (!prev) onRoundOpened(k, round).catch(fail);
        if (round.status === "settled" && prev?.status !== "settled") onRoundSettled(k, round).catch(fail);
      }, fail),
      onSnapshot(doc(db, base(k), "market", "state"), (snap) => {
        if (!snap.exists()) return;
        const m = plain(snap.data());
        store.set((s) => ({
          market: m,
          tape: m.trades > 0 && m.lastAt > (s.tape.at(-1)?.t ?? 0) ? [...s.tape, { t: m.lastAt, price: m.price, pid: m.lastBy }] : s.tape,
        }));
      }, fail),
      isHost()
        ? onSnapshot(collection(db, base(k), "positions"), (snap) => store.set({ positions: byId(snap) }), fail)
        : onSnapshot(doc(db, base(k), "positions", user.uid), (snap) => {
            if (snap.exists()) store.set((s) => ({ positions: { ...s.positions, [user.uid]: plain(snap.data()) } }));
          }, fail),
    );
  }

  async function loadHistory(current) {
    const rounds = await getDocs(collection(db, "rooms", code, "rounds"));
    const done = rounds.docs.map((d) => plain(d.data())).filter((r) => r.status === "settled" && r.n !== current);
    const snaps = await Promise.all(done.map((r) => settledSnapshot(r.n, r)));
    store.set((s) => ({ history: { ...Object.fromEntries(snaps.map((h) => [h.round.n, h])), ...s.history } }));
  }

  // Everything past the room document needs you to be in the room.
  async function attach() {
    if (attached) return;
    attached = true;
    unsubs.push(onSnapshot(collection(db, "rooms", code, "players"), (snap) => store.set({ players: byId(snap) }), fail));
    if (isHost()) {
      custom = (await getDoc(doc(db, "rooms", code, "private", "setup"))).data()?.questions ?? [];
      stopHost = runHost(session, now);
    }
    const room = store.get().room;
    if (room.current >= 0) followRound(room.current);
    loadHistory(room.current).catch(fail);
  }

  unsubs.push(
    onSnapshot(doc(db, "rooms", code), async (snap) => {
      if (!snap.exists()) return store.set({ ready: true, room: null, error: "No room has that code." });
      const room = { code, ...plain(snap.data()) };
      const first = !store.get().room;
      store.set({ room });
      if (first) {
        const joined = room.hostUid === user.uid || (await getDoc(doc(db, "rooms", code, "players", user.uid)).then((d) => d.exists(), () => false));
        store.set({ ready: true, joined });
        if (joined) attach().catch(fail);
      } else if (attached && room.current !== following) followRound(room.current);
    }, fail),
  );

  session.join = async (name) => {
    const batch = writeBatch(db);
    batch.set(doc(db, "rooms", code, "players", user.uid), { name: name.slice(0, 24), bot: false, joinedAt: serverTimestamp() });
    batch.set(doc(db, "users", user.uid, "games", code), { code, at: serverTimestamp(), host: false });
    await batch.commit();
    store.set({ joined: true });
    await attach();
  };

  session.trade = (pid, d) => {
    const s = store.get();
    if (!s.round) return Promise.reject(new Error("No round is open."));
    return placeOrder(db, { code, n: s.round.n, round: s.round, pid, d });
  };
  session.order = (d) => session.trade(user.uid, d).catch((e) => {
    fail(e);
    throw e;
  });

  session.lobby = {
    start: () => updateDoc(doc(db, "rooms", code), { status: "playing", current: 0 }),
    end: () => updateDoc(doc(db, "rooms", code), { status: "done" }),
    addBot: (kind) => {
      const taken = Object.keys(store.get().players).filter((p) => p.startsWith(`bot-${kind}`)).length;
      return setDoc(doc(db, "rooms", code, "players", `bot-${kind}${taken + 1}`), { name: botName(kind, taken + 1), bot: true, joinedAt: serverTimestamp() });
    },
    removeBot: (pid) => deleteDoc(doc(db, "rooms", code, "players", pid)),
    rename: (name) => updateDoc(doc(db, "rooms", code, "players", user.uid), { name: name.slice(0, 24) }),
  };

  session.host = {
    async deal({ n }) {
      const { round, vault } = await dealFor(store.get(), n, custom, now());
      const batch = writeBatch(db);
      batch.set(doc(db, base(n)), { ...round, startsAt: ts(round.startsAt), endsAt: ts(round.endsAt) });
      batch.set(doc(db, base(n), "market", "state"), { q: 0, trades: 0, price: round.p0, lastBy: "", lastAt: serverTimestamp() });
      if (KINDS[round.kind].hidden) batch.set(doc(db, base(n), "vault", "secret"), vault);
      for (const [pid, card] of Object.entries(vault.hands)) batch.set(doc(db, base(n), "hands", pid), { card });
      await batch.commit();
      if (following === n) store.set({ vault, hands: vault.hands });
    },
    reveal: ({ n, info }) => updateDoc(doc(db, base(n)), { info }),
    async settle({ n }) {
      const { round, vault } = store.get();
      const hidden = KINDS[round.kind].hidden;
      await updateDoc(doc(db, base(n)), hidden ? { status: "settled", secret: vault.text, value: vault.value, settledAt: serverTimestamp() } : { status: "settled", settledAt: serverTimestamp() });
    },
    advance: ({ n }) => updateDoc(doc(db, "rooms", code), { current: n }),
    finish: () => updateDoc(doc(db, "rooms", code), { status: "done" }),
  };

  session.dispose = () => {
    stopHost?.();
    unsubs.forEach((u) => u());
    roundUnsubs.forEach((u) => u());
  };
  return session;
}

export async function roomExists(code) {
  const snap = await getDoc(doc(db, "rooms", code));
  return snap.exists() ? plain(snap.data()) : null;
}

// A finished room, rebuilt from its rule-checked records: every round's terms, final
// market, positions and trades. Standings are recomputed here, never read from a
// stored leaderboard, so the profile page cannot show a score the trades did not earn.

import { doc, collection, getDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase.js";
import { plain } from "./store.js";
import { roundStandings, roomStandings } from "../engine/score.js";

const byId = (snap) => Object.fromEntries(snap.docs.map((d) => [d.id, plain(d.data())]));

export async function loadRecap(code) {
  const roomSnap = await getDoc(doc(db, "rooms", code));
  if (!roomSnap.exists()) return null;
  const room = { code, ...plain(roomSnap.data()) };
  const [players, rounds] = await Promise.all([getDocs(collection(db, "rooms", code, "players")), getDocs(collection(db, "rooms", code, "rounds"))]);
  const playerMap = byId(players);
  const settled = rounds.docs.map((d) => plain(d.data())).filter((r) => r.status === "settled").sort((a, b) => a.n - b.n);
  const perRound = await Promise.all(
    settled.map(async (round) => {
      const base = `rooms/${code}/rounds/${round.n}`;
      const [state, positions, trades] = await Promise.all([
        getDoc(doc(db, base, "market", "state")),
        getDocs(collection(db, base, "positions")),
        getDocs(query(collection(db, base, "trades"), orderBy("at"))),
      ]);
      const q = state.data()?.q ?? 0;
      const pos = byId(positions);
      return {
        round,
        q,
        positions: pos,
        trades: trades.docs.map((d) => plain(d.data())),
        standings: roundStandings({ round, q, positions: pos, players: playerMap, hostUid: room.hostUid }),
      };
    }),
  );
  return { room, players: playerMap, rounds: perRound, table: roomStandings(perRound.map((r) => r.standings), playerMap) };
}

export async function listGames(uid, max = 30) {
  const snap = await getDocs(query(collection(db, "users", uid, "games"), orderBy("at", "desc"), limit(max)));
  return snap.docs.map((d) => plain(d.data()));
}

// Lifetime numbers across the rooms you played, each recomputed from its records.
export function summarize(uid, recaps) {
  const out = { rooms: 0, rounds: 0, wins: 0, podiums: 0, points: 0, pnl: 0, roomWins: 0, best: null };
  for (const recap of recaps) {
    if (!recap) continue;
    const row = recap.table.find((r) => r.pid === uid);
    if (!row || row.rounds === 0) continue;
    out.rooms += 1;
    out.rounds += row.rounds;
    out.wins += row.wins;
    out.points += row.points;
    out.pnl += row.pnl;
    if (row.rank === 1) out.roomWins += 1;
    for (const r of recap.rounds) {
      const mine = r.standings.find((s) => s.pid === uid);
      if (mine?.rank && mine.rank <= 3) out.podiums += 1;
      if (mine && (!out.best || mine.pnl > out.best.pnl)) out.best = { pnl: mine.pnl, kind: r.round.kind, code: recap.room.code };
    }
  }
  return out;
}

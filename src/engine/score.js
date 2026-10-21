// Scores are recomputed from the rule-checked positions and the settlement, never stored,
// so a leaderboard cannot say anything the trades did not.

import { liquidation, emptyPosition } from "./curve.js";
import { KINDS } from "./kinds.js";

// What a position is worth: the settlement value per share once a hidden round settles,
// otherwise what it fetches unwound alone down the line.
export function worth(round, q, pos) {
  if (round.status === "settled" && round.value != null) return pos.cash + pos.shares * round.value;
  return pos.cash + liquidation(round, q, pos.shares);
}

export const pnl = (round, q, pos) => worth(round, q, pos) - round.startCash;

// The host's own device deals hidden rounds, so a playing host is the dealer there and
// sits off that round's podium.
export const isDealer = (round, pid, hostUid) => KINDS[round.kind].hidden && pid === hostUid;

// Every player who was in the room, ranked by profit. Ties share a rank. Points run from
// 1000 for first to 0 for last, Kahoot style, so a round with big prices does not count
// for more than one with small ones.
export function roundStandings({ round, q, positions, players, hostUid }) {
  const rows = Object.entries(players).map(([pid, p]) => {
    const pos = positions[pid] ?? emptyPosition(round);
    return { pid, name: p.name, bot: !!p.bot, shares: pos.shares, trades: pos.k, fees: pos.fees, pnl: pnl(round, q, pos), dealer: isDealer(round, pid, hostUid) };
  });
  const ranked = rows.filter((r) => !r.dealer);
  const n = ranked.length;
  for (const r of ranked) {
    r.rank = 1 + ranked.filter((o) => o.pnl > r.pnl).length;
    r.points = n > 1 ? Math.round((1000 * (n - r.rank)) / (n - 1)) : r.pnl >= 0 ? 1000 : 0;
  }
  for (const r of rows.filter((r) => r.dealer)) Object.assign(r, { rank: null, points: 0 });
  return rows.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || b.pnl - a.pnl);
}

// The room's table: points summed over rounds, profit breaks ties.
export function roomStandings(perRound, players) {
  const total = Object.fromEntries(Object.entries(players).map(([pid, p]) => [pid, { pid, name: p.name, bot: !!p.bot, points: 0, pnl: 0, wins: 0, rounds: 0 }]));
  for (const rows of perRound) {
    for (const r of rows) {
      const t = (total[r.pid] ??= { pid: r.pid, name: r.name, bot: r.bot, points: 0, pnl: 0, wins: 0, rounds: 0 });
      t.points += r.points;
      t.pnl += r.pnl;
      t.rounds += 1;
      if (r.rank === 1) t.wins += 1;
    }
  }
  const rows = Object.values(total).sort((a, b) => b.points - a.points || b.pnl - a.pnl);
  rows.forEach((r, i) => (r.rank = i > 0 && rows[i - 1].points === r.points && rows[i - 1].pnl === r.pnl ? rows[i - 1].rank : i + 1));
  return rows;
}

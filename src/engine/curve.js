// The market is one straight line. With q shares held across all players, the price is
// p0 + s*q cents. Buying d shares walks up the line and pays every step on the way, so
// the cost of an order is the area under the line, F(q + d) - F(q). Because that area
// does not depend on the path, buying and selling the same shares back costs nothing
// but the fee: every dollar one player makes, another player loses.
//
// Every amount is an integer number of cents. firestore.rules repeats these formulas,
// so a client that lies about a fill is refused by the database.

export const potential = (m, x) => m.p0 * x + (m.s * x * (x - 1)) / 2;

export const price = (m, q) => m.p0 + m.s * q;

// What d shares cost when q are held. Negative d is a sale and its cost is negative.
export const cost = (m, q, d) => d * m.p0 + m.s * (d * q + (d * (d - 1)) / 2);

export const fee = (m, c) => Math.floor((Math.abs(c) * m.feeBps) / 10000);

// What a position of n shares fetches if its holder unwinds it alone, right now.
export const liquidation = (m, q, n) => potential(m, q) - potential(m, q - n);

// The reason an order would be refused, or null. Mirrors the checks in firestore.rules.
export function refusal(m, q, n, d) {
  if (!Number.isInteger(d) || d === 0) return "order size must be a whole number of shares";
  if (Math.abs(d) > m.maxOrder) return `at most ${m.maxOrder} shares per order`;
  if (Math.abs(n + d) > m.maxPos) return `position limit is ${m.maxPos} shares either way`;
  if (price(m, q + d) < 0) return "the price cannot go below zero";
  return null;
}

// Apply one order to a position. Returns the new position and the fill.
export function fill(m, q, pos, d) {
  const c = cost(m, q, d);
  const f = fee(m, c);
  return {
    pos: { shares: pos.shares + d, cash: pos.cash - c - f, k: pos.k + 1, fees: pos.fees + f },
    fill: { d, q, price: price(m, q + d), cost: c, fee: f },
  };
}

export const emptyPosition = (m) => ({ shares: 0, cash: m.startCash, k: 0, fees: 0 });

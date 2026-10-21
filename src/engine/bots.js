// Bots trade on the host's screen through the same orders and the same rules as people.
// Two come from Jai's notebooks: Coinflip is the softmax bot from Stock Game.ipynb
// (April 2023), and Reverter is the z-score trade from Stock_Study.ipynb (May 2024).

import { price, refusal } from "./curve.js";

const softmax = (v) => {
  const e = v.map(Math.exp);
  const total = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / total);
};

const clampToLimits = (m, q, n, d) => {
  let size = Math.max(-m.maxOrder, Math.min(m.maxOrder, d));
  while (size !== 0 && refusal(m, q, n, size)) size -= Math.sign(size);
  return size;
};

export const BOTS = {
  noise: {
    name: "Coinflip",
    about: "Draws two random scores, softmaxes them, and buys or sells by the result (Stock Game.ipynb, 2023).",
    decide({ rng }) {
      const [pBuy] = softmax([rng.uniform(-10, 10), rng.uniform(-10, 10)]);
      return (rng.next() < pBuy ? 1 : -1) * rng.int(1, 3);
    },
  },
  momentum: {
    name: "Trendy",
    about: "Buys after the price rose over its last few ticks and sells after it fell.",
    decide({ history, rng }) {
      if (history.length < 6) return rng.next() < 0.5 ? 1 : -1;
      const move = history[history.length - 1] - history[history.length - 6];
      return move === 0 ? 0 : Math.sign(move) * rng.int(1, 2);
    },
  },
  revert: {
    name: "Reverter",
    about: "Scores the last ten ticks against their own spread and bets the move undoes itself (Stock_Study.ipynb, 2024).",
    decide({ history, rng }) {
      if (history.length < 10) return 0;
      const window = history.slice(-10);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const sd = Math.sqrt(window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length) || 1;
      const z = (window[window.length - 1] - mean) / sd;
      return Math.abs(z) < 1 ? 0 : -Math.sign(z) * rng.int(1, 2);
    },
  },
  informed: {
    name: "Insider",
    about: "Trades toward its estimate of what a share pays: the card sum it expects, the last close it has seen, or a noisy look at the answer.",
    decide({ m, q, estimate, rng }) {
      if (estimate == null) return rng.next() < 0.3 ? (rng.next() < 0.5 ? 1 : -1) : 0;
      const gap = estimate - price(m, q);
      if (Math.abs(gap) <= m.s) return 0;
      return Math.sign(gap) * Math.min(m.maxOrder, Math.ceil(Math.abs(gap) / (2 * m.s)));
    },
  },
};

export const BOT_ORDER = ["noise", "momentum", "revert", "informed"];

// One decision, already trimmed to the order and position limits. 0 means no trade.
export function botOrder(kind, ctx) {
  const d = BOTS[kind].decide(ctx);
  return d === 0 ? 0 : clampToLimits(ctx.m, ctx.q, ctx.n, Math.round(d));
}

// Seconds until a bot looks at the market again.
export const botPause = (rng) => rng.uniform(1.5, 4);

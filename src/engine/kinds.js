// The four kinds of round. Each one is the same price line with a different answer to
// "what is a share worth at the end?":
//
//   free      nothing. The 2023 notebook's game: the price is only order flow, and a
//             position is worth what it fetches when unwound alone down the line.
//   cards     the sum of every player's private card (the Traders at Berkeley game).
//   chart     a stock's close 20 days after the chart ends, days revealed as you trade
//             (Stock_Study.ipynb's question, turned into a market).
//   question  the answer to a question, Kahoot style.
//
// make() returns the market's terms, the public info, the hidden value with whatever
// produced it, and a schedule of reveals. All money is in cents.

import { QUESTIONS } from "./questions.js";

const DOLLAR = 100;

const baseTerms = { feeBps: 10, maxOrder: 5, startCash: 1000 * DOLLAR };

export const CARD_DISTS = {
  uniform: () => 1,
  low: (k) => 51 - k,
  high: (k) => k,
  edges: (k) => Math.abs(k - 25.5) + 2,
};

const draw = (rng, dist) => 1 + rng.weighted(Array.from({ length: 50 }, (_, i) => CARD_DISTS[dist](i + 1)));

export const KINDS = {
  free: {
    label: "Free market",
    hidden: false,
    blurb: "No underlying. The price is wherever everyone's orders push it, and you score what your position fetches if you sell it all back alone at the end.",
    make() {
      return {
        terms: { ...baseTerms, p0: 100 * DOLLAR, s: 1 * DOLLAR, maxPos: 25 },
        info: { step: 0 },
        secret: null,
        reveals: [],
      };
    },
  },

  cards: {
    label: "Card market",
    hidden: true,
    blurb: "Everyone holds one secret card from 1 to 50, drawn from a deck that may be lopsided. A share pays the sum of all the cards. Public cards from the same deck turn up as you trade.",
    make({ rng, hands, durationMs }) {
      const dist = rng.pick(Object.keys(CARD_DISTS));
      const dealt = Object.fromEntries(hands.map((pid) => [pid, draw(rng, dist)]));
      const sum = Object.values(dealt).reduce((a, b) => a + b, 0);
      const shownCards = Array.from({ length: 4 }, () => draw(rng, dist));
      const n = hands.length;
      const sd = 14.43 * Math.sqrt(n);
      return {
        terms: { ...baseTerms, p0: Math.round(25.5 * n * DOLLAR), s: Math.max(1, Math.round((sd * DOLLAR) / 8)), maxPos: 20 },
        info: { step: 0, hands: n, shown: [] },
        secret: { value: sum * DOLLAR, detail: { dist, hands: dealt, shown: shownCards } },
        reveals: shownCards.map((_, i) => ({
          atMs: Math.round((durationMs * (i + 1)) / 5),
          info: { step: i + 1, hands: n, shown: shownCards.slice(0, i + 1) },
        })),
      };
    },
  },

  chart: {
    label: "Chart market",
    hidden: true,
    blurb: "A stock's last 60 days are on the screen. A share pays its close 20 days later. Sixteen of those days are revealed while you trade; the last four stay hidden.",
    make({ rng, durationMs }) {
      const sigma = rng.uniform(0.01, 0.03);
      const mu = rng.normal() * 0.002;
      const jumpDay = rng.next() < 0.35 ? rng.int(61, 80) : -1;
      const jump = (rng.next() < 0.5 ? -1 : 1) * rng.uniform(0.08, 0.2);
      const closes = [rng.uniform(40, 160)];
      for (let day = 2; day <= 80; day++) {
        const shock = mu - (sigma * sigma) / 2 + sigma * rng.normal() + (day === jumpDay ? jump : 0);
        closes.push(closes[closes.length - 1] * Math.exp(shock));
      }
      const cents = closes.map((c) => Math.max(1, Math.round(c * DOLLAR)));
      const history = cents.slice(0, 60);
      const future = cents.slice(60);
      const last = history[59];
      return {
        terms: { ...baseTerms, p0: last, s: Math.max(1, Math.round((last * sigma * Math.sqrt(20)) / 8)), maxPos: 20 },
        info: { step: 0, history, revealed: [], horizon: 20 },
        secret: { value: future[19], detail: { sigma, mu, jumpDay, future } },
        reveals: future.slice(0, 16).map((_, i) => ({
          atMs: Math.round((durationMs * (i + 1)) / 17),
          info: { step: i + 1, history, revealed: future.slice(0, i + 1), horizon: 20 },
        })),
      };
    },
  },

  question: {
    label: "Question market",
    hidden: true,
    blurb: "A question with a numeric answer and a public range. A share pays the answer in dollars. The market opens in the middle of the range.",
    make({ rng, question }) {
      const q = question ?? rng.pick(QUESTIONS);
      const answer = typeof q.answer === "function" ? q.answer() : q.answer;
      const value = Math.round(Math.min(q.hi, Math.max(q.lo, answer)) * DOLLAR);
      return {
        terms: { ...baseTerms, p0: Math.round(((q.lo + q.hi) / 2) * DOLLAR), s: Math.max(1, Math.round(((q.hi - q.lo) * DOLLAR) / 40)), maxPos: 20 },
        info: { step: 0, prompt: q.prompt, lo: q.lo, hi: q.hi, id: q.id ?? "custom" },
        secret: { value, detail: { answer } },
        reveals: [],
      };
    },
  },
};

export const KIND_ORDER = ["free", "cards", "chart", "question"];

// The committed text is "value|salt|detail". The rules check the hash and that the
// value written beside it is the first field.
export const secretText = (secret, salt) => `${secret.value}|${salt}|${JSON.stringify(secret.detail)}`;

export function parseSecret(text) {
  const [value, salt, ...rest] = text.split("|");
  return { value: Number(value), salt, detail: JSON.parse(rest.join("|")) };
}

// A bot's best guess of the settlement value from what is public plus its own card.
export function estimate(kind, info, card) {
  if (kind === "cards") {
    const seen = [...(info.shown ?? []), ...(card ? [card] : [])];
    const mean = (25.5 * 2 + seen.reduce((a, b) => a + b, 0)) / (2 + seen.length);
    return Math.round(((card ?? 0) + (info.hands - (card ? 1 : 0)) * mean) * DOLLAR);
  }
  if (kind === "chart") {
    const known = [...info.history, ...info.revealed];
    return known[known.length - 1];
  }
  return null;
}

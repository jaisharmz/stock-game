// The built-in question pack. Each answer is computed here rather than typed in, and
// test/engine.test.js checks every one by a second, independent method (enumeration or
// simulation). The range is public; the market opens at its midpoint.

const choose = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};
const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));
const harmonic = (n) => Array.from({ length: n }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b, 0);

function primesBelow(n) {
  const sieve = new Uint8Array(n).fill(1);
  sieve[0] = sieve[1] = 0;
  for (let i = 2; i * i < n; i++) if (sieve[i]) for (let j = i * i; j < n; j += i) sieve[j] = 0;
  return sieve.reduce((a, b) => a + b, 0);
}

function derangements(n) {
  let [a, b] = [1, 0];
  for (let i = 2; i <= n; i++) [a, b] = [b, (i - 1) * (a + b)];
  return n === 0 ? 1 : b;
}

export const QUESTIONS = [
  { id: "first-six", prompt: "Expected number of rolls of a fair die until the first 6", lo: 1, hi: 30, answer: () => 6 },
  { id: "two-heads", prompt: "Expected number of fair coin flips until two heads in a row", lo: 2, hi: 30, answer: () => 2 ** 3 - 2 },
  { id: "heads-tails", prompt: "Expected number of fair coin flips until heads is followed by tails", lo: 2, hi: 30, answer: () => 2 + 2 },
  { id: "two-sixes", prompt: "Expected number of die rolls until two 6s in a row", lo: 6, hi: 200, answer: () => 6 + 36 },
  { id: "banana", prompt: "Distinct arrangements of the letters of BANANA", lo: 1, hi: 720, answer: () => factorial(6) / (factorial(3) * factorial(2)) },
  { id: "zeros", prompt: "Trailing zeros at the end of 100!", lo: 0, hi: 100, answer: () => Math.floor(100 / 5) + Math.floor(100 / 25) },
  { id: "primes", prompt: "Prime numbers below 1000", lo: 0, hi: 500, answer: () => primesBelow(1000) },
  { id: "chess-squares", prompt: "Squares of every size on an 8 by 8 chessboard", lo: 64, hi: 500, answer: () => [1, 2, 3, 4, 5, 6, 7, 8].reduce((a, k) => a + k * k, 0) },
  { id: "derangements", prompt: "Ways to put 6 letters in 6 envelopes so that none is in its own envelope", lo: 0, hi: 720, answer: () => derangements(6) },
  { id: "no-neighbors", prompt: "Subsets of {1, ..., 10} with no two consecutive numbers (the empty set counts)", lo: 10, hi: 1024, answer: () => { let [a, b] = [1, 2]; for (let i = 2; i <= 10; i++) [a, b] = [b, a + b]; return b; } },
  { id: "four-rolls", prompt: "Chance, in percent, of at least one 6 in four rolls of a die", lo: 0, hi: 100, answer: () => 100 * (1 - (5 / 6) ** 4) },
  { id: "birthday", prompt: "Chance, in percent, that two of 23 people share a birthday (365 equally likely days)", lo: 0, hi: 100, answer: () => { let p = 1; for (let k = 0; k < 23; k++) p *= (365 - k) / 365; return 100 * (1 - p); } },
  { id: "all-faces", prompt: "Expected number of die rolls until every face has appeared", lo: 6, hi: 50, answer: () => 6 * harmonic(6) },
  { id: "digits", prompt: "Digits in 2 to the power 100", lo: 1, hi: 100, answer: () => (2n ** 100n).toString().length },
  { id: "max-two-dice", prompt: "Expected value of the larger of two fair dice", lo: 1, hi: 6, answer: () => 161 / 36 },
  { id: "full-house", prompt: "Five-card hands from a 52-card deck that are a full house", lo: 0, hi: 10000, answer: () => 13 * choose(4, 3) * 12 * choose(4, 2) },
  { id: "lattice", prompt: "Paths from (0, 0) to (6, 6) that only step right or up", lo: 1, hi: 5000, answer: () => choose(12, 6) },
  { id: "first-ace", prompt: "Expected number of cards dealt from a shuffled deck up to and including the first ace", lo: 1, hi: 49, answer: () => 53 / 5 },
  { id: "handshakes", prompt: "Handshakes when 30 people each shake hands with everyone else once", lo: 0, hi: 900, answer: () => choose(30, 2) },
  { id: "hats", prompt: "Expected number of people who get their own hat back when 20 hats are handed back at random", lo: 0, hi: 20, answer: () => 20 * (1 / 20) },
];

export const questionById = (id) => QUESTIONS.find((q) => q.id === id);

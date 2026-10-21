// The host's screen runs the room: it deals each round, reveals cards and chart days on
// schedule, settles, pauses for the podium, and moves on. planHost() decides the next
// step from the shared state and the clock alone, so a host who reloads the page picks
// up where the room is.

import { KINDS, KIND_ORDER, secretText } from "./kinds.js";
import { cryptoToken, sha256Hex } from "./rng.js";

export const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newRoomCode = () => cryptoToken(5, ROOM_ALPHABET);
export const isRoomCode = (code) => new RegExp(`^[${ROOM_ALPHABET}]{5}$`).test(code);

export const COUNTDOWN_MS = 3000;
export const INTERMISSION_MS = 15000;
// The rules judge time by the server's clock; acting a little late keeps a host whose
// clock runs fast from being refused at the edges of a round.
export const EDGE_MS = 750;
export const ROOM_GRACE_MS = 30 * 60 * 1000; // time a room may sit in its lobby
export const LENGTHS = [5, 10, 20, 30];

const SECONDS = { free: 180, cards: 240, chart: 240, question: 120 };

// Rounds for a room of the given length, cycling through the chosen kinds until the next
// round would not fit. Five minutes is the 2025 game: one free market.
export function defaultPlan(minutes, kinds = KIND_ORDER) {
  if (minutes <= 5) return [{ kind: "free", seconds: 300 }];
  const budget = minutes * 60;
  const overhead = (COUNTDOWN_MS + INTERMISSION_MS) / 1000;
  const plan = [];
  let used = 0;
  for (let i = 0; plan.length < 12; i++) {
    const kind = kinds[i % kinds.length];
    const seconds = minutes <= 10 ? Math.min(SECONDS[kind], 150) : SECONDS[kind];
    if (used + seconds + overhead > budget) break;
    plan.push({ kind, seconds });
    used += seconds + overhead;
  }
  return plan;
}

export const planMinutes = (plan) => plan.reduce((a, r) => a + r.seconds + (COUNTDOWN_MS + INTERMISSION_MS) / 1000, 0) / 60;

// Everything needed to open round n: the public round document and the host's vault.
export async function dealRound({ n, step, rng, hands, now, question }) {
  const durationMs = step.seconds * 1000;
  const made = KINDS[step.kind].make({ rng, hands, durationMs, question });
  const salt = cryptoToken(16);
  const text = made.secret ? secretText(made.secret, salt) : null;
  const startsAt = now + COUNTDOWN_MS;
  return {
    round: {
      n,
      kind: step.kind,
      ...made.terms,
      info: made.info,
      startsAt,
      endsAt: startsAt + durationMs,
      status: "live",
      commit: text ? await sha256Hex(text) : "",
    },
    vault: { text, value: made.secret?.value ?? null, reveals: made.reveals, hands: made.secret?.detail?.hands ?? {} },
  };
}

// The one next thing the host should do, or null. Rooms: { status, current, plan, expiresAt }.
export function planHost({ room, round, vault, now }) {
  if (room.status !== "playing") return null;
  if (now > room.expiresAt) return { type: "finish" };
  const n = room.current;
  if (!round || round.n !== n) return { type: "deal", n };
  if (round.status === "live") {
    if (now >= round.endsAt + EDGE_MS) return { type: "settle", n };
    const due = (vault?.reveals ?? []).filter((r) => round.startsAt + r.atMs <= now);
    if (due.length > (round.info.step ?? 0)) return { type: "reveal", n, info: due[due.length - 1].info };
    return null;
  }
  if (now < round.endsAt + INTERMISSION_MS) return null;
  return n + 1 < room.plan.length ? { type: "advance", n: n + 1 } : { type: "finish" };
}

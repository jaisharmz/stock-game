import { useEffect, useState, useSyncExternalStore } from "react";

export const money = (cents) => (cents < 0 ? "-" : "") + "$" + (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const signed = (cents) => (cents > 0 ? "+" : "") + money(cents);
export const clockText = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const tone = (x) => (x > 0 ? "up" : x < 0 ? "down" : "flat");

export function useStore(session) {
  return useSyncExternalStore(session.store.subscribe, session.store.get);
}

// Re-render every `every` ms and return the time from the given clock.
export function useNow(clock = Date.now, every = 250) {
  const [t, setT] = useState(clock);
  useEffect(() => {
    const id = setInterval(() => setT(clock()), every);
    return () => clearInterval(id);
  }, [clock, every]);
  return t;
}

const readHash = () => window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);

export function useRoute() {
  const [parts, setParts] = useState(readHash);
  useEffect(() => {
    const on = () => setParts(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return parts;
}

export const go = (path) => {
  window.location.hash = `#/${path}`;
};

export const shareUrl = (path) => `${window.location.origin}${window.location.pathname}#/${path}`;

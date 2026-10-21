import { useMemo, useState } from "react";
import { cost, fee, liquidation, price, fill, emptyPosition } from "../engine/curve.js";
import { mulberry32 } from "../engine/rng.js";
import { KINDS, KIND_ORDER } from "../engine/kinds.js";
import { BOTS, BOT_ORDER } from "../engine/bots.js";
import { money, signed, go } from "./util.js";

const M = { p0: 10000, s: 100, feeBps: 10, maxPos: 25, maxOrder: 5, startCash: 100000 };

// Figure 1: the price is a line, and an order pays every step it walks up.
function StepsFigure() {
  const [q, setQ] = useState(4);
  const [d, setD] = useState(5);
  const W = 340;
  const H = 190;
  const lo = -10;
  const hi = 20;
  const x = (k) => 30 + ((k - lo) / (hi - lo)) * (W - 40);
  const pmin = price(M, lo) - 200;
  const pmax = price(M, hi) + 200;
  const y = (p) => H - 20 - ((p - pmin) / (pmax - pmin)) * (H - 40);
  const steps = d > 0 ? Array.from({ length: d }, (_, i) => q + i) : Array.from({ length: -d }, (_, i) => q - i - 1);
  const c = cost(M, q, d);
  return (
    <figure className="fig">
      <figcaption>An order pays every step it walks along the line. Move the sliders: the shaded bars are the fills, and their total is the cost.</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label="price line with the fills of one order">
        <line x1={x(lo)} y1={y(price(M, lo))} x2={x(hi)} y2={y(price(M, hi))} className="chart-line flat" />
        {steps.map((k) => (
          <rect key={k} x={x(k)} y={y(price(M, k))} width={x(k + 1) - x(k) - 1} height={H - 20 - y(price(M, k))} className={d > 0 ? "bar-up" : "bar-down"} />
        ))}
        <line x1={x(q)} x2={x(q)} y1={10} y2={H - 20} className="chart-settle" />
        <text x={x(q) + 4} y={20} className="chart-label">now: {q} held</text>
        <text x={30} y={H - 4} className="chart-label dim">net shares held by everyone →</text>
      </svg>
      <div className="controls">
        <label>
          shares held now <b className="mono">{q}</b>
          <input type="range" min={-5} max={12} value={q} onChange={(e) => setQ(Number(e.target.value))} />
        </label>
        <label>
          your order <b className="mono">{d > 0 ? `buy ${d}` : `sell ${-d}`}</b>
          <input type="range" min={-5} max={5} value={d} onChange={(e) => setD(Number(e.target.value) || 1)} />
        </label>
      </div>
      <p className="readout mono">
        price {money(price(M, q))} → {money(price(M, q + d))} · {d > 0 ? "you pay" : "you get"} {money(Math.abs(c))} + fee {money(fee(M, c))}
      </p>
    </figure>
  );
}

// Figure 2: score by last price and buying prints money; score by what you could sell
// for and it does not.
function PumpFigure() {
  const [n, setN] = useState(10);
  const rows = useMemo(() => {
    let pos = emptyPosition(M);
    const out = [];
    for (let i = 0; i < n; i++) {
      pos = fill({ ...M, feeBps: 0 }, i, pos, 1).pos;
      out.push({ last: pos.cash + pos.shares * price(M, i + 1) - M.startCash, liquid: pos.cash + liquidation(M, i + 1, pos.shares) - M.startCash });
    }
    return out;
  }, [n]);
  const W = 340;
  const H = 160;
  const top = Math.max(100, rows.at(-1)?.last ?? 0);
  const x = (i) => 30 + (i / Math.max(1, n - 1)) * (W - 50);
  const y = (v) => H - 20 - (v / top) * (H - 40);
  const path = (key) => rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r[key])}`).join(" ");
  return (
    <figure className="fig">
      <figcaption>One player alone buys {n} shares, one at a time. Scored at the last price (the 2023 and 2025 rule), each purchase adds the shares already held plus one. Scored at what the shares would fetch, nothing changes. Only other people's orders can move your score.</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label="two scoring rules as one player keeps buying">
        <path d={path("last")} className="chart-line down" />
        <path d={path("liquid")} className="chart-line up" />
        <text x={x(n - 1) - 4} y={y(rows.at(-1).last) - 6} textAnchor="end" className="chart-label">last price {signed(rows.at(-1).last)}</text>
        <text x={x(n - 1) - 4} y={y(0) - 6} textAnchor="end" className="chart-label">liquidation {signed(rows.at(-1).liquid)}</text>
      </svg>
      <div className="controls">
        <label>
          shares bought <b className="mono">{n}</b>
          <input type="range" min={2} max={25} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
      </div>
    </figure>
  );
}

// Figure 3: four traders, random orders, then everyone unwinds. Profits sum to minus fees.
function ZeroSumFigure() {
  const [seed, setSeed] = useState(1);
  const result = useMemo(() => {
    const rng = mulberry32(seed);
    const m = { ...M, maxPos: 1000, maxOrder: 1000 };
    const pos = [0, 1, 2, 3].map(() => emptyPosition(m));
    let q = 0;
    for (let t = 0; t < 200; t++) {
      const i = rng.int(0, 3);
      const d = rng.int(-5, 5) || 1;
      pos[i] = fill(m, q, pos[i], d).pos;
      q += d;
    }
    for (let i = 0; i < 4; i++) {
      if (!pos[i].shares) continue;
      const d = -pos[i].shares;
      pos[i] = fill(m, q, pos[i], d).pos;
      q += d;
    }
    const profits = pos.map((p) => p.cash - m.startCash);
    return { profits, fees: pos.reduce((a, p) => a + p.fees, 0), sum: profits.reduce((a, b) => a + b, 0) };
  }, [seed]);
  const W = 340;
  const H = 150;
  const top = Math.max(...result.profits.map(Math.abs), 1);
  const y = (v) => H / 2 - (v / top) * (H / 2 - 16);
  return (
    <figure className="fig">
      <figcaption>Four traders place 200 random orders, then each sells back what they hold. Profits always sum to minus the fees paid: whatever one wins, the others lose.</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="fig-svg" role="img" aria-label="four traders' profits">
        <line x1={20} x2={W - 20} y1={H / 2} y2={H / 2} className="chart-base" />
        {result.profits.map((p, i) => (
          <g key={i}>
            <rect x={40 + i * 75} width={44} y={Math.min(y(p), H / 2)} height={Math.abs(y(p) - H / 2)} className={p >= 0 ? "bar-up" : "bar-down"} />
            <text x={62 + i * 75} y={p >= 0 ? y(p) - 4 : y(p) + 12} textAnchor="middle" className="chart-label">{signed(p)}</text>
          </g>
        ))}
      </svg>
      <p className="readout mono">
        sum {signed(result.sum)} · fees {money(result.fees)}
      </p>
      <button className="btn ghost small" onClick={() => setSeed((s) => s + 1)}>
        Run another market
      </button>
    </figure>
  );
}

export function How() {
  return (
    <article className="how">
      <p className="eyebrow">How ZeroSum works</p>
      <h1>The price is a straight line, so the game is zero-sum.</h1>
      <p>
        With q shares held across everyone, a share costs p0 + s·q. Buying walks up the line and pays each step; selling walks down and collects each step. The cost of an order is the area under the line, and that area does not depend on the path, so a round trip costs only the fee. Every dollar
        one player makes, another loses. The skill is getting in before the others move the price, or knowing what a share will pay.
      </p>
      <StepsFigure />
      <PumpFigure />
      <ZeroSumFigure />
      <h2>Four kinds of round</h2>
      <p>Each round is the same line with a different answer to "what is a share worth at the end?"</p>
      <ul className="kinds">
        {KIND_ORDER.map((k) => (
          <li key={k}>
            <b>
              <span className={`kind-dot ${k}`} /> {KINDS[k].label}
            </b>
            <span>{KINDS[k].blurb}</span>
          </li>
        ))}
      </ul>
      <p className="small dim">
        Hidden values are committed before trading opens: the host's screen publishes the SHA-256 hash of the value, and the database only accepts a settlement whose text hashes to it. Rounds are ranked by profit; first place gets 1000 points and last gets 0, so big-price rounds do not outweigh small ones.
      </p>
      <h2>Bots</h2>
      <ul className="kinds">
        {BOT_ORDER.map((k) => (
          <li key={k}>
            <b>{BOTS[k].name}</b>
            <span>{BOTS[k].about}</span>
          </li>
        ))}
      </ul>
      <div className="row gap wrap">
        <button className="btn primary" onClick={() => go("practice")}>
          Practice against bots
        </button>
        <button className="btn ghost" onClick={() => go("")}>
          Home
        </button>
      </div>
    </article>
  );
}

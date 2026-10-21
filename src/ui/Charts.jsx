import { useEffect, useRef, useState } from "react";
import { money } from "./util.js";

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(120, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const PAD = { l: 8, r: 58, t: 12, b: 18 };

function scale(lo, hi, a, b) {
  const span = hi - lo || 1;
  return (v) => a + ((v - lo) / span) * (b - a);
}

function yRange(values) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.12, Math.abs(hi) * 0.01, 1);
  return [lo - pad, hi + pad];
}

// The contract's price through the round: a step line, your fills as triangles, and the
// settlement value once it is known.
export function PriceChart({ round, tape, me, now, height = 220 }) {
  const [ref, width] = useWidth();
  const end = Math.max(round.endsAt, Math.min(now, round.endsAt));
  const points = [[round.startsAt, round.p0], ...tape.map((t) => [Math.min(t.t, round.endsAt), t.price])];
  const last = points[points.length - 1][1];
  points.push([Math.min(Math.max(now, round.startsAt), round.endsAt), last]);
  const values = points.map((p) => p[1]).concat(round.value != null ? [round.value] : []);
  const [lo, hi] = yRange(values);
  const x = scale(round.startsAt, end, PAD.l, width - PAD.r);
  const y = scale(lo, hi, height - PAD.b, PAD.t);
  let d = `M${x(points[0][0])},${y(points[0][1])}`;
  for (let i = 1; i < points.length; i++) d += ` H${x(points[i][0])} V${y(points[i][1])}`;
  const up = last >= round.p0;
  const mine = tape.filter((t) => t.pid === me && t.d);
  return (
    <div ref={ref} className="plot">
      <svg width={width} height={height} role="img" aria-label="price over the round">
        <line x1={PAD.l} x2={width - PAD.r} y1={y(round.p0)} y2={y(round.p0)} className="chart-base" />
        {Math.abs(y(round.p0) - y(last)) > 14 && (
          <text x={width - PAD.r + 6} y={y(round.p0) + 4} className="chart-label dim">
            open
          </text>
        )}
        <path d={d} className={`chart-line ${up ? "up" : "down"}`} />
        {mine.map((t, i) => (
          <path key={i} d={t.d > 0 ? "M0,-6 L5,3 L-5,3 Z" : "M0,6 L5,-3 L-5,-3 Z"} transform={`translate(${x(t.t)},${y(t.price)})`} className={t.d > 0 ? "fill-up" : "fill-down"} />
        ))}
        {round.value != null && Math.abs(y(round.value) - y(last)) > 14 && (
          <g>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(round.value)} y2={y(round.value)} className="chart-settle" />
            <text x={width - PAD.r + 6} y={y(round.value) + 4} className="chart-label settle">pays</text>
          </g>
        )}
        <circle cx={x(points[points.length - 1][0])} cy={y(last)} r="4" className="chart-dot" />
        <text x={width - PAD.r + 6} y={y(last) + 4} className="chart-label">{money(last)}</text>
      </svg>
    </div>
  );
}

// A chart round's stock: 60 days shown, then the revealed days, then the hidden ones.
export function PathChart({ info, future, height = 200 }) {
  const [ref, width] = useWidth();
  const known = [...info.history, ...info.revealed];
  const all = future ? [...info.history, ...future] : known;
  const [lo, hi] = yRange(all);
  const days = info.history.length + info.horizon;
  const x = scale(1, days, PAD.l, width - PAD.r);
  const y = scale(lo, hi, height - PAD.b, PAD.t);
  const line = (vals, from) => vals.map((v, i) => `${i ? "L" : "M"}${x(from + i)},${y(v)}`).join(" ");
  const cut = info.history.length;
  return (
    <div ref={ref} className="plot">
      <svg width={width} height={height} role="img" aria-label="the stock's daily closes">
        <rect x={x(cut + 0.5)} y={PAD.t} width={x(days) - x(cut + 0.5)} height={height - PAD.t - PAD.b} className="chart-future" />
        <path d={line(info.history, 1)} className="chart-line flat" />
        {info.revealed.length > 0 && <path d={line([info.history[cut - 1], ...info.revealed], cut)} className="chart-line up" />}
        {future && <path d={line([known[known.length - 1], ...future.slice(info.revealed.length)], known.length)} className="chart-line settle" />}
        <line x1={x(days)} x2={x(days)} y1={PAD.t} y2={height - PAD.b} className="chart-settle" />
        <text x={x(days) + 4} y={PAD.t + 10} className="chart-label settle">pays</text>
        {!future && (
          <text x={(x(known.length) + x(days)) / 2} y={(PAD.t + height - PAD.b) / 2} className="chart-q">?</text>
        )}
        <text x={x(1)} y={height - 4} className="chart-label dim">day 1</text>
        <text x={x(cut) - 18} y={height - 4} className="chart-label dim">day {cut}</text>
        {future && <circle cx={x(days)} cy={y(future[future.length - 1])} r="4" className="chart-dot" />}
      </svg>
    </div>
  );
}

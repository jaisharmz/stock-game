import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { loadRecap, listGames, summarize } from "../data/recap.js";
import { KINDS, parseSecret } from "../engine/kinds.js";
import { PriceChart, PathChart } from "./Charts.jsx";
import { money, signed, tone, go } from "./util.js";

function RoundCard({ r, me }) {
  const tape = r.trades.map((t) => ({ t: t.at, price: t.price, pid: t.pid, d: t.d }));
  const secret = r.round.secret ? parseSecret(r.round.secret) : null;
  return (
    <section className="card">
      <p className="eyebrow">
        Round {r.round.n + 1} · {KINDS[r.round.kind].label} · {r.trades.length} trades
      </p>
      <h3>{r.round.value != null ? `Paid ${money(r.round.value)} a share` : `Closed with ${r.q} shares open`}</h3>
      {r.round.kind === "question" && <p className="small">{r.round.info.prompt}</p>}
      {r.round.kind === "chart" && secret && <PathChart info={r.round.info} future={secret.detail.future} height={150} />}
      <PriceChart round={r.round} tape={tape} me={me} now={r.round.endsAt} height={150} />
      <ol className="mini-table">
        {r.standings.map((s) => (
          <li key={s.pid} className={s.pid === me ? "me" : ""}>
            <span className="mono">{s.rank ?? "–"}</span>
            <span>
              {s.bot && <Bot size={12} />} {s.name} {s.dealer && <span className="tag">dealer</span>}
            </span>
            <span className={`mono ${tone(s.pnl)}`}>{signed(s.pnl)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Recap({ code, user }) {
  const [recap, setRecap] = useState(undefined);
  const [error, setError] = useState(null);
  useEffect(() => {
    loadRecap(code).then(setRecap, (e) => setError(e.message));
  }, [code]);
  if (error) return <p className="center warn">{error}</p>;
  if (recap === undefined) return <p className="center dim">Rebuilding the room from its trades…</p>;
  if (recap === null) return <p className="center dim">No room has that code.</p>;
  return (
    <div className="recap">
      <p className="eyebrow">Room {code} · hosted by {recap.room.hostName}</p>
      <h1>Recap</h1>
      <section className="card">
        <ol className="mini-table">
          {recap.table.map((s) => (
            <li key={s.pid} className={s.pid === user?.uid ? "me" : ""}>
              <span className="mono">{s.rank}</span>
              <span>
                {s.bot && <Bot size={12} />} {s.name}
              </span>
              <span className="mono">{s.points} pts</span>
              <span className={`mono ${tone(s.pnl)}`}>{signed(s.pnl)}</span>
            </li>
          ))}
        </ol>
      </section>
      {recap.rounds.map((r) => (
        <RoundCard key={r.round.n} r={r} me={user?.uid} />
      ))}
    </div>
  );
}

export function Profile({ user }) {
  const [games, setGames] = useState(null);
  const [recaps, setRecaps] = useState({});
  useEffect(() => {
    listGames(user.uid).then(async (list) => {
      setGames(list);
      const loaded = await Promise.all(list.slice(0, 12).map((g) => loadRecap(g.code).catch(() => null)));
      setRecaps(Object.fromEntries(list.slice(0, 12).map((g, i) => [g.code, loaded[i]])));
    });
  }, [user.uid]);
  if (!games) return <p className="center dim">Loading your games…</p>;
  const stats = summarize(user.uid, Object.values(recaps));
  return (
    <div className="profile">
      <p className="eyebrow">{user.displayName}</p>
      <h1>My games</h1>
      <div className="stats">
        {[
          ["Rooms", stats.rooms],
          ["Room wins", stats.roomWins],
          ["Rounds", stats.rounds],
          ["Round wins", stats.wins],
          ["Podiums", stats.podiums],
          ["Profit", signed(stats.pnl)],
        ].map(([k, v]) => (
          <div key={k} className="stat">
            <span className="eyebrow">{k}</span>
            <b className="mono">{v}</b>
          </div>
        ))}
      </div>
      {stats.best && (
        <p className="small dim">
          Best round: {signed(stats.best.pnl)} in a {KINDS[stats.best.kind].label.toLowerCase()} (room {stats.best.code}).
        </p>
      )}
      <p className="small dim">Every number here is recomputed from the rooms' own trades, the last 12 rooms.</p>
      <ol className="mini-table">
        {games.map((g) => {
          const row = recaps[g.code]?.table.find((r) => r.pid === user.uid);
          return (
            <li key={g.code}>
              <button className="link mono" onClick={() => go(`recap/${g.code}`)}>
                {g.code}
              </button>
              <span className="small dim">{new Date(g.at).toLocaleDateString()}</span>
              <span className="small">{g.host ? "hosted" : "played"}</span>
              <span className="mono">{row ? `#${row.rank} · ${row.points} pts` : "–"}</span>
            </li>
          );
        })}
      </ol>
      {!games.length && <p className="dim">No rooms yet.</p>}
    </div>
  );
}

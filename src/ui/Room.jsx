import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Bot, Crown, Play, Users, X, Plus, Trophy, Timer, ArrowLeft } from "lucide-react";
import { useStore, useNow, money, signed, clockText, tone, shareUrl, go } from "./util.js";
import { PriceChart, PathChart } from "./Charts.jsx";
import { KINDS, parseSecret } from "../engine/kinds.js";
import { BOTS, BOT_ORDER } from "../engine/bots.js";
import { cost, fee, emptyPosition, refusal } from "../engine/curve.js";
import { roundStandings, roomStandings, pnl } from "../engine/score.js";
import { INTERMISSION_MS, planMinutes } from "../engine/host.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function RoomView({ session, clock, defaultName }) {
  const s = useStore(session);
  const now = useNow(clock);
  useEffect(() => {
    if (!s.error) return;
    const id = setTimeout(() => session.store.set({ error: null }), 3500);
    return () => clearTimeout(id);
  }, [s.error, session]);

  let body;
  if (!s.ready) body = <p className="center dim">Opening the room…</p>;
  else if (!s.room) body = <Notice title="No room here" text={s.error ?? "Check the code and try again."} />;
  else if (!s.joined) body = <JoinForm session={session} room={s.room} defaultName={defaultName} />;
  else {
    const role = session.kind === "local" ? "practice" : s.room.hostUid === s.me ? "host" : "player";
    const props = { session, s, now, role };
    if (s.room.status === "lobby") body = <Lobby {...props} />;
    else if (s.room.status === "done") body = <Final {...props} />;
    else if (!s.round || !s.market) body = <p className="center dim">Dealing the next round…</p>;
    else if (s.round.status === "settled") body = <Result {...props} />;
    else body = <Live {...props} />;
  }
  return (
    <div className="room">
      {body}
      {s.error && <div className="toast" role="alert">{s.error}</div>}
    </div>
  );
}

function Notice({ title, text }) {
  return (
    <div className="card narrow center">
      <h2>{title}</h2>
      <p className="dim">{text}</p>
      <button className="btn ghost" onClick={() => go("")}>Home</button>
    </div>
  );
}

function JoinForm({ session, room, defaultName }) {
  const [name, setName] = useState(defaultName ?? "");
  const [busy, setBusy] = useState(false);
  const join = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await session.join(name.trim() || "Trader");
    } catch (err) {
      session.store.set({ error: err.message });
      setBusy(false);
    }
  };
  if (room.status === "done") return <Notice title="This room has finished" text="Ask the host for a new code." />;
  return (
    <form className="card narrow" onSubmit={join}>
      <p className="eyebrow">Room {room.code}</p>
      <h2>Join {room.hostName}'s market</h2>
      <label className="field">
        <span>Your name on the leaderboard</span>
        <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <button className="btn primary wide" disabled={busy}>Join</button>
    </form>
  );
}

function RoomCode({ code, big }) {
  const [qr, setQr] = useState(null);
  const url = shareUrl(`join/${code}`);
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#05060a", light: "#ffffff" } }).then(setQr);
  }, [url]);
  return (
    <div className={`roomcode ${big ? "big" : ""}`}>
      <div>
        <p className="eyebrow">Join on your phone</p>
        <div className="code mono">{code}</div>
        <p className="dim small break">{url}</p>
      </div>
      {qr && <img src={qr} alt={`QR code to join room ${code}`} className="qr" />}
    </div>
  );
}

function PlanList({ plan }) {
  return (
    <ol className="plan">
      {plan.map((step, i) => (
        <li key={i}>
          <span className={`kind-dot ${step.kind}`} />
          {KINDS[step.kind].label}
          <span className="dim mono">{Math.round(step.seconds / 60 * 10) / 10} min</span>
        </li>
      ))}
    </ol>
  );
}

function PlayerChips({ players, hostUid, onRemove }) {
  return (
    <ul className="chips">
      {Object.entries(players).map(([pid, p]) => (
        <li key={pid} className={p.bot ? "bot" : ""}>
          {p.bot ? <Bot size={14} /> : pid === hostUid ? <Crown size={14} /> : <Users size={14} />}
          {p.name}
          {p.bot && onRemove && (
            <button className="icon" aria-label={`remove ${p.name}`} onClick={() => onRemove(pid)}>
              <X size={12} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Lobby({ session, s, role }) {
  const hosting = role !== "player";
  const humans = Object.values(s.players).filter((p) => !p.bot).length;
  return (
    <div className="lobby">
      {role !== "practice" && <RoomCode code={s.room.code} big={role === "host"} />}
      <div className="card">
        <div className="row between">
          <h2>{role === "practice" ? "Practice against bots" : `${s.room.hostName}'s room`}</h2>
          <span className="pill mono">{Math.round(planMinutes(s.room.plan))} min</span>
        </div>
        <PlanList plan={s.room.plan} />
        <h3>
          Players <span className="dim">({humans} people, {Object.keys(s.players).length - humans} bots)</span>
        </h3>
        <PlayerChips players={s.players} hostUid={s.room.hostUid} onRemove={hosting && session.lobby.removeBot ? (pid) => session.lobby.removeBot(pid) : null} />
        {hosting && session.lobby.addBot && (
          <div className="row wrap gap">
            {BOT_ORDER.map((kind) => (
              <button key={kind} className="btn ghost small" title={BOTS[kind].about} aria-label={`add ${BOTS[kind].name}`} onClick={() => session.lobby.addBot(kind)}>
                <Plus size={12} /> {BOTS[kind].name}
              </button>
            ))}
          </div>
        )}
        {hosting ? (
          <>
            {role === "host" && !s.room.hostPlays && <p className="dim small">You are hosting on this screen. Put it where everyone can see it; players trade on their phones.</p>}
            <button className="btn primary wide" onClick={() => session.lobby.start()}>
              <Play size={16} /> Start
            </button>
          </>
        ) : (
          <p className="center dim">Waiting for {s.room.hostName} to start…</p>
        )}
      </div>
    </div>
  );
}

function Countdown({ ms }) {
  return (
    <div className="countdown" aria-live="polite">
      <span>{Math.ceil(ms / 1000)}</span>
    </div>
  );
}

function RoundHeader({ s, now }) {
  const r = s.round;
  const left = r.status === "settled" ? 0 : r.endsAt - Math.max(now, r.startsAt);
  return (
    <header className="roundbar">
      <div>
        <p className="eyebrow">
          Round {r.n + 1} of {s.room.plan.length}
        </p>
        <h2>
          <span className={`kind-dot ${r.kind}`} /> {KINDS[r.kind].label}
        </h2>
      </div>
      <div className={`price mono ${tone(s.market.price - r.p0)}`}>{money(s.market.price)}</div>
      <div className={`timer mono ${left < 15000 ? "hot" : ""}`}>
        <Timer size={16} /> {clockText(left)}
      </div>
    </header>
  );
}

function InfoPanel({ s, role }) {
  const r = s.round;
  const info = r.info;
  const dealing = role === "host" && s.room.hostPlays && KINDS[r.kind].hidden;
  if (r.kind === "free") {
    return (
      <div className="info">
        <p>{KINDS.free.blurb}</p>
        <p className="dim small">
          Each share bought lifts the price {money(r.s)}; each one sold drops it {money(r.s)}. Net shares held by everyone: <b className="mono">{s.market.q}</b>.
        </p>
      </div>
    );
  }
  if (r.kind === "cards") {
    return (
      <div className="info">
        <div className="row gap wrap center-v">
          <div className={`playing-card ${s.hand ? "" : "empty"}`}>{s.hand ?? "–"}</div>
          <div>
            <p>
              A share pays the <b>sum of all {info.hands} cards</b>.
            </p>
            <p className="dim small">{s.hand ? "That is your card. Nobody else can see it." : dealing ? "You dealt this round, so you sit off its podium." : "You were not dealt a card this round."} Cards run 1 to 50; the deck may be lopsided.</p>
          </div>
        </div>
        <p className="small">
          Public cards from the same deck:{" "}
          {info.shown.length ? info.shown.map((c, i) => <span key={i} className="mini-card">{c}</span>) : <span className="dim">none yet</span>}
        </p>
      </div>
    );
  }
  if (r.kind === "chart") {
    return (
      <div className="info">
        <PathChart info={info} />
        <p className="small">
          A share pays the close on day {info.history.length + info.horizon}. Days revealed: <b className="mono">{info.revealed.length}</b> of {info.horizon} (the last four stay hidden).
        </p>
      </div>
    );
  }
  return (
    <div className="info">
      <p className="question">{info.prompt}</p>
      <p className="small">
        Somewhere between <b className="mono">{info.lo}</b> and <b className="mono">{info.hi}</b>. A share pays the answer in dollars.
        {dealing && <span className="dim"> You dealt this round, so you sit off its podium.</span>}
      </p>
    </div>
  );
}

function TradePanel({ session, s, now }) {
  const [size, setSize] = useState(1);
  const [busy, setBusy] = useState(false);
  const r = s.round;
  const q = s.market.q;
  const pos = s.positions[s.me] ?? emptyPosition(r);
  const open = now >= r.startsAt && now < r.endsAt;
  const buy = cost(r, q, size);
  const sell = cost(r, q, -size);
  const profit = pnl(r, q, pos);

  const place = async (d) => {
    if (busy) return;
    setBusy(true);
    try {
      await session.order(d);
    } catch {
      /* the toast shows it */
    } finally {
      setBusy(false);
    }
  };
  const flatten = async () => {
    setBusy(true);
    try {
      let left = pos.shares;
      while (left !== 0) {
        const d = -Math.sign(left) * Math.min(Math.abs(left), r.maxOrder);
        await session.order(d);
        left += d;
        if (left) await sleep(300);
      }
    } catch {
      /* the toast shows it */
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      if (e.key === "b" || e.key === "ArrowUp") place(size);
      if (e.key === "s" || e.key === "ArrowDown") place(-size);
      if (["1", "2", "5"].includes(e.key)) setSize(Math.min(Number(e.key), r.maxOrder));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="trade">
      <div className="position">
        <div>
          <span className="eyebrow">Shares</span>
          <b className="mono">{pos.shares}</b>
        </div>
        <div>
          <span className="eyebrow">Score</span>
          <b className={`mono ${tone(profit)}`}>{signed(profit)}</b>
        </div>
        <div>
          <span className="eyebrow">Limit</span>
          <b className="mono">±{r.maxPos}</b>
        </div>
      </div>
      <div className="sizes" role="group" aria-label="order size">
        {[1, 2, 5].filter((n) => n <= r.maxOrder).map((n) => (
          <button key={n} className={size === n ? "on" : ""} onClick={() => setSize(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="buttons">
        <button className="btn sell" disabled={!open || busy || !!refusal(r, q, pos.shares, -size)} onClick={() => place(-size)}>
          Sell {size}
          <small>get {money(-sell - fee(r, sell))}</small>
        </button>
        <button className="btn buy" disabled={!open || busy || !!refusal(r, q, pos.shares, size)} onClick={() => place(size)}>
          Buy {size}
          <small>pay {money(buy + fee(r, buy))}</small>
        </button>
      </div>
      {pos.shares !== 0 && (
        <button className="btn ghost small wide" disabled={!open || busy} onClick={flatten}>
          Close my {Math.abs(pos.shares)} shares
        </button>
      )}
    </div>
  );
}

function Leaderboard({ s, compact }) {
  const rows = roundStandings({ round: s.round, q: s.market.q, positions: s.positions, players: s.players, hostUid: s.room.hostUid });
  return (
    <div className="board">
      <h3>
        <Trophy size={14} /> Live scores
      </h3>
      <ol>
        {rows.slice(0, compact ? 6 : 20).map((r) => (
          <li key={r.pid} className={r.pid === s.me ? "me" : ""}>
            <span className="mono rank">{r.rank ?? "–"}</span>
            <span className="name">
              {r.bot && <Bot size={12} />} {r.name}
              {r.dealer && <span className="tag">dealer</span>}
            </span>
            <span className="mono dim">{r.shares}</span>
            <span className={`mono ${tone(r.pnl)}`}>{signed(r.pnl)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Live({ session, s, now, role }) {
  const r = s.round;
  const plays = !!s.players[s.me];
  const seesAll = role !== "player";
  return (
    <div className={`live ${role}`}>
      <RoundHeader s={s} now={now} />
      {now < r.startsAt && <Countdown ms={r.startsAt - now} />}
      <div className="live-grid">
        {plays && (
          <div className="tradebox">
            <TradePanel session={session} s={s} now={now} />
          </div>
        )}
        <section className="main">
          <InfoPanel s={s} role={role} />
          <PriceChart round={r} tape={s.tape} me={s.me} now={now} height={role === "host" ? 300 : 200} />
        </section>
        {seesAll && (
          <aside className="side">
            <Leaderboard s={s} compact={plays} />
            {role === "host" && <RoomCode code={s.room.code} />}
          </aside>
        )}
      </div>
    </div>
  );
}

function Reveal({ s }) {
  const r = s.round;
  if (r.kind === "free") {
    return <p>No underlying: everyone scores what their shares fetch sold back alone from {money(s.market.price)}, where {s.market.q} net shares left the price.</p>;
  }
  const secret = r.secret ? parseSecret(r.secret) : null;
  if (r.kind === "cards" && secret) {
    const hands = Object.entries(secret.detail.hands);
    return (
      <div>
        <p>
          The deck was <b>{secret.detail.dist}</b>. The {hands.length} cards sum to <b className="mono">{secret.value / 100}</b>.
        </p>
        <div className="row wrap gap">
          {hands.map(([pid, card]) => (
            <span key={pid} className="dealt">
              <span className="mini-card">{card}</span> {s.players[pid]?.name ?? pid}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (r.kind === "chart" && secret) {
    return (
      <div>
        <PathChart info={r.info} future={secret.detail.future} />
        <p className="small dim">
          Daily volatility {(secret.detail.sigma * 100).toFixed(1)}%{secret.detail.jumpDay > 0 ? `, with a news jump on day ${secret.detail.jumpDay}` : ", no news jump"}.
        </p>
      </div>
    );
  }
  if (r.kind === "question" && secret) {
    return (
      <p>
        {r.info.prompt}: <b className="mono">{Math.round(secret.detail.answer * 100) / 100}</b>
      </p>
    );
  }
  return null;
}

function Podium({ rows, unit }) {
  const top = rows.filter((r) => r.rank != null).slice(0, 3);
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <div className="podium">
      {order.map((r) => (
        <div key={r.pid} className={`step p${r.rank}`}>
          <div className="who">
            {r.bot && <Bot size={14} />} {r.name}
          </div>
          <div className="mono">{unit(r)}</div>
          <div className="block mono">{r.rank}</div>
        </div>
      ))}
    </div>
  );
}

function Result({ s, now, session }) {
  const r = s.round;
  const rows = roundStandings({ round: r, q: s.market.q, positions: s.positions, players: s.players, hostUid: s.room.hostUid });
  const mine = rows.find((x) => x.pid === s.me);
  const nextIn = r.endsAt + INTERMISSION_MS - now;
  const last = r.n + 1 >= s.room.plan.length;
  return (
    <div className="result">
      <p className="eyebrow">
        Round {r.n + 1} of {s.room.plan.length} · {KINDS[r.kind].label}
      </p>
      <h2>{r.value != null ? `A share paid ${money(r.value)}` : `Closed at ${money(s.market.price)}`}</h2>
      <div className="card">
        <Reveal s={s} />
      </div>
      <Podium rows={rows} unit={(x) => signed(x.pnl)} />
      {mine && (
        <p className="center">
          You: <b className={tone(mine.pnl)}>{signed(mine.pnl)}</b>
          {mine.rank ? ` · #${mine.rank} · ${mine.points} pts` : " · dealer, off the podium"}
        </p>
      )}
      <Table rows={rows} me={s.me} cols={["shares", "pnl", "points"]} />
      <PriceChart round={r} tape={s.tape} me={s.me} now={r.endsAt} height={160} />
      <p className="center dim">
        {last ? "Final results" : "Next round"} in {clockText(nextIn)}
        {session.kind === "local" && <> · <button className="link" onClick={() => session.lobby.end()}>end practice</button></>}
      </p>
    </div>
  );
}

function Table({ rows, me, cols }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          {cols.includes("shares") && <th className="num">Shares</th>}
          {cols.includes("wins") && <th className="num">Wins</th>}
          {cols.includes("pnl") && <th className="num">Profit</th>}
          {cols.includes("points") && <th className="num">Points</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.pid} className={r.pid === me ? "me" : ""}>
            <td className="mono">{r.rank ?? "–"}</td>
            <td>
              {r.bot && <Bot size={12} />} {r.name} {r.dealer && <span className="tag">dealer</span>}
            </td>
            {cols.includes("shares") && <td className="num mono">{r.shares}</td>}
            {cols.includes("wins") && <td className="num mono">{r.wins}</td>}
            {cols.includes("pnl") && <td className={`num mono ${tone(r.pnl)}`}>{signed(r.pnl)}</td>}
            {cols.includes("points") && <td className="num mono">{r.points}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Final({ s, role }) {
  const perRound = Object.values(s.history)
    .sort((a, b) => a.round.n - b.round.n)
    .map((h) => roundStandings({ round: h.round, q: h.q, positions: h.positions, players: s.players, hostUid: s.room.hostUid }));
  const table = roomStandings(perRound, s.players);
  return (
    <div className="result">
      <p className="eyebrow">{perRound.length} rounds</p>
      <h2>Final standings</h2>
      <Podium rows={table} unit={(x) => `${x.points} pts`} />
      <Table rows={table} me={s.me} cols={["wins", "pnl", "points"]} />
      <div className="row gap wrap center-h">
        {role !== "practice" && (
          <button className="btn primary" onClick={() => go(`recap/${s.room.code}`)}>
            Recap and replays
          </button>
        )}
        <button className="btn ghost" onClick={() => go("")}>
          <ArrowLeft size={14} /> Home
        </button>
      </div>
    </div>
  );
}

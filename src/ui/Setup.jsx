import { useState } from "react";
import { Plus, Trash2, Play } from "lucide-react";
import { KINDS, KIND_ORDER } from "../engine/kinds.js";
import { BOTS, BOT_ORDER } from "../engine/bots.js";
import { defaultPlan, planMinutes, LENGTHS } from "../engine/host.js";

// One form for a hosted room and for practice. Hosted rooms add "I'll play too" and the
// host's own questions.
export function Setup({ mode, onCreate }) {
  const hosted = mode === "host";
  const [minutes, setMinutes] = useState(hosted ? 30 : 10);
  const [kinds, setKinds] = useState(KIND_ORDER);
  const [bots, setBots] = useState(hosted ? { noise: 1, informed: 1 } : { noise: 1, momentum: 1, revert: 1, informed: 1 });
  const [hostPlays, setHostPlays] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [quick, setQuick] = useState(false);

  const fullPlan = defaultPlan(minutes, kinds.length ? kinds : ["free"]);
  // Dev server only: 25-second rounds, to watch a whole room go by while testing.
  const plan = quick ? fullPlan.map((step) => ({ ...step, seconds: 25 })) : fullPlan;
  const toggleKind = (k) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : KIND_ORDER.filter((x) => ks.includes(x) || x === k)));
  const setBot = (k, n) => setBots((b) => ({ ...b, [k]: Math.max(0, Math.min(4, n)) }));
  const botList = BOT_ORDER.flatMap((k) => Array(bots[k] ?? 0).fill(k));
  const validQuestions = questions.filter((q) => q.prompt.trim() && Number.isFinite(q.answer) && q.lo < q.answer && q.answer < q.hi);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate({ minutes, plan, bots: botList, hostPlays, questions: validQuestions.map((q) => ({ ...q, id: `custom-${q.prompt.slice(0, 12)}` })) });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="card setup" onSubmit={submit}>
      <h2>{hosted ? "Host a room" : "Practice against bots"}</h2>
      <p className="dim small">{hosted ? "Friends join with the room code on their phones. Put this screen where everyone can see it." : "Runs in this browser only. Nothing is saved."}</p>

      <fieldset>
        <legend>Length</legend>
        <div className="seg">
          {LENGTHS.map((m) => (
            <button type="button" key={m} className={minutes === m ? "on" : ""} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>
        {minutes === 5 && <p className="dim small">Five minutes is the 2025 game: one free market.</p>}
      </fieldset>

      {minutes > 5 && (
        <fieldset>
          <legend>Rounds</legend>
          {KIND_ORDER.map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={kinds.includes(k)} onChange={() => toggleKind(k)} />
              <span>
                <b>
                  <span className={`kind-dot ${k}`} /> {KINDS[k].label}
                </b>
                <span className="dim small block">{KINDS[k].blurb}</span>
              </span>
            </label>
          ))}
          <p className="small mono dim">
            {plan.length} rounds · about {Math.round(planMinutes(plan))} minutes
          </p>
        </fieldset>
      )}

      <fieldset>
        <legend>Bots</legend>
        {BOT_ORDER.map((k) => (
          <div key={k} className="botrow">
            <span>
              <b>{BOTS[k].name}</b>
              <span className="dim small block">{BOTS[k].about}</span>
            </span>
            <span className="stepper">
              <button type="button" aria-label={`fewer ${BOTS[k].name}`} onClick={() => setBot(k, (bots[k] ?? 0) - 1)}>
                −
              </button>
              <span className="mono">{bots[k] ?? 0}</span>
              <button type="button" aria-label={`more ${BOTS[k].name}`} onClick={() => setBot(k, (bots[k] ?? 0) + 1)}>
                +
              </button>
            </span>
          </div>
        ))}
      </fieldset>

      {hosted && (
        <fieldset>
          <legend>You</legend>
          <label className="check">
            <input type="checkbox" checked={hostPlays} onChange={(e) => setHostPlays(e.target.checked)} />
            <span>
              <b>I'll trade too</b>
              <span className="dim small block">Your screen deals the hidden rounds, so in those you trade tagged as dealer and sit off the podium.</span>
            </span>
          </label>
        </fieldset>
      )}

      {hosted && kinds.includes("question") && minutes > 5 && (
        <fieldset>
          <legend>Your own questions (optional)</legend>
          <p className="dim small">Question rounds use these first, then the built-in pack. Nobody sees the answer until the round settles.</p>
          {questions.map((q, i) => (
            <div key={i} className="qrow">
              <input placeholder="Question" value={q.prompt} maxLength={140} onChange={(e) => setQuestions((qs) => qs.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))} />
              {["lo", "answer", "hi"].map((f) => (
                <input key={f} type="number" step="any" placeholder={f === "lo" ? "low" : f === "hi" ? "high" : "answer"} value={Number.isFinite(q[f]) ? q[f] : ""} onChange={(e) => setQuestions((qs) => qs.map((x, j) => (j === i ? { ...x, [f]: e.target.value === "" ? NaN : Number(e.target.value) } : x)))} />
              ))}
              <button type="button" className="icon" aria-label="remove question" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setQuestions((qs) => [...qs, { prompt: "", lo: 0, answer: NaN, hi: 100 }])}>
            <Plus size={12} /> Add a question
          </button>
          {questions.length > validQuestions.length && <p className="small warn">A question needs low &lt; answer &lt; high to be used.</p>}
        </fieldset>
      )}

      {import.meta.env.DEV && (
        <label className="check">
          <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
          <span className="small">Quick 25-second rounds (dev server only)</span>
        </label>
      )}
      {error && <p className="warn">{error}</p>}
      <button className="btn primary wide" disabled={busy}>
        <Play size={16} /> {hosted ? "Open the room" : "Start practice"}
      </button>
    </form>
  );
}

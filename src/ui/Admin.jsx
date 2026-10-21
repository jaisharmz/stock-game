import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { createInvite, listInvites, deleteInvite, listMembers, revokeMember, setMode } from "../data/access.js";
import { shareUrl } from "./util.js";

export function Admin({ user, access, onChange }) {
  const [invites, setInvites] = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ maxUses: 5, days: 14, note: "" });
  const [fresh, setFresh] = useState(null);
  const [error, setError] = useState(null);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);
  useEffect(() => {
    let live = true;
    Promise.all([listInvites(), listMembers()]).then(
      ([i, m]) => {
        if (!live) return;
        setInvites(i);
        setMembers(m);
      },
      (e) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [version]);

  if (!access?.admin) return <p className="center dim">Admins only.</p>;

  const make = async (e) => {
    e.preventDefault();
    const code = await createInvite(user, { maxUses: Number(form.maxUses), days: Number(form.days), note: form.note });
    setFresh(code);
    load();
  };
  const flip = async () => {
    await setMode(user, access.open ? "invite" : "open");
    onChange();
  };

  return (
    <div className="admin">
      <section className="card">
        <h2>Who may host</h2>
        <p>
          Right now: <b>{access.open ? "anyone signed in with Google" : "invited members only"}</b>. Anyone with a room code can always join a room.
        </p>
        <button className="btn ghost" onClick={flip}>
          {access.open ? "Go back to invite-only" : "Open hosting to everyone"}
        </button>
      </section>

      <section className="card">
        <h2>Invites</h2>
        <form className="row gap wrap" onSubmit={make}>
          <label className="field small">
            <span>Uses</span>
            <input type="number" min={1} max={500} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
          </label>
          <label className="field small">
            <span>Days valid</span>
            <input type="number" min={1} max={365} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
          </label>
          <label className="field grow">
            <span>Note (who it's for)</span>
            <input maxLength={80} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <button className="btn primary">Make invite</button>
        </form>
        {fresh && (
          <p className="callout">
            Send this link: <span className="mono break">{shareUrl(`invite/${fresh}`)}</span>{" "}
            <button className="icon" aria-label="copy invite link" onClick={() => navigator.clipboard.writeText(shareUrl(`invite/${fresh}`))}>
              <Copy size={14} />
            </button>
          </p>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Note</th>
              <th className="num">Used</th>
              <th>Expires</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => (
              <tr key={i.code}>
                <td className="mono">{i.code}</td>
                <td>{i.note}</td>
                <td className="num mono">
                  {i.uses}/{i.maxUses}
                </td>
                <td className="small">{i.expiresAt.toDate().toLocaleDateString()}</td>
                <td>
                  <button className="icon" aria-label={`delete invite ${i.code}`} onClick={() => deleteInvite(i.code).then(load)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Members</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Via</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.uid}>
                <td>{m.name}</td>
                <td className="small break">{m.email}</td>
                <td>{m.role}</td>
                <td className="mono small">{m.via}</td>
                <td>
                  {m.uid !== user.uid && (
                    <button className="icon" aria-label={`remove ${m.name}`} onClick={() => revokeMember(m.uid).then(load)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {error && <p className="warn">{error}</p>}
    </div>
  );
}

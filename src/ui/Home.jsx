import { useState } from "react";
import { LogIn, LogOut, Users, Radio, Cpu, BookOpen, Shield, User, KeyRound } from "lucide-react";
import { go } from "./util.js";
import { isRoomCode } from "../engine/host.js";

export function Brand({ small }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <span>ZERO</span>
      <span className="accent">SUM</span>
    </div>
  );
}

export function Home({ user, access, configured, onSignIn, onSignOut, onRedeem, onClaim }) {
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState("");
  const [msg, setMsg] = useState(null);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);

  const join = (e) => {
    e.preventDefault();
    if (!isRoomCode(clean)) return setMsg("A room code is five letters and numbers.");
    go(`join/${clean}`);
  };
  const redeem = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await onRedeem(invite);
      setMsg("You're in. You can host rooms now.");
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="home">
      <section className="hero">
        <Brand />
        <p className="tagline">A trading game where every dollar you make, a friend loses.</p>
        <p className="dim">Rooms work like Kahoot: one screen hosts, everyone else trades on their phone with a five-letter code.</p>
      </section>

      <section className="tiles">
        {configured && !(user && access && !access.member) && (
          <button className="tile action primary" onClick={() => go("host")}>
            <h3>
              <Users size={16} /> Make a room
            </h3>
            <p className="dim small">Pick a length and the rounds, get a code, and friends join on their phones.</p>
            {!user && <p className="dim small">You'll sign in with Google first.</p>}
          </button>
        )}

        {configured && (
          <form className="tile" onSubmit={join}>
            <h3>
              <Radio size={16} /> Join a room
            </h3>
            <div className="row gap">
              <input className="code-input mono" placeholder="CODE" value={clean} onChange={(e) => setCode(e.target.value)} aria-label="room code" autoCapitalize="characters" />
              <button className="btn primary" disabled={clean.length !== 5}>
                Join
              </button>
            </div>
            {!user && <p className="dim small">You'll sign in with Google first.</p>}
          </form>
        )}

        <button className="tile action" onClick={() => go("practice")}>
          <h3>
            <Cpu size={16} /> Practice against bots
          </h3>
          <p className="dim small">Runs in your browser. No sign-in needed.</p>
        </button>

        <button className="tile action" onClick={() => go("how")}>
          <h3>
            <BookOpen size={16} /> How it works
          </h3>
          <p className="dim small">Why a straight-line price makes the game zero-sum, with live figures.</p>
        </button>

        {user && access && !access.member && (
          <form className="tile" onSubmit={redeem}>
            <h3>
              <KeyRound size={16} /> Have an invite?
            </h3>
            <p className="dim small">Hosting is invite-only for now. Anyone can join a room with its code.</p>
            <div className="row gap">
              <input className="mono" placeholder="invite code" value={invite} onChange={(e) => setInvite(e.target.value)} aria-label="invite code" />
              <button className="btn primary" disabled={invite.trim().length < 6}>
                Redeem
              </button>
            </div>
          </form>
        )}

        {user && access?.claimable && (
          <div className="tile">
            <h3>
              <Shield size={16} /> Claim this deployment
            </h3>
            <p className="dim small">Nobody owns this deployment yet. The first person to claim it becomes its admin and hands out invites.</p>
            <button className="btn ghost" onClick={onClaim}>
              Claim it
            </button>
          </div>
        )}
      </section>

      {msg && <p className="center warn">{msg}</p>}

      <footer className="row gap wrap center-h">
        {!configured ? (
          <p className="dim small">Firebase is not configured for this build, so only practice works. See the README.</p>
        ) : user ? (
          <>
            <span className="dim small">Signed in as {user.displayName ?? user.email}</span>
            <button className="btn ghost small" onClick={() => go("me")}>
              <User size={12} /> My games
            </button>
            {access?.admin && (
              <button className="btn ghost small" onClick={() => go("admin")}>
                <Shield size={12} /> Admin
              </button>
            )}
            <button className="btn ghost small" onClick={onSignOut}>
              <LogOut size={12} /> Sign out
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={onSignIn}>
            <LogIn size={14} /> Sign in with Google
          </button>
        )}
      </footer>
    </div>
  );
}

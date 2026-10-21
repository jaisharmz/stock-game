import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { LogIn } from "lucide-react";
import { auth, configured, signIn, signOut, touchProfile, now, usingEmulators } from "./data/firebase.js";
import { loadAccess, redeemInvite, claimOwnership } from "./data/access.js";
import { createRoom, remoteSession } from "./data/remote.js";
import { localSession } from "./data/local.js";
import { useRoute, go } from "./ui/util.js";
import { Home, Brand } from "./ui/Home.jsx";
import { Setup } from "./ui/Setup.jsx";
import { RoomView } from "./ui/Room.jsx";
import { How } from "./ui/How.jsx";
import { Admin } from "./ui/Admin.jsx";
import { Recap, Profile } from "./ui/Recap.jsx";
import { isRoomCode } from "./engine/host.js";

const firstName = (user) => (user?.displayName ?? "").split(" ")[0] || "Trader";

function SignInGate({ why }) {
  return (
    <div className="card narrow center">
      <h2>Sign in first</h2>
      <p className="dim">{why}</p>
      <button className="btn primary" onClick={() => signIn().catch(() => {})}>
        <LogIn size={14} /> Sign in with Google
      </button>
    </div>
  );
}

function RemoteRoom({ user, code }) {
  const [session, setSession] = useState(null);
  useEffect(() => {
    const s = remoteSession(user, code);
    // The session is an outside resource this effect opens and closes, like a socket.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(s);
    return () => s.dispose();
  }, [user, code]);
  return session ? <RoomView session={session} clock={now} defaultName={firstName(user)} /> : null;
}

function Practice({ user }) {
  const [session, setSession] = useState(null);
  useEffect(() => () => session?.dispose(), [session]);
  if (!session) return <Setup mode="practice" onCreate={async (opts) => setSession(localSession({ ...opts, name: firstName(user) }))} />;
  return <RoomView session={session} clock={Date.now} />;
}

export default function App() {
  const [page = "", arg] = useRoute();
  const [user, setUser] = useState(configured ? undefined : null);
  const [access, setAccess] = useState(null);

  const refreshAccess = useCallback(async (u) => setAccess(u ? await loadAccess(u).catch(() => null) : null), []);

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await touchProfile(u).catch(() => {});
        await refreshAccess(u);
      } else setAccess(null);
    });
  }, [refreshAccess]);

  // An invite link signs you in, redeems once, and lands you home.
  const redeeming = useRef(null);
  const [inviteError, setInviteError] = useState(null);
  useEffect(() => {
    if (page !== "invite" || !user || !access) return;
    if (access.role) return go("");
    if (redeeming.current === arg) return;
    redeeming.current = arg;
    redeemInvite(user, arg)
      .then(() => refreshAccess(user))
      .then(() => go(""))
      .catch((e) => setInviteError(e.message));
  }, [page, arg, user, access, refreshAccess]);

  const needsUser = (why, render) => (user === undefined ? <p className="center dim">Signing in…</p> : user ? render() : <SignInGate why={why} />);

  let body;
  if (page === "how") body = <How />;
  else if (page === "practice") body = <Practice key="practice" user={user} />;
  else if (!configured && page) body = <p className="center dim">Firebase is not configured for this build; only practice works.</p>;
  else if (page === "host")
    body = needsUser("Hosting needs an account.", () =>
      access?.member ? <Setup mode="host" onCreate={async (opts) => go(`room/${await createRoom(user, opts)}`)} /> : <p className="center dim">Hosting is invite-only for now. Redeem an invite on the home page.</p>,
    );
  else if ((page === "room" || page === "join") && arg) {
    const code = arg.toUpperCase();
    body = isRoomCode(code) ? needsUser(`Sign in to join room ${code}.`, () => <RemoteRoom key={code} user={user} code={code} />) : <p className="center warn">That is not a room code.</p>;
  } else if (page === "recap" && arg) body = needsUser("Recaps are for the people who played.", () => <Recap code={arg.toUpperCase()} user={user} />);
  else if (page === "me") body = needsUser("Your games are tied to your account.", () => <Profile user={user} />);
  else if (page === "admin") body = needsUser("Admins only.", () => <Admin user={user} access={access} onChange={() => refreshAccess(user)} />);
  else if (page === "invite") body = needsUser("Sign in to use your invite.", () => (inviteError ? <p className="center warn">{inviteError}</p> : <p className="center dim">Redeeming your invite…</p>));
  else
    body = (
      <Home
        user={user}
        access={access}
        configured={configured}
        onSignIn={() => signIn().catch(() => {})}
        onSignOut={() => signOut()}
        onRedeem={async (code) => {
          await redeemInvite(user, code);
          await refreshAccess(user);
        }}
        onClaim={async () => {
          await claimOwnership(user);
          await refreshAccess(user);
        }}
      />
    );

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      {page && (
        <nav className="topnav">
          <button className="link" onClick={() => go("")} aria-label="home">
            <Brand small />
          </button>
          {usingEmulators && <span className="pill">emulators</span>}
        </nav>
      )}
      <main>{body}</main>
    </div>
  );
}

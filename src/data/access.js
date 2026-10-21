// Who may host. Invite-only by default: an admin makes invite codes, and redeeming one
// grants membership. The first person to sign in to an empty deployment may claim it.
// Opening to the public is one switch (meta/settings.mode = "open"), with no code change.

import { doc, collection, getDoc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp, increment, Timestamp, query, orderBy } from "firebase/firestore";
import { db } from "./firebase.js";
import { cryptoToken } from "../engine/rng.js";

const quiet = (p) => p.then((d) => (d.exists() ? d.data() : null), () => null);

export async function loadAccess(user) {
  const [mine, settings, owner] = await Promise.all([quiet(getDoc(doc(db, "access", user.uid))), quiet(getDoc(doc(db, "meta", "settings"))), quiet(getDoc(doc(db, "meta", "owner")))]);
  const open = settings?.mode === "open";
  return { role: mine?.role ?? null, member: !!mine || open, admin: mine?.role === "admin", open, claimable: !owner };
}

const accessFields = (user, role, via) => ({ role, via, at: serverTimestamp(), name: (user.displayName ?? "").slice(0, 60), email: user.email });

export async function claimOwnership(user) {
  const batch = writeBatch(db);
  batch.set(doc(db, "meta", "owner"), { uid: user.uid, at: serverTimestamp() });
  batch.set(doc(db, "access", user.uid), accessFields(user, "admin", "owner"));
  await batch.commit();
}

export async function redeemInvite(user, code) {
  const clean = code.trim().toLowerCase();
  const invite = await quiet(getDoc(doc(db, "invites", clean)));
  if (!invite) throw new Error("That invite code does not exist.");
  if (invite.uses >= invite.maxUses) throw new Error("That invite has been used up.");
  if (invite.expiresAt.toMillis() < Date.now()) throw new Error("That invite has expired.");
  const batch = writeBatch(db);
  batch.set(doc(db, "access", user.uid), accessFields(user, "member", clean));
  batch.update(doc(db, "invites", clean), { uses: increment(1) });
  await batch.commit();
}

export async function createInvite(user, { maxUses, days, note }) {
  const code = cryptoToken(10);
  await setDoc(doc(db, "invites", code), { uses: 0, maxUses, by: user.uid, at: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + days * 86400000), note: note.slice(0, 80) });
  return code;
}

export async function listInvites() {
  const snap = await getDocs(query(collection(db, "invites"), orderBy("at", "desc")));
  return snap.docs.map((d) => ({ code: d.id, ...d.data() }));
}

export const deleteInvite = (code) => deleteDoc(doc(db, "invites", code));

export async function listMembers() {
  const snap = await getDocs(collection(db, "access"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export const revokeMember = (uid) => deleteDoc(doc(db, "access", uid));

export const setMode = (user, mode) => setDoc(doc(db, "meta", "settings"), { mode, by: user.uid, at: serverTimestamp() });

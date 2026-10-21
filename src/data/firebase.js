import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signInWithCredential, updateProfile, signOut as authSignOut } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, serverTimestamp } from "firebase/firestore";

const env = import.meta.env;

export const usingEmulators = env.VITE_EMULATORS === "1";
export const configured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);

const app = configured
  ? initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    })
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null;

if (app && usingEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9199", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8181);
  // Emulator only: sign in as a made-up Google account, for testing several players.
  window.__signInAs = async (sub, name) => {
    const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub, email: `${sub}@example.com`, email_verified: true })));
    await updateProfile(cred.user, { displayName: name });
    await cred.user.reload();
    return cred.user.uid;
  };
}

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOut = () => authSignOut(auth);

// The server's clock minus ours, so countdowns agree with the rules' request.time.
let offset = 0;
export const now = () => Date.now() + offset;

// Writes the profile with a server timestamp and reads it back to learn the clock offset.
export async function touchProfile(user) {
  const ref = doc(db, "users", user.uid);
  const sent = Date.now();
  await setDoc(ref, { name: (user.displayName || "Trader").slice(0, 24), photo: user.photoURL ?? "", seenAt: serverTimestamp() }, { merge: true });
  const snap = await getDocFromServer(ref);
  const received = Date.now();
  const server = snap.data()?.seenAt?.toMillis?.();
  if (server) offset = server - (sent + received) / 2;
}

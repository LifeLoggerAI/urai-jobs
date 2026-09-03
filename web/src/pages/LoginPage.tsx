import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "../lib/firebase";

export function LoginPage() {
  const [email, setEmail] = useState("adam@urailabs.com");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const token = await nextUser.getIdTokenResult(true);
        setClaims(token.claims);
      } else {
        setClaims(null);
      }
    });
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdTokenResult(true);
      setClaims(token.claims);
      setMessage("Signed in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  async function logout() {
    await signOut(auth);
    setMessage("Signed out.");
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Live Auth</div>
        <h1>Admin sign in</h1>
        <p>Use the seeded admin account to run production job smoke tests.</p>

        {user ? (
          <div className="form-stack">
            <div className="notice success">
              <strong>Signed in</strong>
              <p>{user.email}</p>
            </div>
            <pre>{JSON.stringify(claims, null, 2)}</pre>
            <button type="button" onClick={() => void logout()}>Sign out</button>
            <a href="/create">Create production smoke job</a>
            <a href="/admin">Open admin dashboard</a>
          </div>
        ) : (
          <form onSubmit={login} className="form-stack">
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button type="submit">Sign in</button>
          </form>
        )}

        {message && <div className="notice"><p>{message}</p></div>}
      </section>
    </main>
  );
}

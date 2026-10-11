import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { observeCurrentAuth } from "../lib/currentAuth";
import { hasJobCreateAccess, hasOperatorAccess } from "../lib/authz";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return observeCurrentAuth(auth, (state) => {
      setUser(state.user);
      setClaims(state.claims);
      setMessage(state.error || "");
    });
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (auth.currentUser?.uid === result.user.uid) setMessage("Signed in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed.");
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      setMessage("Signed out.");
    } catch {
      setMessage("Sign out failed. Please try again.");
    }
  }

  return (
    <main className="page-shell">
      <section className="panel">
        <div className="eyebrow">Operator access</div>
        <h1>Admin sign in</h1>
        <p>Sign in with your authorized account to review runtime activity and submit approved work.</p>

        {user ? (
          <div className="form-stack">
            <div className="notice success">
              <strong>Signed in</strong>
              <p>{user.email}</p>
            </div>
            {claims && (
              <div className="notice" role="status">
                <strong>Verified account access</strong>
                <p>{hasOperatorAccess(claims)
                  ? "You can review runtime activity and submit approved work."
                  : hasJobCreateAccess(user, claims)
                    ? "You can submit approved work."
                    : "This account does not have operator permissions."}</p>
              </div>
            )}
            <button type="button" onClick={() => void logout()}>Sign out</button>
            {hasJobCreateAccess(user, claims) && <a className="secondary-button" href="/create">Create job</a>}
            {hasOperatorAccess(claims) && <a className="secondary-button" href="/admin">Open admin dashboard</a>}
          </div>
        ) : (
          <form onSubmit={login} className="form-stack">
            <label>
              Email
              <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button type="submit">Sign in</button>
          </form>
        )}

        {message && <div className="notice" role="status"><p>{message}</p></div>}
      </section>
    </main>
  );
}

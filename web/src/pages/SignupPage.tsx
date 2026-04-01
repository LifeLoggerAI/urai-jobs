import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          email: cred.user.email,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
      navigate("/jobs", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Sign Up</h1>
      {error ? <p role="alert">{error}</p> : null}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
        minLength={6}
        placeholder="Password"
      />
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create Account"}
      </button>
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </form>
  );
}

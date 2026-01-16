import React, { useState } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore";

function Waitlist() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleJoinWaitlist = async (e) => {
    e.preventDefault();

    if (!name || !email) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      await addDoc(collection(db, "waitlist"), {
        name,
        email,
        createdAt: new Date(),
      });

      setSuccess(true);
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div>
      <h1>Join Our Waitlist</h1>
      {error && <p>{error}</p>}
      {success ? (
        <p>Thank you for joining our waitlist!</p>
      ) : (
        <form onSubmit={handleJoinWaitlist}>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">Join</button>
        </form>
      )}
    </div>
  );
}

export default Waitlist;

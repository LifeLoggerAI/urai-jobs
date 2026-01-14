import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

const Waitlist: React.FC = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      await addDoc(collection(db, 'waitlist'), {
        email: email.toLowerCase(),
        createdAt: new Date(),
      });
      alert('Successfully joined the waitlist!');
      setEmail('');
    } catch (error) {
      console.error("Error joining waitlist", error);
      alert('Failed to join the waitlist.');
    }
  };

  return (
    <div>
      <h1>Join Our Waitlist</h1>
      <form onSubmit={handleSubmit}>
        <input 
          type="email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="Enter your email" 
          required 
        />
        <button type="submit">Join</button>
      </form>
    </div>
  );
};

export default Waitlist;

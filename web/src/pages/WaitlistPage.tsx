import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const WaitlistPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [interests, setInterests] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'waitlist'), {
        email: email.toLowerCase(),
        name,
        interests: interests.split(',').map(s => s.trim()),
        consent: { terms: true, marketing: true }, // Assuming consent is given
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Error adding to waitlist: ', error);
      // Handle error display
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">You're on the list!</h1>
        <p>We'll notify you when new positions matching your interests become available.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Join our Talent Waitlist</h1>
      <p className="mb-6">Don't see the right role? Join our waitlist to be notified of future openings.</p>
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
        <input 
          type="email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="Email Address" 
          required 
          className="w-full p-2 border"
        />
        <input 
          type="text" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="Your Name (Optional)" 
          className="w-full p-2 border"
        />
        <input 
          type="text" 
          value={interests} 
          onChange={e => setInterests(e.target.value)} 
          placeholder="Interests (e.g., Engineering, Design)" 
          className="w-full p-2 border"
        />
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400">
          {loading ? 'Submitting...' : 'Join Waitlist'}
        </button>
      </form>
    </div>
  );
};

export default WaitlistPage;

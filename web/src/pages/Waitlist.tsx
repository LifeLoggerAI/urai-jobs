import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface WaitlistForm {
    name: string;
    email: string;
    interests: string[];
}

const Waitlist: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', interests: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      await addDoc(collection(db, 'waitlist'), {
        name: form.name,
        email: form.email.toLowerCase(),
        interests: form.interests.split(',').map(s => s.trim()).filter(s => s),
        createdAt: serverTimestamp(),
        consent: { terms: true, marketing: false }, // Assuming consent is implied by submission
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Error adding document: ', err);
      setError('An error occurred. Please try again.');
    }
  };

  if (submitted) {
    return (
        <div style={{ textAlign: 'center', paddingTop: '50px' }}>
            <h1>You're on the waitlist!</h1>
            <p>We'll be in touch with future opportunities.</p>
        </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        <h2>Join our Talent Waitlist</h2>
        <p>Be the first to know about new roles that match your interests.</p>
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '10px' }}>
                <label>Name (Optional)</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ marginBottom: '10px' }}>
                <label>Email</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ marginBottom: '10px' }}>
                <label>Interests (comma-separated, e.g., Engineering, Design)</label>
                <input type="text" name="interests" value={form.interests} onChange={handleChange} style={{ width: '100%', padding: '8px' }} />
            </div>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <button type="submit" style={{ padding: '10px 15px', cursor: 'pointer' }}>Join Waitlist</button>
        </form>
    </div>
  );
};

export default Waitlist;

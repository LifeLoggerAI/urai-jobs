import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const Waitlist = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    interests: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'waitlist'), {
        ...form,
        email: form.email.toLowerCase(),
        createdAt: serverTimestamp(),
      });
      // TODO: show success message
    } catch (error) {
      console.error('Error adding document: ', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        name="name"
        placeholder="Name (Optional)"
        value={form.name}
        onChange={handleChange}
      />
      <input
        type="email"
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        required
      />
      <input
        type="text"
        name="interests"
        placeholder="What are you interested in?"
        value={form.interests}
        onChange={handleChange}
      />
      <button type="submit">Join Waitlist</button>
    </form>
  );
};

export default Waitlist;

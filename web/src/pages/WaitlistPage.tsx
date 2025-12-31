import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

const WaitlistPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    interests: '',
    terms: false,
    marketing: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();


  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.terms) {
      setError('Email and consent to terms are required.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      // 1. Add to waitlist collection
      await addDoc(collection(db, 'waitlist'), {
        email: formData.email.toLowerCase(),
        name: formData.name,
        interests: formData.interests.split(',').map(s => s.trim()).filter(s => s),
        consent: {
          terms: formData.terms,
          marketing: formData.marketing,
        },
        createdAt: serverTimestamp(),
      });

      // 2. Track event
      await addDoc(collection(db, 'events'), {
        type: 'waitlist_submit',
        entityType: 'waitlist',
        entityId: formData.email.toLowerCase(), // Use email as entityId for waitlist
        createdAt: serverTimestamp(),
        metadata: {},
      });

      setSuccess(true);

    } catch (err) {
      console.error("Error signing up for waitlist: ", err);
      setError('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">You're on the list!</h1>
        <p className="text-lg mb-4">Thanks for your interest. We'll notify you when new roles that match your interests become available.</p>
        <Link to="/jobs" className="text-blue-500 hover:underline">Return to Job Listings</Link>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-4 max-w-lg">
      <h1 className="text-2xl font-bold mb-4">Join Our Talent Waitlist</h1>
      <p className="text-gray-600 mb-6">Don't see the right role? Join our waitlist to be the first to know about new opportunities.</p>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block text-gray-700 font-medium mb-2">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 font-medium mb-2">Email Address*</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="interests" className="block text-gray-700 font-medium mb-2">Areas of Interest</label>
           <p className="text-sm text-gray-500 mb-2">Separate with commas (e.g., Engineering, Design, Product)</p>
          <input
            type="text"
            id="interests"
            name="interests"
            value={formData.interests}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
         <div className="mb-6 space-y-4">
          <div className="flex items-start">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              checked={formData.terms}
              onChange={handleInputChange}
              required
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
            />
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="text-gray-700">I agree to the terms and conditions and privacy policy.*</label>
            </div>
          </div>
          <div className="flex items-start">
            <input
              id="marketing"
              name="marketing"
              type="checkbox"
              checked={formData.marketing}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
            />
            <div className="ml-3 text-sm">
              <label htmlFor="marketing" className="text-gray-700">I'd like to receive occasional marketing emails about URAI Labs.</label>
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        <button type="submit" disabled={isSubmitting} className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400">
          {isSubmitting ? 'Submitting...' : 'Join Waitlist'}
        </button>
      </form>
    </div>
  );
};

export default WaitlistPage;

import { useState, ChangeEvent, FormEvent } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

interface WaitlistFormData {
    name: string;
    email: string;
    interests: string;
    terms: boolean;
    marketing: boolean;
}

const WaitlistPage = () => {
  const [formData, setFormData] = useState<WaitlistFormData>({
    name: '',
    email: '',
    interests: '',
    terms: false,
    marketing: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.email || !formData.terms) {
      setError('Email and consent to terms are required.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const waitlistRef = await addDoc(collection(db, 'waitlist'), {
        email: formData.email.toLowerCase(),
        name: formData.name,
        interests: formData.interests.split(',').map(s => s.trim()).filter(s => s),
        consent: {
          terms: formData.terms,
          marketing: formData.marketing,
        },
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'events'), {
        type: 'waitlist_submit',
        entityType: 'waitlist',
        entityId: waitlistRef.id,
        createdAt: serverTimestamp(),
        metadata: { email: formData.email.toLowerCase() },
      });

      setSuccess(true);

    } catch (err) {
      console.error("Error signing up for waitlist: ", err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto p-4 text-center max-w-lg">
        <div className="bg-white shadow-md rounded-lg p-8 mt-10">
            <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-3xl font-bold text-gray-800 mt-4 mb-2">You're on the list!</h1>
            <p className="text-gray-600 mb-6">Thanks for your interest. We'll notify you when new roles that match your interests become available.</p>
            <Link to="/jobs" className="text-blue-600 hover:underline font-semibold">Return to Job Listings</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-lg">
     <div className="bg-white shadow-lg rounded-lg p-8 mt-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">Join Our Talent Waitlist</h1>
        <p className="text-gray-600 text-center mb-6">Don't see the right role? Join our waitlist to be the first to know about new opportunities.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address*</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="interests" className="block text-sm font-medium text-gray-700">Areas of Interest</label>
            <p className="text-xs text-gray-500 mb-2">Separate with commas (e.g., Engineering, Design, Product)</p>
            <input
              type="text"
              id="interests"
              name="interests"
              value={formData.interests}
              onChange={handleInputChange}
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-start">
              <input id="terms" name="terms" type="checkbox" checked={formData.terms} onChange={handleInputChange} required className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1" />
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="text-gray-700">I agree to the terms and conditions and privacy policy.*</label>
              </div>
            </div>
            <div className="flex items-start">
              <input id="marketing" name="marketing" type="checkbox" checked={formData.marketing} onChange={handleInputChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1" />
              <div className="ml-3 text-sm">
                <label htmlFor="marketing" className="text-gray-700">I'd like to receive occasional marketing emails about URAI Labs.</label>
              </div>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm text-center font-semibold">{error}</p>}
          <div className="pt-2">
            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 transition-colors duration-300">
              {isSubmitting ? 'Submitting...' : 'Join Waitlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WaitlistPage;

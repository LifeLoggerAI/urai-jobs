import React, { useState } from 'react';

const Waitlist: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    interests: '',
    terms: false,
    marketing: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Handle form submission
    console.log(formData);
    alert('You have been added to the waitlist!');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Join Our Talent Waitlist</h1>
      <p className="mb-4">Don't see a role that fits? Join our waitlist to be notified of future openings.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name">Full Name (Optional)</label>
          <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-lg" />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded-lg" required />
        </div>
        <div>
          <label htmlFor="interests">Areas of Interest</label>
          <textarea id="interests" name="interests" value={formData.interests} onChange={handleChange} className="w-full p-2 border rounded-lg" placeholder="e.g., Software Engineering, Product Management, Design"></textarea>
        </div>
        <div>
          <label className="flex items-center">
            <input type="checkbox" name="terms" checked={formData.terms} onChange={handleChange} className="mr-2" required />
            I agree to the terms and conditions.
          </label>
        </div>
        <div>
          <label className="flex items-center">
            <input type="checkbox" name="marketing" checked={formData.marketing} onChange={handleChange} className="mr-2" />
            I agree to receive marketing emails.
          </label>
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg">Join Waitlist</button>
      </form>
    </div>
  );
};

export default Waitlist;

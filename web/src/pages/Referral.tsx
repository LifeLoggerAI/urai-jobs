
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useReferral from '../hooks/useReferral';

const Referral: React.FC = () => {
  const { loading, error } = useReferral();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/jobs');
    }, 5000); // 5-second delay before redirecting

    return () => clearTimeout(timer);
  }, [navigate]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Processing your referral...</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>There was an error with the referral link.</div>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '60px auto', padding: '50px', textAlign: 'center', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <h1 style={{ color: '#007bff' }}>Welcome!</h1>
      <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '30px' }}>You've been referred to join the URAI team. We're excited to have you.</p>
      <p>You will be redirected to our job board shortly.</p>
      <p>If you are not redirected, <a href="/jobs">click here</a>.</p>
    </div>
  );
};

export default Referral;

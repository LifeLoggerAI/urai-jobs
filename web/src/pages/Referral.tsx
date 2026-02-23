
import React from 'react';
import useReferral from '../hooks/useReferral';

const Referral: React.FC = () => {
  const { loading, error } = useReferral();

  if (loading) {
    return <div>Processing referral...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return null;
};

export default Referral;

import React from 'react';
import { useParams } from 'react-router-dom';

const Role: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div>
      <h1>Role: {slug}</h1>
    </div>
  );
};

export default Role;

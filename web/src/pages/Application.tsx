import React from 'react';
import { useParams } from 'react-router-dom';

const Application: React.FC = () => {
  const { role } = useParams<{ role: string }>();

  return (
    <div>
      <h1>Apply for: {role}</h1>
    </div>
  );
};

export default Application;

import React from 'react';
import { useParams } from 'react-router-dom';

const Apply: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();

  return (
    <div>
      <h1>Apply for Role</h1>
      <p>Applying for Job ID: {jobId}</p>
      <form>
        <label htmlFor="name">Name</label>
        <input type="text" id="name" />

        <label htmlFor="email">Email</label>
        <input type="email" id="email" />

        <label htmlFor="response">Written Response</label>
        <textarea id="response"></textarea>

        <label>
          <input type="checkbox" />
          By applying, you consent to us reviewing your information solely for hiring purposes.
        </label>

        <button type="submit">Submit Application</button>
      </form>
    </div>
  );
};

export default Apply;

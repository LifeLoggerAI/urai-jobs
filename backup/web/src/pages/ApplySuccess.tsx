
import React from 'react';
import { Link } from 'react-router-dom';

const ApplySuccess: React.FC = () => {
  return (
    <div style={{ maxWidth: '700px', margin: '60px auto', padding: '50px', textAlign: 'center', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <h1 style={{ color: '#28a745', marginBottom: '20px' }}>Thank You for Your Application!</h1>
      <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '30px' }}>Your application has been successfully submitted. We appreciate you taking the time to apply.</p>
      
      <div style={{ textAlign: 'left', margin: '40px 0', padding: '30px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>What Happens Next?</h2>
        <p style={{ lineHeight: 1.6 }}>
          Our hiring team will carefully review your application and qualifications. If your experience is a good match for the role, 
          we will contact you to schedule an initial interview. You can typically expect to hear from us within the next two weeks.
        </p>
        <p style={{ lineHeight: 1.6 }}>
          In the meantime, feel free to browse our other open positions or learn more about our company culture.
        </p>
      </div>

      <Link to="/jobs" className="button" style={{ display: 'inline-block', padding: '12px 25px', backgroundColor: '#007bff', color: '#fff', textDecoration: 'none', borderRadius: '5px' }}>Return to Job Board</Link>
    </div>
  );
};

export default ApplySuccess;

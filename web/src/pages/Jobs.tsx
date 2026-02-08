import React from 'react';
import { Link } from 'react-router-dom';

const Jobs: React.FC = () => {
  return (
    <div>
      <header>
        <h1>Work on something that treats people like humans.</h1>
        <p>URAI is building systems for memory, meaning, and human dignity.</p>
        <p>We don’t hire fast. We hire aligned.</p>
        <p>
          We value calm execution, deep thinking, ethical restraint, and
          long-term responsibility. If you’re looking for chaos, urgency
          theater, or growth-at-all-costs — this isn’t it.
        </p>
        <Link to="/roles">
          <button>View Open Roles</button>
        </Link>
        <Link to="/faq">
          <button>Read How We Hire</button>
        </Link>
      </header>
    </div>
  );
};

export default Jobs;


import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="header">
        <div className="logo">URAI Jobs</div>
        <nav className="nav">
          <Link to="/login">Login</Link>
          <Link to="/signup" className="cta-button">Sign Up</Link>
        </nav>
      </header>
      <main className="page-shell">
        <section className="hero">
          <div className="eyebrow">URAI Jobs</div>
          <h1>Your Production Backbone for Complex Workflows</h1>
          <p>
            A scalable, traceable, and permissioned job orchestration system for the entire URAI ecosystem.
            Manage everything from rendering and data pre-computation to media transcoding and content delivery in one place.
          </p>
          <div className="hero-actions">
            <Link to="/create" className="cta-button">Get Started</Link>
            <Link to="/docs" className="secondary-button">Learn More</Link>
          </div>
        </section>

        <section className="features">
          <h2>Why URAI Jobs?</h2>
          <div className="features-grid">
            <div className="feature-item">
              <h3>Unified Execution</h3>
              <p>Consolidate job requests from URAI Spatial, Studio, Narrator, and Asset Factory into a single, managed pipeline.</p>
            </div>
            <div className="feature-item">
              <h3>Robust & Resilient</h3>
              <p>With automatic retries, dead-letter queues, and detailed logging, your jobs will run to completion, even when things go wrong.</p>
            </div>
            <div className="feature-item">
              <h3>Secure & Permissioned</h3>
              <p>A granular RBAC system and tenant isolation ensure that only authorized users and systems can create and manage jobs.</p>
            </div>
            <div className="feature-item">
              <h3>Traceable & Auditable</h3>
              <p>Every job and its entire lifecycle are recorded, providing a complete audit trail for compliance and debugging.</p>
            </div>
            <div className="feature-item">
              <h3>Scalable & Performant</h3>
              <p>Leveraging Firebase and Cloud Run, URAI Jobs can scale to handle any workload, from lightweight tasks to heavy-duty rendering.</p>
            </div>
            <div className="feature-item">
              <h3>Extensible & Integrated</h3>
              <p>A clean API and event-driven architecture make it easy to integrate your own systems and services with URAI Jobs.</p>
            </div>
          </div>
        </section>

        <section className="call-to-action">
          <h2>Ready to take control of your production workflows?</h2>
          <p>Sign up today and start building more reliable and scalable applications with URAI Jobs.</p>
          <Link to="/signup" className="cta-button">Sign Up Now</Link>
        </section>
      </main>
      <footer className="footer">
        <p>&copy; 2024 URAI. All rights reserved.</p>
      </footer>
    </div>
  );
}

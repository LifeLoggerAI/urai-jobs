# URAI-Jobs: AI Hiring Engine Spin-Off Roadmap

## 1. Vision

To evolve the internal AI capabilities of `urai-jobs` from a feature into a standalone, monetizable, best-in-class AI Hiring Engine. This engine will be offered as a B2B product (first as an API, then as a full platform), empowering other companies to build intelligent, fair, and efficient hiring workflows.

## 2. Phased Rollout

This roadmap is divided into four distinct phases, each with a clear goal, set of actions, and metric for success. This ensures a disciplined, value-driven evolution from an internal tool to a market-ready product.

### Phase 1: Internal Perfection & Data Accrual (Current - Year 1)

*   **Goal:** Make `urai-jobs` the most effective hiring tool for our own internal use, while gathering a rich, high-quality dataset for model refinement.
*   **Actions:**
    *   Deploy and harden the deterministic scoring model and bias mitigation safeguards.
    *   Actively use the system for all internal hiring.
    *   Build a robust `aiFeedback` dataset by meticulously tracking the correlation between AI suggestions and human hiring decisions.
    *   Refine the `multi-job candidate graph` to understand candidate journeys within our own ecosystem.
*   **Metric of Success:** The AI's `suggestedStatus` for candidates achieves a >75% correlation with the final `adminDecision` (e.g., 'interview', 'reject').

### Phase 2: API-ification & Private Beta (Year 1.5)

*   **Goal:** Decouple the AI engine into a standalone, consumable API and validate its technical viability and value proposition with a trusted external partner.
*   **Actions:**
    *   Refactor the core AI logic (resume parsing, scoring, summarization, skill extraction) into a set of internal microservices, independent of the `urai-jobs` frontend.
    *   Create a simple, secure, and well-documented REST API gateway for these services.
    *   Select and onboard one friendly, tech-forward startup to use the API for their hiring, free of charge, in exchange for structured feedback and integration support.
*   **Metric of Success:** The partner company successfully integrates the API and provides a testimonial confirming that it significantly reduced their time-to-screen candidates.

### Phase 3: Public API Launch (Year 2)

*   **Goal:** Launch the AI engine as a public, self-serve B2B product for developers and tech-savvy companies.
*   **Product Offering:** A usage-based API, branded as the **"TalentScore API,"** with clear endpoints:
    *   `POST /score/resume`
    *   `POST /summarize/application`
    *   `GET /extract/skills`
*   **Target Market:** Startups, HR tech companies, and freelance developers building custom HR solutions.
*   **Pricing Model:** Per-API call (e.g., $0.10 per resume scored, with volume discounts).
*   **Metric of Success:** Achieve the first 100 paying API customers and reach a run rate of at least $5,000 MRR.

### Phase 4: Full Platform Evolution (Year 3+)

*   **Goal:** Expand from a developer-focused API into a full-fledged, AI-native recruiting platform that can compete in the broader market.
*   **Actions:**
    *   Build a polished, standalone SaaS product around the proven API, offering a user-friendly interface for non-technical users.
    *   Introduce advanced, AI-powered features like the "Internal Talent Pool Mode" for candidate rediscovery and predictive analytics for hiring funnels.
    *   Begin targeting larger, mid-market customers who require more sophisticated compliance features, workflow automation, and analytics.
*   **Metric of Success:** Be recognized as a competitive, standalone AI-Hiring-Platform and achieve significant market traction (e.g., >$1M ARR).

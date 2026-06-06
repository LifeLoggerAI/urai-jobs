import { useMemo, useState } from "react";
import { createJob } from "../lib/jobsApi";
import { marketplaceOpportunitiesSeed } from "../lib/careerMarketplace";
import {
  careerOffersSeed,
  compareOffers,
  interviewPrepSeed,
  spatialCareerPortalSeed
} from "../lib/careerDecision";

type RuntimeJobState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  jobId?: string;
};

const idleRuntimeJob: RuntimeJobState = { status: "idle", message: "" };

export function CareerDecisionPage() {
  const [interviewJob, setInterviewJob] = useState<RuntimeJobState>(idleRuntimeJob);
  const [offerJob, setOfferJob] = useState<RuntimeJobState>(idleRuntimeJob);
  const [portalJob, setPortalJob] = useState<RuntimeJobState>(idleRuntimeJob);
  const comparedOffers = useMemo(() => compareOffers(careerOffersSeed), []);
  const selectedOpportunity = marketplaceOpportunitiesSeed[0];

  async function runInterviewPrep() {
    setInterviewJob({ status: "loading", message: "Creating career.interview.prep job..." });
    try {
      const result = await createJob("career.interview.prep", {
        source: "career-decision-v4",
        opportunity: selectedOpportunity,
        prepRoom: interviewPrepSeed,
        outputPrefix: `career-decision/interview-prep/${interviewPrepSeed.id}`
      });
      const jobId = String(result.jobId || result.id || "created");
      setInterviewJob({ status: "success", jobId, message: `Interview prep job created: ${jobId}` });
    } catch (error) {
      setInterviewJob({ status: "error", message: error instanceof Error ? error.message : "Interview prep job failed." });
    }
  }

  async function runOfferCompare() {
    setOfferJob({ status: "loading", message: "Creating career.offer.compare job..." });
    try {
      const result = await createJob("career.offer.compare", {
        source: "career-decision-v4",
        offers: careerOffersSeed,
        comparedOffers,
        outputPrefix: "career-decision/offer-compare"
      });
      const jobId = String(result.jobId || result.id || "created");
      setOfferJob({ status: "success", jobId, message: `Offer comparison job created: ${jobId}` });
    } catch (error) {
      setOfferJob({ status: "error", message: error instanceof Error ? error.message : "Offer comparison job failed." });
    }
  }

  async function runSpatialPortal() {
    setPortalJob({ status: "loading", message: "Creating career.spatial.portal.generate job..." });
    try {
      const result = await createJob("career.spatial.portal.generate", {
        source: "career-decision-v4",
        opportunity: selectedOpportunity,
        portal: spatialCareerPortalSeed,
        outputPrefix: `career-decision/spatial-portal/${spatialCareerPortalSeed.id}`
      });
      const jobId = String(result.jobId || result.id || "created");
      setPortalJob({ status: "success", jobId, message: `Spatial portal job created: ${jobId}` });
    } catch (error) {
      setPortalJob({ status: "error", message: error instanceof Error ? error.message : "Spatial portal job failed." });
    }
  }

  return (
    <main className="page-shell career-decision-shell">
      <section className="hero career-mirror-hero">
        <div className="eyebrow">Career Decision V4</div>
        <h1>Interview prep, offer comparison, and spatial portals.</h1>
        <p>
          V4 connects hiring-pipeline intelligence to decision support and URAI Spatial concepts while keeping
          runtime work routed through approved career jobs.
        </p>
        <div className="hero-actions">
          <a className="cta-button" href="/career-automation">Open Automation V3</a>
          <a className="secondary-button" href="/career-versions">View version console</a>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Interview Room</div>
          <h2>Prepare for the conversation before the decision.</h2>
          <p>Tone: {interviewPrepSeed.tone}</p>
        </div>
        <div className="features-grid">
          <article className="feature-item">
            <h3>Focus areas</h3>
            <p>{interviewPrepSeed.focusAreas.join(", ")}</p>
          </article>
          <article className="feature-item">
            <h3>Practice questions</h3>
            <ul className="check-list">
              {interviewPrepSeed.questions.map((question) => <li key={question}>{question}</li>)}
            </ul>
          </article>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={() => void runInterviewPrep()} disabled={interviewJob.status === "loading"}>
            {interviewJob.status === "loading" ? "Creating prep job..." : "Generate interview prep"}
          </button>
        </div>
        {interviewJob.status !== "idle" && <JobNotice job={interviewJob} />}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Offer Oracle</div>
          <h2>Compare fit, growth, load, and burnout risk.</h2>
        </div>
        <div className="features-grid">
          {comparedOffers.map((offer) => (
            <article className="feature-item" key={offer.id}>
              <h3>{offer.title}</h3>
              <p>{offer.organization}</p>
              <p>{offer.compensationLabel}</p>
              <div className="status-grid">
                <article><strong>{offer.decisionScore}</strong><span>Decision score</span></article>
                <article><strong>{offer.autonomyFit}</strong><span>Autonomy</span></article>
                <article><strong>{offer.burnoutRisk}</strong><span>Burnout risk</span></article>
              </div>
            </article>
          ))}
        </div>
        <div className="hero-actions">
          <button type="button" onClick={() => void runOfferCompare()} disabled={offerJob.status === "loading"}>
            {offerJob.status === "loading" ? "Creating compare job..." : "Compare offers"}
          </button>
        </div>
        {offerJob.status !== "idle" && <JobNotice job={offerJob} />}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Spatial Career Portal</div>
          <h2>{spatialCareerPortalSeed.label}</h2>
          <p>Route type: {spatialCareerPortalSeed.routeType}</p>
        </div>
        <article className="panel career-detail-panel">
          <ul className="check-list">
            {spatialCareerPortalSeed.fieldNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
          <div className="hero-actions">
            <button type="button" onClick={() => void runSpatialPortal()} disabled={portalJob.status === "loading"}>
              {portalJob.status === "loading" ? "Creating portal job..." : "Generate spatial portal"}
            </button>
          </div>
          {portalJob.status !== "idle" && <JobNotice job={portalJob} />}
        </article>
      </section>
    </main>
  );
}

function JobNotice({ job }: { job: RuntimeJobState }) {
  return (
    <div className={`notice ${job.status}`}>
      <strong>{job.status.toUpperCase()}</strong>
      <p>{job.message}</p>
      {job.jobId && <a className="secondary-button" href="/admin">View in admin</a>}
    </div>
  );
}

import { useState } from "react";
import { createJob } from "../lib/jobsApi";
import {
  candidateProfileSeed,
  careerDocumentsSeed,
  findEmployer,
  marketplaceOpportunitiesSeed,
  reviewPacketSeed
} from "../lib/careerMarketplace";

type RuntimeJobState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  jobId?: string;
};

const idleRuntimeJob: RuntimeJobState = { status: "idle", message: "" };

export function CareerMarketplacePage() {
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(marketplaceOpportunitiesSeed[0]?.id ?? "");
  const [documentJob, setDocumentJob] = useState<RuntimeJobState>(idleRuntimeJob);
  const [tailorJob, setTailorJob] = useState<RuntimeJobState>(idleRuntimeJob);
  const [packetJob, setPacketJob] = useState<RuntimeJobState>(idleRuntimeJob);

  const selectedOpportunity = marketplaceOpportunitiesSeed.find((item) => item.id === selectedOpportunityId) ?? marketplaceOpportunitiesSeed[0];
  const selectedEmployer = selectedOpportunity ? findEmployer(selectedOpportunity.employerId) : undefined;
  const primaryDocument = careerDocumentsSeed[0];

  async function runDocumentParse() {
    setDocumentJob({ status: "loading", message: "Creating career.document.parse job..." });
    try {
      const result = await createJob("career.document.parse", {
        source: "career-marketplace-v2",
        documentRef: primaryDocument.ref,
        documentKind: primaryDocument.kind,
        outputPrefix: `career-marketplace/document-parse/${primaryDocument.id}`
      });
      const jobId = String(result.jobId || result.id || "created");
      setDocumentJob({ status: "success", jobId, message: `Document parse job created: ${jobId}` });
    } catch (error) {
      setDocumentJob({ status: "error", message: error instanceof Error ? error.message : "Document parse job failed." });
    }
  }

  async function runDocumentTailor() {
    if (!selectedOpportunity) return;
    setTailorJob({ status: "loading", message: "Creating career.document.tailor job..." });
    try {
      const result = await createJob("career.document.tailor", {
        source: "career-marketplace-v2",
        candidate: candidateProfileSeed,
        opportunity: selectedOpportunity,
        documentRef: primaryDocument.ref,
        outputPrefix: `career-marketplace/document-tailor/${selectedOpportunity.id}`
      });
      const jobId = String(result.jobId || result.id || "created");
      setTailorJob({ status: "success", jobId, message: `Document tailoring job created: ${jobId}` });
    } catch (error) {
      setTailorJob({ status: "error", message: error instanceof Error ? error.message : "Document tailoring job failed." });
    }
  }

  async function runPacketGenerate() {
    if (!selectedOpportunity) return;
    setPacketJob({ status: "loading", message: "Creating career.packet.generate job..." });
    try {
      const result = await createJob("career.packet.generate", {
        source: "career-marketplace-v2",
        candidate: candidateProfileSeed,
        opportunity: selectedOpportunity,
        packet: reviewPacketSeed,
        documents: careerDocumentsSeed,
        outputPrefix: `career-marketplace/packet/${selectedOpportunity.id}`
      });
      const jobId = String(result.jobId || result.id || "created");
      setPacketJob({ status: "success", jobId, message: `Review packet job created: ${jobId}` });
    } catch (error) {
      setPacketJob({ status: "error", message: error instanceof Error ? error.message : "Review packet job failed." });
    }
  }

  return (
    <main className="page-shell career-marketplace-shell">
      <section className="hero career-mirror-hero">
        <div className="eyebrow">Career Marketplace V2</div>
        <h1>Profiles, documents, and review packets.</h1>
        <p>
          V2 adds candidate and employer profiles, opportunity details, document intake, and packet generation.
          Outputs remain review artifacts inside URAI-Jobs.
        </p>
        <div className="hero-actions">
          <a className="cta-button" href="/career-mirror">Back to Career Mirror</a>
          <a className="secondary-button" href="/career-versions">View version console</a>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Candidate</div>
          <h2>{candidateProfileSeed.displayName}</h2>
          <p>{candidateProfileSeed.headline}</p>
        </div>
        <div className="features-grid">
          <article className="feature-item"><h3>Desired roles</h3><p>{candidateProfileSeed.desiredRoles.join(", ")}</p></article>
          <article className="feature-item"><h3>Skills</h3><p>{candidateProfileSeed.skills.join(", ")}</p></article>
          <article className="feature-item"><h3>Location preference</h3><p>{candidateProfileSeed.locationPreference}</p></article>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Opportunities</div>
          <h2>Review opportunity detail before generating artifacts.</h2>
        </div>
        <div className="career-grid">
          <div className="career-list">
            {marketplaceOpportunitiesSeed.map((item) => (
              <button className={item.id === selectedOpportunity?.id ? "preset-card active" : "preset-card"} key={item.id} type="button" onClick={() => setSelectedOpportunityId(item.id)}>
                <strong>{item.title}</strong>
                <span>{findEmployer(item.employerId)?.name ?? "Unknown employer"}</span>
                <span>{item.locationMode}</span>
              </button>
            ))}
          </div>

          {selectedOpportunity && (
            <article className="panel career-detail-panel">
              <div className="eyebrow">Opportunity Detail</div>
              <h1>{selectedOpportunity.title}</h1>
              <p>{selectedOpportunity.summary}</p>
              <div className="status-grid">
                <article><strong>{selectedEmployer?.name ?? "Unknown"}</strong><span>Employer</span></article>
                <article><strong>{selectedEmployer?.workStyle ?? "mixed"}</strong><span>Work style</span></article>
                <article><strong>{selectedOpportunity.locationMode}</strong><span>Location mode</span></article>
              </div>
              <ul className="check-list">
                {selectedOpportunity.fitNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </article>
          )}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Documents and packet jobs</div>
          <h2>Generate review artifacts.</h2>
          <p>These actions create runtime jobs for parsing, tailoring, and packet generation.</p>
        </div>

        <div className="features-grid">
          {careerDocumentsSeed.map((document) => (
            <article className="feature-item" key={document.id}>
              <h3>{document.label}</h3>
              <p>{document.kind} · {document.status}</p>
              <code>{document.ref}</code>
            </article>
          ))}
        </div>

        <div className="hero-actions">
          <button type="button" onClick={() => void runDocumentParse()} disabled={documentJob.status === "loading"}>{documentJob.status === "loading" ? "Creating parse job..." : "Parse document"}</button>
          <button type="button" className="secondary-button" onClick={() => void runDocumentTailor()} disabled={tailorJob.status === "loading"}>{tailorJob.status === "loading" ? "Creating tailor job..." : "Tailor document"}</button>
          <button type="button" className="secondary-button" onClick={() => void runPacketGenerate()} disabled={packetJob.status === "loading"}>{packetJob.status === "loading" ? "Creating packet job..." : "Generate packet"}</button>
        </div>

        {[documentJob, tailorJob, packetJob].map((job, index) => (
          job.status !== "idle" ? (
            <div className={`notice ${job.status}`} key={`${job.status}-${index}`}>
              <strong>{job.status.toUpperCase()}</strong>
              <p>{job.message}</p>
              {job.jobId && <a className="secondary-button" href="/admin">View in admin</a>}
            </div>
          ) : null
        ))}
      </section>
    </main>
  );
}

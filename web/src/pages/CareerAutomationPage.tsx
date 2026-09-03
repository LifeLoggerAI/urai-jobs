import { useState } from "react";
import { createJob } from "../lib/jobsApi";
import { marketplaceOpportunitiesSeed } from "../lib/careerMarketplace";
import {
  careerAutomationSeed,
  createLedgerEntry,
  toggleRuleStatus,
  type CareerAutomationControlState,
  type CareerExecutionLedgerEntry
} from "../lib/careerAutomation";

type RuntimeJobState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  jobId?: string;
};

const idleRuntimeJob: RuntimeJobState = { status: "idle", message: "" };

export function CareerAutomationPage() {
  const [state, setState] = useState<CareerAutomationControlState>(careerAutomationSeed);
  const [runtimeJob, setRuntimeJob] = useState<RuntimeJobState>(idleRuntimeJob);
  const selectedOpportunity = marketplaceOpportunitiesSeed[0];

  function toggleGlobalPause() {
    setState((current) => ({ ...current, globalPause: !current.globalPause }));
  }

  function toggleRule(ruleId: string) {
    setState((current) => ({
      ...current,
      rules: current.rules.map((rule) => (rule.id === ruleId ? toggleRuleStatus(rule) : rule))
    }));
  }

  function appendLedger(entry: CareerExecutionLedgerEntry) {
    setState((current) => ({ ...current, ledger: [entry, ...current.ledger] }));
  }

  async function runFollowupPlan(ruleId: string) {
    if (state.globalPause) {
      setRuntimeJob({ status: "error", message: "Global pause is enabled. Resume controls before creating a follow-up plan." });
      return;
    }

    const rule = state.rules.find((item) => item.id === ruleId);
    if (!rule || rule.status === "paused") {
      setRuntimeJob({ status: "error", message: "Selected rule is paused." });
      return;
    }

    const ledgerEntry = createLedgerEntry(ruleId, selectedOpportunity.id);
    appendLedger(ledgerEntry);
    setRuntimeJob({ status: "loading", message: "Creating career.followup.plan job..." });

    try {
      const result = await createJob("career.followup.plan", {
        source: "career-automation-v3",
        rule,
        opportunity: selectedOpportunity,
        ledgerEntry,
        outputPrefix: `career-automation/followup-plan/${ledgerEntry.id}`
      });
      const jobId = String(result.jobId || result.id || "created");
      setRuntimeJob({ status: "success", jobId, message: `Follow-up plan job created: ${jobId}` });
      setState((current) => ({
        ...current,
        ledger: current.ledger.map((entry) => entry.id === ledgerEntry.id ? { ...entry, status: "review-ready", artifactRef: `job:${jobId}` } : entry)
      }));
    } catch (error) {
      setRuntimeJob({ status: "error", message: error instanceof Error ? error.message : "Follow-up plan job failed." });
    }
  }

  return (
    <main className="page-shell career-automation-shell">
      <section className="hero career-mirror-hero">
        <div className="eyebrow">Career Automation V3</div>
        <h1>Bounded controls, pauses, and review ledger.</h1>
        <p>
          V3 introduces explicit rule controls, global pause, per-rule pause, and a ledger for reviewable
          automation artifacts. This page plans follow-up artifacts only; it does not perform external actions.
        </p>
        <div className="hero-actions">
          <button type="button" onClick={toggleGlobalPause}>{state.globalPause ? "Resume global controls" : "Pause globally"}</button>
          <a className="secondary-button" href="/career-marketplace">Open Marketplace V2</a>
          <a className="secondary-button" href="/career-versions">View version console</a>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Rules</div>
          <h2>Every rule is explicit, pausable, and review-required.</h2>
        </div>
        <div className="features-grid">
          {state.rules.map((rule) => (
            <article className="feature-item" key={rule.id}>
              <div className="launch-stage-header">
                <div>
                  <div className="eyebrow">{rule.status}</div>
                  <h3>{rule.name}</h3>
                </div>
                <span className="launch-status">review</span>
              </div>
              <p>Minimum salary: ${rule.salaryMinimum.toLocaleString()}</p>
              <p>Modes: {rule.locationModes.join(", ")}</p>
              <p>Allowed: {rule.allowedRoleKeywords.join(", ")}</p>
              <p>Excluded: {rule.excludedCompanyKeywords.join(", ")}</p>
              <p>Max weekly runs: {rule.maxWeeklyRuns}</p>
              <div className="hero-actions compact">
                <button type="button" onClick={() => toggleRule(rule.id)}>{rule.status === "active" ? "Pause rule" : "Resume rule"}</button>
                <button type="button" className="secondary-button" onClick={() => void runFollowupPlan(rule.id)} disabled={runtimeJob.status === "loading" || state.globalPause || rule.status === "paused"}>
                  {runtimeJob.status === "loading" ? "Creating plan..." : "Create follow-up plan"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {runtimeJob.status !== "idle" && (
        <section className="section-block">
          <div className={`notice ${runtimeJob.status}`}>
            <strong>{runtimeJob.status.toUpperCase()}</strong>
            <p>{runtimeJob.message}</p>
            {runtimeJob.jobId && <a className="secondary-button" href="/admin">View in admin</a>}
          </div>
        </section>
      )}

      <section className="section-block">
        <div className="section-heading">
          <div className="eyebrow">Ledger</div>
          <h2>Review trail for bounded automation.</h2>
          <p>Global pause: {state.globalPause ? "enabled" : "off"}</p>
        </div>
        <div className="features-grid">
          {state.ledger.map((entry) => (
            <article className="feature-item" key={entry.id}>
              <h3>{entry.action}</h3>
              <p>Status: {entry.status}</p>
              <p>Rule: {entry.ruleId}</p>
              <p>Opportunity: {entry.opportunityId}</p>
              <p>Created: {new Date(entry.createdAt).toLocaleString()}</p>
              {entry.artifactRef && <code>{entry.artifactRef}</code>}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

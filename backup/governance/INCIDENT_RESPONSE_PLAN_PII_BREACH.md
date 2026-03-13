# URAI-Jobs: Incident Response Plan (PII Breach Scenario)

This document outlines the formal incident response plan for the URAI-Jobs platform in the event of a confirmed or suspected breach of Personally Identifiable Information (PII), with a focus on applicant resumes.

## 1. Plan Activation

This plan is activated immediately upon the discovery of any event that could indicate a PII breach. This includes, but is not limited to:
- A credible report of unauthorized access to the Cloud Storage bucket containing resumes.
- Discovery of a vulnerability in the signed URL generation logic.
- Evidence of an administrator account compromise.
- Any unexpected public exposure of applicant data.

## 2. Incident Response Team

- **Incident Commander (IC)**: Principal SaaS Platform Architect
- **Security Lead**: Security Architect (PII-sensitive system)
- **Communications Lead**: [To be designated]
- **Legal Counsel**: [To be designated]

## 3. Response Phases

### Phase I: Containment (First 60 minutes)

1.  **Immediate Action - Isolate the Affected System**: If the breach is related to an active vulnerability (e.g., a flawed security rule or compromised service account), the immediate priority is to isolate the system. This may involve:
    - **Revoking all active signed URLs.**
    - **Deploying stricter, temporary security rules** to completely lock down the affected resource (e.g., `allow read, write: if false;` on the resume storage bucket).
    - **Disabling the compromised user account or service account.**
2.  **Preserve Evidence**: Take snapshots and preserve logs (Firebase Auth logs, Cloud Function logs, Cloud Storage access logs). Do not delete or alter potentially compromised systems.
3.  **Assemble the Incident Response Team**: The discoverer of the incident immediately notifies the Incident Commander.

### Phase II: Assessment (1-24 hours)

1.  **Determine the Scope**: The Security Lead, with support from the IC, will analyze the preserved evidence to determine:
    - **What data was exposed?** (e.g., specific applicant resumes, all resumes for a tenant, all resumes on the platform).
    - **For how long was the data exposed?**
    - **What was the attack vector?** (e.g., compromised credentials, application vulnerability, misconfiguration).
2.  **Quantify the Impact**: Identify the specific tenants (`orgId`s) and individuals affected by the breach.
3.  **Consult Legal Counsel**: The IC and Security Lead will present the findings to Legal Counsel to determine notification obligations based on GDPR, CCPA, and other relevant regulations.

### Phase III: Eradication & Recovery (1-7 days)

1.  **Eradicate the Root Cause**: Once the vulnerability has been identified, develop and deploy a permanent fix. This may involve patching code, updating security rules, or rotating credentials.
2.  **Restore Normal Operations**: Once the fix is deployed and verified, restore normal access to the system. This may involve re-enabling services that were disabled during the containment phase.
3.  **Security Audit**: Conduct a full audit of the affected system and related systems to ensure there are no other vulnerabilities.

### Phase IV: Post-Mortem & Notification (1-4 weeks)

1.  **Regulatory and Customer Notification**: Based on the advice of Legal Counsel, the Communications Lead will execute the notification plan. This will involve notifying affected tenants and individuals in accordance with legal requirements.
2.  **Internal Post-Mortem**: The Incident Response Team will conduct a blameless post-mortem to answer:
    - What happened?
    - What was the impact?
    - What did we do well?
    - What could we have done better?
    - How can we prevent this from happening again?
3.  **Generate Artifacts**: Create a detailed incident report and update the platform's security policies and procedures based on the lessons learned.

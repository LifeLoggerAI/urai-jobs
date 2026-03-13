# GOVERNANCE_LOCK.md

**Version:** 1.0.0
**Date:** 2023-10-27

This document freezes the core governance and ethical constraints for the URAI-Jobs system, version 1.0.0. These rules are non-negotiable and may only be amended through a formal, audited review process.

## Core Mandate: Trust and Safety First

URAI-Jobs is a trust-first opportunity matching system. It is not a job board, a recruitment marketing platform, or a talent marketplace. Its primary purpose is to connect individuals with opportunities in a fair, transparent, and non-exploitative manner.

## Prohibited Activities

The following activities are explicitly and permanently forbidden within the URAI-Jobs system:

1.  **Ranking and Scoring:**
    -   Candidates shall not be assigned a global or cross-job score.
    -   Jobs shall not be ranked or ordered based on predicted engagement.
    -   No leaderboards or competitive metrics of any kind are permitted.

2.  **Engagement Optimization:**
    -   The system shall not be optimized to maximize user time-on-site, application volume, or any other engagement metric.
    -   Features such as infinite scrolling, notification-based re-engagement, and gamification are forbidden.

3.  **Behavioral Data Resale:**
    -   User data, whether anonymized or aggregated, shall not be sold, shared, or otherwise transferred to any third party for any purpose, including research, marketing, or analytics.

4.  **Targeted Advertising:**
    -   The platform shall not display advertisements of any kind.

## Data Governance

-   **Data Minimization:** Only the minimum necessary data to facilitate a match shall be collected.
-   **Purpose Limitation:** Data collected for one purpose (e.g., a job application) shall not be used for another purpose without explicit, informed consent.
-   **Explainability:** The system must be able to provide a clear, plain-language explanation to a user for why they were presented with a particular opportunity.

## Change Control

-   Any change to files within the `/governance` directory requires a two-person approval, one of whom must be a designated Governance Officer.
-   The CI/CD pipeline will enforce this policy by failing any build that modifies these files without the required approval metadata in the commit message (or via a protected branch rule).

This governance posture is now locked.

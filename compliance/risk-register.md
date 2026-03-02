# URAI-JOBS Risk Register

## Risk #1 — Cloud Provider Outage
- **Impact:** High
- **Likelihood:** Medium
- **Mitigation:**
  - Multi-region redundancy
  - Daily backups
  - DR testing quarterly
- **Owner:** DevOps

## Risk #2 — Root Key Compromise
- **Impact:** Critical
- **Likelihood:** Low
- **Mitigation:**
  - Key sharding (2-of-3)
  - Offline storage
  - Rotation policy
  - No single-custodian control
- **Owner:** Security Lead

## Risk #3 — Cross-Tenant Data Exposure
- **Impact:** Critical
- **Likelihood:** Low
- **Mitigation:**
  - Org-scoped Firestore rules
  - Code review requirement
  - Penetration testing annually
- **Owner:** Engineering

## Risk #4 — Insider Access Abuse
- **Impact:** High
- **Likelihood:** Medium
- **Mitigation:**
  - Role-based access
  - Quarterly access review
  - Activity logging
- **Owner:** Security Lead

---

Last Updated: 2024-07-29

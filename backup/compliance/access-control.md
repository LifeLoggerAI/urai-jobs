# URAI-JOBS Access Control Policy

## 1. Purpose
This policy defines how logical access to URAI-JOBS systems and data is granted, reviewed, and revoked.

## 2. Scope
Applies to:
- Employees
- Contractors
- Service accounts
- Organizational users (recruiters, applicants, admins)

## 3. Access Principles
- Least Privilege
- Default Deny
- Role-Based Access Control (RBAC)
- Org-Scoped Isolation

## 4. Role Definitions
- org_admin
- recruiter
- applicant
- system_service_account

Roles are enforced via Firebase custom claims and Firestore security rules.

## 5. Authentication Requirements
- Firebase Authentication required
- MFA required for org_admin roles
- No shared credentials permitted

## 6. Provisioning Process
- Access must be approved by authorized org_admin
- Service accounts provisioned via IAM only
- All provisioning logged in audit_logs

## 7. Access Review
- Quarterly access review required
- Dormant accounts disabled after 90 days

## 8. Revocation
Access is revoked:
- Upon termination
- Upon contract end
- Upon security incident
- Immediately upon role downgrade

Revocation actions are logged immutably.

## 9. Enforcement
All access is validated via Firestore rules and zero-trust orgId checks.

---

Last Updated: 2024-07-29
Owner: Security Lead
# URAI-JOBS Change Management Procedure

## 1. Change Request Initiation
All changes must originate from ticket.

Ticket includes:

- Description
- Risk impact
- Rollback plan

## 2. Approval
- Minimum 1 reviewer (not author)
- Security review if affecting authentication or tenant data

## 3. Testing
- Must pass CI
- Staging verification required

## 4. Deployment
- Production via CI/CD only
- Manual deploys prohibited

## 5. Emergency Change
- Document within 24 hours
- Post-mortem required
# Marketplace Data And Rules Contract

Status: draft

## Core collections

### marketplacePublicJobs

Purpose:
- published and reviewable job listings

Required fields:
- id
- slug
- title
- companyName
- location
- remote
- employmentType
- description
- requirements
- salaryRange
- status
- featured
- employerId
- createdBy
- createdAt
- updatedAt
- publishedAt

## marketplaceCandidateProfiles

Purpose:
- candidate profile and resume metadata

Required fields:
- uid
- displayName
- email
- location
- links
- skills
- experience
- resumePath
- createdAt
- updatedAt

## marketplaceJobApplications

Purpose:
- candidate applications

Required fields:
- id
- jobId
- employerId
- candidateUid
- status
- resumePath
- answers
- createdAt
- updatedAt

## marketplaceEmployers

Purpose:
- employer organizations

Required fields:
- id
- orgName
- website
- status
- createdBy
- createdAt
- updatedAt

## marketplaceEmployerMembers

Purpose:
- employer membership boundaries

Required fields:
- employerId
- uid
- role
- createdAt

## Required rules behavior

### Public access

Allow:
- published job reads

Deny:
- candidate profile reads
- application reads
- admin data reads

## Candidate rules

Allow candidates to:
- read/write only their own profile
- create applications as themselves
- read only their own applications
- withdraw only their own pending applications

## Employer rules

Allow employers to:
- manage only employer-owned jobs
- read only applications for employer-owned jobs
- update only employer-owned application statuses

## Admin rules

Allow admins to:
- moderate jobs
- moderate employers
- access audit and moderation collections

## Storage rules

### marketplace/resumes/{uid}/{resumeId}

Allow:
- owner candidate
- admin

Deny:
- public access
- unrelated employers

### marketplace/company-assets/{employerId}/{assetId}

Allow:
- employer members
- admin

Deny:
- public writes
- unrelated employers

## Required tests

Before production launch, verify:

- deny-by-default behavior
- public read boundaries
- candidate ownership boundaries
- employer ownership boundaries
- admin-only moderation boundaries
- resume privacy boundaries
- duplicate application rejection
- non-admin moderation denial

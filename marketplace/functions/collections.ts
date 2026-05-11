export const marketplaceCollections = {
  publicJobs: 'marketplacePublicJobs',
  candidateProfiles: 'marketplaceCandidateProfiles',
  jobApplications: 'marketplaceJobApplications',
  employers: 'marketplaceEmployers',
  employerMembers: 'marketplaceEmployerMembers',
  adminReviews: 'marketplaceAdminReviews',
  auditLogs: 'marketplaceAuditLogs',
  leads: 'marketplaceLeads',
} as const;

export type MarketplaceCollectionName =
  (typeof marketplaceCollections)[keyof typeof marketplaceCollections];

import type { MarketplaceJob } from './types';

export const seedJobs: MarketplaceJob[] = [
  {
    id: 'urai-ai-platform-engineer',
    slug: 'urai-ai-platform-engineer',
    title: 'AI Platform Engineer',
    companyName: 'URAI Labs',
    location: 'Remote',
    remote: true,
    employmentType: 'full_time',
    description:
      'Build and scale AI infrastructure, orchestration systems, developer tooling, and production automation across URAI systems.',
    requirements: [
      'TypeScript',
      'Firebase',
      'Cloud infrastructure',
      'AI systems',
    ],
    salaryRange: 'Not specified',
    status: 'published',
    featured: true,
    employerId: 'urai-labs',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  },
];

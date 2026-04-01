export type Job = {
  id: string;
  orgId: string;
  ownerUid: string;
  title: string;
  company: string;
  description: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  invalid?: boolean;
  validationError?: string;
  validatedAt?: any;
};


import { Timestamp } from "firebase/firestore";

export interface JobApplication {
  id: string;
  jobId: string;
  applicantUid: string;
  message?: string;
  createdAt: Timestamp;
}

import { collection, doc, query, where } from "firebase/firestore";
import { useCollectionData, useDocumentData } from "react-firebase-hooks/firestore";
import { db, ORG_ID } from "../lib/firebase";

export const useJobs = () => {
    const q = query(collection(db, `orgs/${ORG_ID}/jobs`), where('status', '==', 'open'));
    const [jobs, loading, error] = useCollectionData(q);

    if (error) {
        console.error("Error fetching jobs:", error);
    }

    return { jobs, loading, error };
};

export const useJob = (jobId: string) => {
    const ref = doc(db, `orgs/${ORG_ID}/jobs`, jobId);
    const [job, loading, error] = useDocumentData(ref);

    if (error) {
        console.error(`Error fetching job ${jobId}:`, error);
    }

    return { job, loading, error };
};
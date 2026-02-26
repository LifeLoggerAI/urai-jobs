import { doc } from "firebase/firestore";
import { useDocumentData } from "react-firebase-hooks/firestore";
import { db, ORG_ID } from "../lib/firebase";
import { Application } from "../../../packages/types/src/jobs";

/**
 * Fetches a single application document from the organization's subcollection.
 * @param applicationId The ID of the application to fetch.
 */
export const useApplication = (applicationId: string) => {
    const ref = doc(db, `orgs/${ORG_ID}/applications`, applicationId);
    const [application, loading, error] = useDocumentData<Application>(ref);

    if (error) {
        console.error(`Error fetching application ${applicationId}:`, error);
    }

    return { application, loading, error };
};

// Note: The previous content of this file, which handled application *creation*,
// was architecturally incorrect. It has been moved to a new `useCreateApplication.ts` hook.

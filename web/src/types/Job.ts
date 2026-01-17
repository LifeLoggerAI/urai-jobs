export interface Job {
    id: string;
    title: string;
    department: string;
    locationType: "remote" | "hybrid" | "onsite";
    locationText: string;
    employmentType: "full_time" | "part_time" | "contract" | "intern";
    descriptionMarkdown: string;
    requirements: string[];
    niceToHave: string[];
    compensationRange?: {
        min?: number;
        max?: number;
        currency?: string;
    };
    status: "draft" | "open" | "paused" | "closed";
    createdAt: any; // server timestamp
    updatedAt: any; // server timestamp
    createdBy: string;
}

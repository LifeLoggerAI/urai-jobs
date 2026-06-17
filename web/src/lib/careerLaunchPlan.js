export const careerLaunchPlan = [
    {
        version: "V1",
        title: "Runtime plus Career Mirror foundation",
        href: "/career-mirror",
        status: "in-progress",
        summary: "Launch the verified runtime backbone and first advisory Career Mirror surface.",
        gates: [
            "Production runtime evidence recorded",
            "Career Mirror shell reachable",
            "Work preference profile visible",
            "Manual opportunity queue visible",
            "Save and hide controls available",
            "Profile summary and fit score runtime jobs creatable",
            "No external action flow present"
        ],
        runtimeJobs: ["career.profile.summarize", "career.fit.score"]
    },
    {
        version: "V2",
        title: "Marketplace and packet preparation foundation",
        href: "/career-marketplace",
        status: "scaffolded",
        summary: "Add separated candidate/employer surfaces, document intake, and reviewable packet generation.",
        gates: [
            "Candidate profile scaffold",
            "Employer profile scaffold",
            "Opportunity list and detail scaffold",
            "User document storage rules reviewed",
            "Document parse artifact generated",
            "Document tailor artifact generated",
            "Packet artifact generated",
            "User review required before outside use"
        ],
        runtimeJobs: ["career.document.parse", "career.document.tailor", "career.packet.generate"]
    },
    {
        version: "V3",
        title: "Bounded automation controls",
        href: "/career-automation",
        status: "scaffolded",
        summary: "Add explicit user rules, execution ledger, snapshots, pause controls, and revocation paths.",
        gates: [
            "Rule builder scaffold",
            "Eligibility filters scaffold",
            "Exclusion controls scaffold",
            "Quality and duplicate detection scaffold",
            "Execution ledger scaffold",
            "Artifact snapshots scaffold",
            "Global pause and per-rule pause scaffold",
            "Security and privacy review required"
        ],
        runtimeJobs: ["career.followup.plan"]
    },
    {
        version: "V4",
        title: "Interview, offer, and spatial career layer",
        href: "/career-decision",
        status: "scaffolded",
        summary: "Connect career decisions to interview prep, offer comparison, and URAI Spatial opportunity portals.",
        gates: [
            "Interview prep artifact generated",
            "Offer comparison artifact generated",
            "Work-style fit analysis scaffold",
            "Burnout-risk forecast scaffold",
            "Spatial portal artifact generated",
            "URAI Spatial boundary respected"
        ],
        runtimeJobs: ["career.interview.prep", "career.offer.compare", "career.spatial.portal.generate"]
    },
    {
        version: "V5",
        title: "Economic life-path system",
        href: "/career-passport",
        status: "scaffolded",
        summary: "Expand from jobs into Passport-backed economic path mapping and revocable compatibility packets.",
        gates: [
            "Economic path graph scaffold",
            "Multiple opportunity category scaffold",
            "Passport export artifact generated",
            "Compatibility matching design documented",
            "Skill-gap engine scaffold",
            "Long-term income path map scaffold",
            "Revocable profile controls scaffold"
        ],
        runtimeJobs: ["career.passport.export"]
    }
];

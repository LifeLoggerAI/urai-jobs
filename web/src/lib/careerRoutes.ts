export type CareerRouteManifestItem = {
  version: "HOME" | "V1" | "V2" | "V3" | "V4" | "V5" | "CONSOLE";
  label: string;
  path: string;
};

export const careerRouteManifest: CareerRouteManifestItem[] = [
  { version: "HOME", label: "URAI Jobs Home", path: "/" },
  { version: "V1", label: "Career Mirror", path: "/career-mirror" },
  { version: "V2", label: "Marketplace", path: "/career-marketplace" },
  { version: "V3", label: "Automation Controls", path: "/career-automation" },
  { version: "V4", label: "Decision Layer", path: "/career-decision" },
  { version: "V5", label: "Passport", path: "/career-passport" },
  { version: "CONSOLE", label: "Version Console", path: "/career-versions" }
];

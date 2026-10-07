export type ModuleStatus = "active";

export type BackendModule = {
  key: string;
  name: string;
  status: ModuleStatus;
  owns: string[];
  apiBase: string;
  apiDoc: string;
  phase: "foundation" | "p0";
};

export const backendModules: BackendModule[] = [
  {
    key: "health",
    name: "Health",
    status: "active",
    owns: ["liveness checks"],
    apiBase: "/api/v1/health",
    apiDoc: "health.md",
    phase: "foundation",
  },
  {
    key: "system",
    name: "System",
    status: "active",
    owns: ["module map", "backend capability discovery"],
    apiBase: "/api/v1/system",
    apiDoc: "system.md",
    phase: "foundation",
  },
  {
    key: "onboarding",
    name: "Onboarding and store setup",
    status: "active",
    owns: [
      "owner start",
      "shop draft",
      "subdomain reservation",
      "template selection",
      "launch checklist",
    ],
    apiBase: "/api/v1/onboarding",
    apiDoc: "onboarding.md",
    phase: "p0",
  },
  {
    key: "storefront",
    name: "Public storefront",
    status: "active",
    owns: [
      "published shop lookup",
      "public product reads",
      "template metadata",
    ],
    apiBase: "/api/v1/storefront",
    apiDoc: "storefront.md",
    phase: "p0",
  },
];

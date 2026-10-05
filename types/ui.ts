export type Tone =
  "neutral" | "primary" | "success" | "warning" | "danger" | "info";
export type AIState =
  | "disconnected"
  | "suggest-only"
  | "drafting"
  | "needs-human"
  | "awaiting-approval"
  | "paused"
  | "error";

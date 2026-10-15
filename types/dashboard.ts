export type DashboardSummary = {
  shopId: string;
  inventory: {
    products: number;
    available: number;
    reserved: number;
    low: number;
    out: number;
  };
  customers: number;
  openConversations: number;
  pendingDrafts: number;
  sentReplies: number;
  activity: { id: string; action: string; createdAt: string }[];
};

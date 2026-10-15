import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { connectDb } from "../../shared/db.js";
import { inventoryService } from "../inventory/inventory.service.js";
export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/:shopId", async (request) => {
    const { shopId } = z
      .object({ shopId: z.string().uuid() })
      .parse(request.params);
    const db = await connectDb();
    const [
      inventory,
      customers,
      openConversations,
      pendingDrafts,
      sentReplies,
      activity,
    ] = await Promise.all([
      inventoryService.list(shopId, {
        q: "",
        status: "all",
        stock: "all",
        category: "",
        page: 1,
        limit: 1,
      }),
      db.collection("customers").countDocuments({ shopId }),
      db
        .collection("conversations")
        .countDocuments({
          shopId,
          status: { $in: ["open", "needs_attention"] },
        }),
      db
        .collection("aiDrafts")
        .countDocuments({
          shopId,
          status: { $in: ["ready", "edited", "approved"] },
        }),
      db
        .collection("messages")
        .countDocuments({ shopId, source: "staff_approved_ai" }),
      db
        .collection("auditEvents")
        .find({ shopId }, { projection: { _id: 1, action: 1, createdAt: 1 } })
        .sort({ createdAt: -1, _id: -1 })
        .limit(8)
        .toArray(),
    ]);
    return {
      shopId,
      inventory: inventory.summary,
      customers,
      openConversations,
      pendingDrafts,
      sentReplies,
      activity: activity.map(({ _id, ...event }) => ({ id: _id, ...event })),
    };
  });
}

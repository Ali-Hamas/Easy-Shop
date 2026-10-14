import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { connectDb } from "../../shared/db.js";

const DASHBOARD_CACHE_TTL_MS = 5_000;
const dashboardCache = new Map<string, { expiresAt: number; value: unknown }>();

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get("/:shopId", async (request) => {
    const { shopId } = z
      .object({ shopId: z.string().uuid() })
      .parse(request.params);
    const cached = dashboardCache.get(shopId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const db = await connectDb();
    const [
      products,
      balanceTotals,
      stockSignals,
      customers,
      openConversations,
      pendingDrafts,
      sentReplies,
      activity,
    ] = await Promise.all([
      db.collection("products").countDocuments({ shopId }),
      db
        .collection("inventoryBalances")
        .aggregate<{ available: number; reserved: number }>([
          { $match: { shopId } },
          {
            $group: {
              _id: null,
              available: { $sum: { $subtract: ["$onHand", "$reserved"] } },
              reserved: { $sum: "$reserved" },
            },
          },
        ])
        .next(),
      db
        .collection("productVariants")
        .aggregate<{ low: number; out: number }>([
          { $match: { shopId, status: "active" } },
          {
            $lookup: {
              from: "inventoryBalances",
              localField: "_id",
              foreignField: "_id",
              as: "balance",
            },
          },
          {
            $set: {
              balance: { $first: "$balance" },
              lowStockThreshold: { $ifNull: ["$lowStockThreshold", 5] },
            },
          },
          {
            $set: {
              available: {
                $subtract: [
                  { $ifNull: ["$balance.onHand", 0] },
                  { $ifNull: ["$balance.reserved", 0] },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$productId",
              anyAvailable: {
                $max: { $cond: [{ $gt: ["$available", 0] }, 1, 0] },
              },
              anyLow: {
                $max: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ["$available", 0] },
                        { $lte: ["$available", "$lowStockThreshold"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          {
            $group: {
              _id: null,
              low: { $sum: "$anyLow" },
              out: {
                $sum: { $cond: [{ $eq: ["$anyAvailable", 0] }, 1, 0] },
              },
            },
          },
        ])
        .next(),
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
    const result = {
      shopId,
      inventory: {
        products,
        available: balanceTotals?.available ?? 0,
        reserved: balanceTotals?.reserved ?? 0,
        low: stockSignals?.low ?? 0,
        out: stockSignals?.out ?? 0,
      },
      customers,
      openConversations,
      pendingDrafts,
      sentReplies,
      activity: activity.map(({ _id, ...event }) => ({ id: _id, ...event })),
    };
    dashboardCache.set(shopId, {
      value: result,
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    });
    return result;
  });
}

import type { FastifyInstance } from "fastify";
import { databaseReady } from "../../shared/db.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/ready", async (_request, reply) => {
    const ready = await databaseReady();
    return reply.code(ready ? 200 : 503).send({
      status: ready ? "ok" : "unavailable",
      database: ready ? "connected" : "unavailable",
    });
  });
  app.get(
    "/",
    {
      schema: {
        tags: ["health"],
        summary: "Check API liveness",
        response: {
          200: {
            type: "object",
            required: ["status"],
            properties: {
              status: { type: "string" },
            },
          },
        },
      },
    },
    async () => ({ status: "ok" }),
  );
}

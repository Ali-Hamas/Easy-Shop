import type { FastifyInstance } from "fastify";
import { config } from "../../shared/config.js";
import { aiReplyService } from "./ai-replies.service.js";

export async function registerMetaWebhookRoutes(app: FastifyInstance) {
  app.get("/webhook", async (request, reply) => {
    const query = request.query as {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };
    if (
      query["hub.mode"] === "subscribe" &&
      query["hub.verify_token"] &&
      query["hub.verify_token"] === config.metaWebhookVerifyToken
    ) {
      return reply.type("text/plain").send(query["hub.challenge"] ?? "");
    }
    return reply.code(403).send({ code: "META_VERIFY_FAILED" });
  });

  app.post(
    "/webhook",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (request.headers["x-easyshop-meta-verified"] !== "1")
        return reply.code(403).send({ code: "META_SIGNATURE_INVALID" });
      return aiReplyService.handleMetaWebhook(request.body);
    },
  );
}

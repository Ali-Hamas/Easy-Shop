import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { AdsError, adsService } from "./ads.service.js";

const shopParams = z.object({ shopId: z.string().uuid() });
const callback = z.object({ code: z.string().min(1), state: z.string().length(48) });

export async function registerAdsRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Check the submitted Ads settings.", issues: error.issues });
    if (error instanceof AdsError)
      return reply.code(error.statusCode).send({ code: error.code, message: error.message });
    throw error;
  });
  app.get("/:shopId", async (request) => adsService.overview(shopParams.parse(request.params).shopId));
  app.post("/:shopId/connect", async (request) => {
    const { shopId } = shopParams.parse(request.params);
    return adsService.startConnection(shopId, request.authUser!.id);
  });
  app.get("/callback", async (request) => {
    const { code, state } = callback.parse(request.query);
    return adsService.completeConnection(code, state, request.authUser!.id);
  });
  app.patch("/:shopId/selection", async (request) => {
    const { shopId } = shopParams.parse(request.params);
    const body = z.object({ adAccountId: z.string().min(1), pixelId: z.string().min(1).optional(), catalogId: z.string().min(1).optional() }).strict().parse(request.body);
    return adsService.selectAssets(shopId, body);
  });
  app.post("/:shopId/insights/sync", async (request) => {
    const { shopId } = shopParams.parse(request.params);
    const body = z.object({ since: z.string().date(), until: z.string().date() }).strict().parse(request.body);
    return adsService.syncInsights(shopId, body.since, body.until);
  });
}

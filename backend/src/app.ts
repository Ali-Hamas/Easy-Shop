import { registerDashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { registerStorefrontMessaging } from "./modules/storefront/messaging.routes.js";
import { installAuth, registerAuthRoutes } from "./modules/auth/auth.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./shared/config.js";
import { requestContextHook } from "./shared/request-context.js";
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { registerOnboardingRoutes } from "./modules/onboarding/onboarding.routes.js";
import { registerStorefrontRoutes } from "./modules/storefront/storefront.routes.js";
import { registerSystemRoutes } from "./modules/system/system.routes.js";
import { registerInventoryRoutes } from "./modules/inventory/inventory.routes.js";
import { registerCustomerRoutes } from "./modules/customers/customers.routes.js";
import { registerAiReplyRoutes } from "./modules/ai-replies/ai-replies.routes.js";
import { isDatabaseError } from "./shared/db.js";
import { OnboardingError } from "./modules/onboarding/onboarding.service.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: [
        "req.headers.cookie",
        "req.headers.authorization",
        "res.headers.set-cookie",
        "password",
        "passwordHash",
      ],
    },
  });
  installAuth(app);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof OnboardingError)
      return reply
        .code(error.statusCode)
        .send({ code: error.code, message: error.message });
    if (isDatabaseError(error))
      return reply.code(503).send({
        code: "DATABASE_UNAVAILABLE",
        message: "Database temporarily unavailable. Please try again.",
      });
    const candidate =
      typeof error === "object" && error !== null && "statusCode" in error
        ? error.statusCode
        : undefined;
    const status =
      typeof candidate === "number" && candidate >= 400 && candidate < 500
        ? candidate
        : 500;
    return reply.code(status).send({
      code: status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message:
        status === 500
          ? "Request could not be completed."
          : "Request could not be accepted.",
    });
  });

  app.addHook("onRequest", requestContextHook);
  await app.register(helmet);
  await app.register(cors, { origin: config.appOrigin });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: { info: { title: "Easy Shop Backend API", version: "0.1.0" } },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(registerDashboardRoutes, { prefix: "/api/v1/dashboard" });
  await app.register(registerAuthRoutes, { prefix: "/api/v1/auth" });
  await app.register(registerHealthRoutes, { prefix: "/api/v1/health" });
  await app.register(registerInventoryRoutes, { prefix: "/api/v1/inventory" });
  await app.register(registerCustomerRoutes, { prefix: "/api/v1/customers" });
  await app.register(registerAiReplyRoutes, { prefix: "/api/v1/inbox" });
  await app.register(registerSystemRoutes, { prefix: "/api/v1/system" });
  await app.register(registerOnboardingRoutes, {
    prefix: "/api/v1/onboarding",
  });
  await app.register(registerStorefrontRoutes, {
    prefix: "/api/v1/storefront",
  });

  await app.register(registerStorefrontMessaging, {
    prefix: "/api/v1/storefront",
  });
  return app;
}

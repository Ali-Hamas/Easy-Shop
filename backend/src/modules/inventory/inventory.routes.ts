import type { FastifyInstance } from "fastify";
import { ZodError, z } from "zod";
import { inventoryService, InventoryError } from "./inventory.service.js";
import {
  paramsSchema,
  listSchema,
  createSchema,
  updateSchema,
  adjustmentSchema,
} from "./inventory.validators.js";
export async function registerInventoryRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({
          code: "VALIDATION_ERROR",
          message: "Check the submitted fields.",
          issues: error.issues,
        });
    if (error instanceof InventoryError)
      return reply
        .code(error.statusCode)
        .send({ code: error.code, message: error.message });
    throw error;
  });
  app.get("/:shopId/products", async (req) => {
    const { shopId } = paramsSchema.parse(req.params);
    return inventoryService.list(shopId, listSchema.parse(req.query));
  });
  app.get("/:shopId/products/:productId", async (req) => {
    const { shopId, productId } = paramsSchema.parse(req.params);
    return inventoryService.get(shopId, productId!);
  });
  app.post("/:shopId/products", async (req, reply) => {
    const { shopId } = paramsSchema.parse(req.params);
    const input = createSchema.parse(req.body);
    return reply
      .code(201)
      .send(
        await inventoryService.save(
          shopId,
          input.product,
          undefined,
          0,
          input.requestId,
        ),
      );
  });
  app.patch("/:shopId/products/:productId", async (req) => {
    const { shopId, productId } = paramsSchema.parse(req.params);
    const input = updateSchema.parse(req.body);
    return inventoryService.save(
      shopId,
      input.product,
      productId,
      input.version,
    );
  });
  app.post("/:shopId/products/:productId/adjustments", async (req) => {
    const { shopId, productId } = paramsSchema.parse(req.params);
    return inventoryService.adjust(
      shopId,
      productId!,
      adjustmentSchema.parse(req.body),
    );
  });
  app.get("/:shopId/products/:productId/history", async (req) => {
    const { shopId, productId } = paramsSchema.parse(req.params);
    const { page } = z
      .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
      .parse(req.query);
    return inventoryService.history(shopId, productId!, page);
  });
}

import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { CustomerError, customerService } from "./customers.service.js";
import {
  paramsSchema,
  listSchema,
  createSchema,
  updateSchema,
  noteSchema,
} from "./customers.validators.js";
export async function registerCustomerRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({
          code: "VALIDATION_ERROR",
          message: "Check the submitted fields.",
          issues: error.issues,
        });
    if (error instanceof CustomerError)
      return reply
        .code(error.statusCode)
        .send({ code: error.code, message: error.message });
    throw error;
  });
  app.get("/:shopId", async (req) => {
    const { shopId } = paramsSchema.parse(req.params);
    return customerService.list(shopId, listSchema.parse(req.query));
  });
  app.post("/:shopId", async (req, reply) => {
    const { shopId } = paramsSchema.parse(req.params);
    const { customer, requestId } = createSchema.parse(req.body);
    return reply
      .code(201)
      .send(await customerService.create(shopId, customer, requestId));
  });
  app.get("/:shopId/:customerId", async (req) => {
    const { shopId, customerId } = paramsSchema.parse(req.params);
    return customerService.get(shopId, customerId!);
  });
  app.patch("/:shopId/:customerId", async (req) => {
    const { shopId, customerId } = paramsSchema.parse(req.params);
    const { customer, version } = updateSchema.parse(req.body);
    return customerService.update(shopId, customerId!, customer, version);
  });
  app.get("/:shopId/:customerId/history", async (req) => {
    const { shopId, customerId } = paramsSchema.parse(req.params);
    const { page } = z
      .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
      .strict()
      .parse(req.query);
    return customerService.history(shopId, customerId!, page);
  });
  app.post("/:shopId/:customerId/notes", async (req, reply) => {
    const { shopId, customerId } = paramsSchema.parse(req.params);
    const { text, requestId } = noteSchema.parse(req.body);
    return reply
      .code(201)
      .send(await customerService.note(shopId, customerId!, text, requestId));
  });
}

import type { FastifyInstance } from "fastify";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { config } from "../../shared/config.js";
import { addLabProduct, chatSimulate, listLabProducts, seed10DemoProducts, verifyLabKeys } from "./test-lab.service.js";

const imageRef = z.string().trim().max(12000000).refine((value) => /^data:image\/(jpeg|png|webp|gif);base64,/i.test(value) || /^https?:\/\//i.test(value), "Use a public HTTP(S) image or image data URL.");
const productSchema = z.object({
  name: z.string().trim().min(1).max(140), description: z.string().trim().max(1000).optional(),
  price: z.coerce.number().min(1), stock: z.coerce.number().int().min(0).default(10),
  imageUrl: imageRef, sizes: z.array(z.string().trim().max(80)).max(20).optional(),
});
const batchItemSchema = productSchema.extend({ imageUrl: imageRef.optional(), imageBase64: imageRef.optional() }).refine((item) => Boolean(item.imageUrl || item.imageBase64), "An image is required.");
const batchSchema = z.object({ products: z.array(batchItemSchema).min(1).max(10), confirmReplace: z.literal(true) });
const chatSchema = z.object({
  text: z.string().trim().max(1000).nullable().optional(), imageUrl: imageRef.nullable().optional(),
  imageBase64: imageRef.nullable().optional(), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).nullable().optional(),
  history: z.array(z.object({ source: z.enum(["buyer", "ai", "staff", "user", "assistant"]), body: z.string().trim().max(2000) })).max(8).nullable().optional(),
});
const seedSchema = z.object({ confirm: z.literal(true), requestId: z.string().uuid() });

export async function registerTestLabRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (_request, reply) => {
    if (!config.testLabEnabled) return reply.code(404).send({ code: "NOT_FOUND", message: "Test lab is disabled." });
  });
  app.get("/ui", async (_request, reply) => {
    const paths = [
      join(process.cwd(), "src", "modules", "test-lab", "ui", "test-bench.html"),
      join(process.cwd(), "backend", "src", "modules", "test-lab", "ui", "test-bench.html"),
      fileURLToPath(new URL("ui/test-bench.html", import.meta.url)),
    ];
    const path = paths.find((candidate) => existsSync(candidate));
    if (!path) return reply.code(404).send("Test lab UI is not installed.");
    return reply.header("Cache-Control", "no-store").type("text/html; charset=utf-8").send(readFileSync(path, "utf8"));
  });
  app.get("/status", async (request) => {
    const products = await listLabProducts(request.authUser!.id);
    return { status: "ready", totalProducts: products.length, embeddedCount: products.filter((p) => p.is_embedded).length };
  });
  app.get("/products", async (request) => ({ products: await listLabProducts(request.authUser!.id) }));
  app.post("/verify-keys", async (_request) => verifyLabKeys());
  app.post("/seed-demo", { config: { rateLimit: { max: 2, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const body = seedSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Explicit confirmation and requestId are required." });
    return reply.code(201).send(await seed10DemoProducts(request.authUser!.id));
  });
  app.post("/batch-products", { config: { rateLimit: { max: 2, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const body = batchSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Check the product batch fields." });
    const products = body.data.products.map(({ imageBase64, imageUrl, ...item }) => ({ ...item, imageUrl: imageBase64 ?? imageUrl! }));
    return reply.code(201).send(await seed10DemoProducts(request.authUser!.id, products));
  });
  app.post("/products", { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const body = productSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Check the product fields." });
    return reply.code(201).send(await addLabProduct(request.authUser!.id, body.data));
  });
  app.post("/chat", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const body = chatSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Check the image, message, and history fields." });
    return chatSimulate(request.authUser!.id, body.data);
  });
}

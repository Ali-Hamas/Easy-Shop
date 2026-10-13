import type { FastifyInstance } from "fastify";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { addLabProduct, chatSimulate, listLabProducts, seed10DemoProducts, verifyLabKeys } from "./test-lab.service.js";

const productSchema = z.object({
  name: z.string().trim().min(1).max(140), description: z.string().trim().max(1000).optional(),
  price: z.coerce.number().min(1), stock: z.coerce.number().int().min(0).default(10),
  imageUrl: z.string().trim().min(5), sizes: z.array(z.string().trim()).optional(),
});
const batchSchema = z.object({ products: z.array(productSchema.extend({ imageBase64: z.string().trim().optional() })).min(1).max(10) });
const chatSchema = z.object({
  text: z.string().trim().max(1000).nullable().optional(), imageUrl: z.string().trim().nullable().optional(),
  imageBase64: z.string().trim().nullable().optional(), mimeType: z.string().trim().nullable().optional(),
  history: z.array(z.object({ source: z.enum(["buyer", "ai", "staff", "user", "assistant"]), body: z.string().trim() })).nullable().optional(),
});

export async function registerTestLabRoutes(app: FastifyInstance) {
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
  app.post("/seed-demo", async (request, reply) => reply.code(201).send(await seed10DemoProducts(request.authUser!.id)));
  app.post("/batch-products", async (request, reply) => {
    const body = batchSchema.parse(request.body);
    const products = body.products.map(({ imageBase64, imageUrl, ...item }) => ({ ...item, imageUrl: imageBase64 ? `data:image/jpeg;base64,${imageBase64.replace(/^data:[^,]+,/, "")}` : imageUrl }));
    return reply.code(201).send(await seed10DemoProducts(request.authUser!.id, products));
  });
  app.post("/products", async (request, reply) => reply.code(201).send(await addLabProduct(request.authUser!.id, productSchema.parse(request.body))));
  app.post("/chat", async (request) => chatSimulate(request.authUser!.id, chatSchema.parse(request.body ?? {})));
}

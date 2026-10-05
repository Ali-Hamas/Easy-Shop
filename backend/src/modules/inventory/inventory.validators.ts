import { z } from "zod";
const money = z.number().finite().min(0).max(9999999999.99).multipleOf(0.01);
const text = z.string().trim().max(5000);
const image = z
  .string()
  .url()
  .max(2000)
  .refine((v) => /^https?:\/\//.test(v), "Use an HTTP or HTTPS image URL.");
const sku = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((v) => v.toUpperCase());
export const variantSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(120),
    sku,
    size: z.string().trim().max(80).default(""),
    color: z.string().trim().max(80).default(""),
    material: z.string().trim().max(120).default(""),
    image: image.or(z.literal("")).default(""),
    priceOverride: money.nullable().default(null),
    openingStock: z.number().int().min(0).max(100000000).default(0),
    lowStockThreshold: z.number().int().min(0).max(1000000).default(5),
  })
  .strict();
export const productSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    sku,
    category: z.string().trim().max(100).default(""),
    description: text.default(""),
    price: money,
    comparePrice: money.nullable().default(null),
    cost: money.nullable().default(null),
    images: z.array(image).max(8).default([]),
    status: z.enum(["draft", "active", "archived"]).default("active"),
    variants: z.array(variantSchema).min(1).max(50),
    aiFacts: z
      .object({
        sellingPoints: text,
        audience: text,
        care: text,
        policyExceptions: text,
      })
      .strict(),
    seo: z
      .object({
        title: z.string().trim().max(160),
        description: z.string().trim().max(320),
      })
      .strict(),
    delivery: z
      .object({
        weightGrams: z.number().int().min(0).max(1000000).nullable(),
        note: text,
      })
      .strict(),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.variants.map((x) => x.sku)).size !== v.variants.length)
      c.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Variant SKUs must be unique.",
      });
    if (v.comparePrice !== null && v.comparePrice < v.price)
      c.addIssue({
        code: "custom",
        path: ["comparePrice"],
        message: "Compare price must not be below price.",
      });
  });
export const createSchema = z
  .object({ requestId: z.string().uuid(), product: productSchema })
  .strict();
export const updateSchema = z
  .object({ version: z.number().int().min(0), product: productSchema })
  .strict();
export const adjustmentSchema = z
  .object({
    requestId: z.string().uuid(),
    variantId: z.string().uuid(),
    version: z.number().int().min(0),
    quantity: z
      .number()
      .int()
      .min(-100000000)
      .max(100000000)
      .refine((v) => v !== 0, "Enter a nonzero quantity."),
    reason: z.string().trim().min(3).max(500),
    kind: z.enum([
      "correction",
      "receive",
      "reserve",
      "release",
      "sale",
      "return",
    ]),
  })
  .strict();
export const paramsSchema = z.object({
  shopId: z.string().uuid(),
  productId: z.string().uuid().optional(),
});
export const listSchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["all", "draft", "active", "archived"]).default("all"),
  category: z.string().max(100).default(""),
  stock: z.enum(["all", "low", "out", "healthy"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type ProductInput = z.infer<typeof productSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;

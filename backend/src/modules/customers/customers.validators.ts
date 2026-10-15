import { z } from "zod";
const text = (max: number) => z.string().trim().max(max);
export const customerInput = z
  .object({
    name: text(120).min(1),
    phone: text(32)
      .refine(
        (v) => !v || /^\+?[\d ()-]{7,32}$/.test(v),
        "Use a phone number with 7–15 digits.",
      )
      .transform((v) => v.replace(/[ ()-]/g, ""))
      .refine((v) => !v || /^\+?\d{7,15}$/.test(v), "Use 7–15 digits."),
    email: text(254)
      .refine(
        (v) => !v || z.string().email().safeParse(v).success,
        "Enter a valid email.",
      )
      .transform((v) => v.toLowerCase()),
    addresses: z
      .array(
        z
          .object({
            label: text(40).min(1),
            line: text(300).min(1),
            city: text(80),
            region: text(80),
            postalCode: text(20),
            country: text(80),
          })
          .strict(),
      )
      .max(8),
    language: z.enum([
      "unspecified",
      "en",
      "bn",
      "banglish",
      "ur",
      "roman-urdu",
    ]),
    tags: z
      .array(text(40).min(1))
      .max(20)
      .transform((tags) => [...new Set(tags.map((t) => t.toLowerCase()))]),
    source: z.enum(["manual", "facebook", "instagram", "storefront", "other"]),
    status: z.enum(["active", "inactive"]),
  })
  .strict();
export const paramsSchema = z.object({
  shopId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
});
export const listSchema = z
  .object({
    q: text(120).default(""),
    status: z.enum(["all", "active", "inactive"]).default("all"),
    source: z
      .enum(["all", "manual", "facebook", "instagram", "storefront", "other"])
      .default("all"),
    tag: text(40).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();
export const createSchema = z
  .object({ requestId: z.string().uuid(), customer: customerInput })
  .strict();
export const updateSchema = z
  .object({ version: z.number().int().min(1), customer: customerInput })
  .strict();
export const noteSchema = z
  .object({ requestId: z.string().uuid(), text: text(4000).min(1) })
  .strict();
export type CustomerInput = z.infer<typeof customerInput>;

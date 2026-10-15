import { z } from "zod";
const text = (max: number) => z.string().trim().max(max).default("");
const web = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) =>
      !v ||
      (/^https?:\/\//i.test(v) &&
        (() => {
          try {
            const u = new URL(v);
            return !u.username && !u.password;
          } catch {
            return false;
          }
        })()),
    "Use a valid http or https URL.",
  )
  .default("");
const image = z
  .string()
  .trim()
  .max(1500000)
  .refine(
    (v) =>
      !v ||
      (/^https?:\/\//i.test(v) && web.safeParse(v).success) ||
      /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v),
    "Use an image URL or upload a PNG, JPEG or WebP under 1 MB.",
  )
  .default("");
export const storefrontContentSchema = z
  .object({
    storeName: text(120),
    design: z
      .object({
        themeId: z
          .enum([
            "",
            "fashion-lifestyle",
            "beauty-cosmetics",
            "electronics-gadgets",
            "food-restaurant",
            "modern-general",
          ])
          .default(""),
        accent: z
          .enum(["theme", "neutral", "violet", "forest", "rose", "ocean"])
          .default("theme"),
        fontSet: z
          .enum(["theme", "geist", "editorial", "rounded"])
          .default("theme"),
        sections: z
          .array(
            z.enum([
              "hero",
              "categories",
              "featured",
              "catalog",
              "reviews",
              "about",
              "policies",
              "contact",
              "tracking",
              "footer",
            ]),
          )
          .max(10)
          .refine(
            (v) => new Set(v).size === v.length,
            "Each section can appear only once.",
          )
          .default([
            "hero",
            "categories",
            "featured",
            "catalog",
            "about",
            "reviews",
            "policies",
            "contact",
            "tracking",
            "footer",
          ]),
      })
      .strict()
      .default({}),
    announcement: text(140),
    headline: text(100),
    description: text(500),
    logoUrl: image,
    coverImage: image,
    storyTitle: text(100),
    story: text(3000),
    storyImage: image,
    email: z
      .union([z.literal(""), z.string().trim().email().max(254)])
      .default(""),
    phone: z
      .string()
      .trim()
      .max(40)
      .regex(/^[+\d\s().-]*$/)
      .default(""),
    address: text(300),
    instagram: web,
    facebook: web,
    whatsappNumber: z
      .string()
      .trim()
      .refine(
        (v) =>
          !v ||
          (/^\+?[\d\s().-]+$/.test(v) &&
            /^[1-9]\d{6,14}$/.test(v.replace(/\D/g, ""))),
        "Enter a WhatsApp number with country code (7–15 digits).",
      )
      .default(""),
    messengerUrl: z
      .string()
      .trim()
      .refine((v) => {
        if (!v) return true;
        try {
          const u = new URL(v);
          return (
            u.protocol === "https:" &&
            u.hostname === "m.me" &&
            !u.port &&
            !u.username &&
            !u.password &&
            !u.search &&
            !u.hash &&
            /^\/[a-zA-Z0-9.]+\/?$/.test(u.pathname)
          );
        } catch {
          return false;
        }
      }, "Use your https://m.me/page-username link without extra parameters.")
      .default(""),
    contactMessage: z
      .string()
      .trim()
      .refine(
        (v) => !v || v.split(/\s+/u).length <= 500,
        "Keep the message to 500 words or fewer.",
      )
      .default(""),
    delivery: text(1000),
    payment: text(1000),
    returns: text(1000),
    featuredProductIds: z.array(z.string().uuid()).max(8).default([]),
    collections: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(70),
            description: text(200),
            productIds: z.array(z.string().uuid()).min(1).max(24),
          })
          .strict(),
      )
      .max(6)
      .default([]),
    faqs: z
      .array(
        z
          .object({
            question: z.string().trim().min(1).max(160),
            answer: z.string().trim().min(1).max(1000),
          })
          .strict(),
      )
      .max(8)
      .default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.whatsappNumber || value.messengerUrl) && !value.contactMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactMessage"],
        message: "Write a message for your contact buttons.",
      });
    }
  });
export const emptyStorefrontContent = () => storefrontContentSchema.parse({});
export function publicStorefrontContent(value: unknown) {
  const result = storefrontContentSchema.safeParse(value);
  return result.success ? result.data : emptyStorefrontContent();
}

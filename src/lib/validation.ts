import { z } from "zod";
import { policySchema } from "./settings";
export const short = z.string().trim().max(200);
export const long = z.string().trim().max(12000);
export const id = z.string().min(1).max(100);
export const instagramUrl = z.union([
  z.literal(""),
  z
    .string()
    .url()
    .refine((v) => {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        ["instagram.com", "www.instagram.com"].includes(u.hostname)
      );
    }, "Use an Instagram HTTPS URL"),
]);
export const facebookUrl = z.union([
  z.literal(""),
  z
    .string()
    .url()
    .refine((v) => {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        [
          "facebook.com",
          "www.facebook.com",
          "m.facebook.com",
          "fb.com",
          "www.fb.com",
        ].includes(u.hostname)
      );
    }, "Use a Facebook HTTPS URL"),
]);
export const productSchema = z.object({
  name: short.min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(160),
  categoryId: id,
  categoryIds: z.array(id).min(1).max(20).optional(),
  description: long,
  price: z.number().min(0).max(999999999999).multipleOf(0.01).nullable(),
  availability: z.enum(["Available", "Reserved", "Sold", "Made to Order"]),
  published: z.boolean(),
  ownerConfirmed: z.boolean(),
  archived: z.boolean().default(false),
  specifications: z
    .object({
      brand: short.optional(),
      color: short.optional(),
      condition: short.optional(),
      inclusions: long.optional(),
      otherDetails: long.optional(),
      metal: short.optional(),
      purity: short.optional(),
      gemstone: short.optional(),
      carat: short.optional(),
      size: short.optional(),
      weight: short.optional(),
      customization: short.optional(),
    })
    .default({}),
  authenticityEnabled: z.boolean().default(false),
  authenticityText: long.default(""),
  certificateType: short.default(""),
  certificateNumber: short.default(""),
  certificateIssuer: short.default(""),
  certificateId: id.nullable().default(null),
  policies: policySchema.default({}),
  mediaIds: z.array(id).max(30).default([]),
});
export const liveSchema = z.object({
  title: short.min(1),
  startsAt: z.iso.datetime({ offset: true }),
  description: long,
  status: z.enum(["Scheduled", "Live Now", "Completed", "Cancelled"]),
  instagramUrl: instagramUrl.default(""),
  facebookUrl: facebookUrl.default(""),
  published: z.boolean(),
  replayId: id.nullable(),
  products: z
    .array(
      z.object({
        productId: id,
        timestamp: z.number().int().min(0).max(604800).nullable().default(null),
      }),
    )
    .max(150),
});
export const reelSchema = z.object({
  title: short.min(1),
  description: long,
  instagramUrl: instagramUrl.default(""),
  published: z.boolean(),
  downloadsEnabled: z.boolean(),
  assetId: id.nullable(),
  productIds: z.array(id).max(100),
});
export const contactSchema = z
  .object({
    name: short.min(2),
    email: z.union([z.literal(""), z.email().max(200)]).default(""),
    mobile: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+\d\s().-]*$/)
      .default(""),
    message: long.default(""),
    submissionKey: z.uuid(),
    website: z.string().max(0).default(""),
    turnstileToken: z.string().max(3000).optional(),
  })
  .refine(
    (v) => Boolean(v.email) || v.mobile.replace(/\D/g, "").length >= 7,
    "Provide an email address or valid contact number",
  );
export const inquirySchema = contactSchema.and(
  z.object({
    message: long.min(5),
    platform: z.enum(["Instagram", "Facebook", "Email"]),
    productId: id.nullable().default(null),
  }),
);
export const bookingSchema = contactSchema.and(
  z.object({
    email: z.email(),
    mobile: z
      .string()
      .trim()
      .min(7)
      .refine(
        (v) => v.replace(/\D/g, "").length >= 7,
        "Provide a valid contact number",
      ),
    slotId: id,
    type: z.enum([
      "Jewelry Viewing",
      "Engagement Ring Consultation",
      "Custom Jewelry Consultation",
      "General Jewelry Inquiry",
    ]),
    location: z.string().min(1).max(500),
    productId: id.nullable().default(null),
  }),
);
export const customSchema = contactSchema.and(
  z.object({
    message: long.min(5),
    email: z.email(),
    mobile: z
      .string()
      .trim()
      .min(7)
      .refine(
        (v) => v.replace(/\D/g, "").length >= 7,
        "Provide a valid contact number",
      ),
    jewelry: short.min(1),
    metal: short.default(""),
    gemstone: short.default(""),
    budget: short.default(""),
    references: z
      .array(z.object({ id, token: z.string().min(20).max(200) }))
      .max(5)
      .default([]),
  }),
);

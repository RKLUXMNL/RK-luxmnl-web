import { db } from "./db";
import { z } from "zod";
const text = z.string().trim().max(10000);
const safeUrl = z.union([
  z.literal(""),
  z
    .string()
    .url()
    .refine((v) => v.startsWith("https://"), "Use HTTPS"),
]);
export const policySchema = z.object({
  delivery: text.optional(),
  payment: text.optional(),
  installment: text.optional(),
  viewing: text.optional(),
  returns: text.optional(),
});
export const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(150),
  instagram: safeUrl,
  facebook: safeUrl,
  email: z.union([z.literal(""), z.email()]),
  mobile: z.string().max(40),
  location: z.string().max(500),
  meetup: z.string().max(500),
  logo: z.union([safeUrl, z.string().regex(/^\/api\/media\/[a-zA-Z0-9_-]+$/)]),
  policies: policySchema,
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaults: Settings = {
  businessName: "RK Luxmnl Diamond Jewelry",
  instagram: "https://www.instagram.com/rkluxmnl/",
  facebook: "https://www.facebook.com/rkluxmnl",
  email: "",
  mobile: "",
  location: "Infina Towers, Quezon City",
  meetup: "Metro Manila meetups subject to arrangement",
  logo: "",
  policies: {
    delivery:
      "Delivery and pickup arrangements are subject to confirmation. Contact us to arrange the most convenient option.",
  },
};
export async function getSettings(): Promise<Settings> {
  const row = await db.websiteSettings.findUnique({ where: { id: "main" } });
  return row ? settingsSchema.parse(row.data) : defaults;
}

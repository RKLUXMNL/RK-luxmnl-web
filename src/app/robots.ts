import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/wishlist"],
    },
    sitemap: `${process.env.APP_URL || "http://localhost:3001"}/sitemap.xml`,
  };
}

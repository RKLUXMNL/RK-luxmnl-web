import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { StoreProvider } from "@/components/store";
import { Shell } from "@/components/shell";
import "./globals.css";
import { db } from "@/lib/db";
import { publishedProducts } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
export const dynamic = "force-dynamic";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const headingFont = Fraunces({
  variable: "--font-heading",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RK Luxmnl | A little brilliance. A lifetime of meaning.",
  description:
    "Natural diamonds, gemstones and custom jewelry. Browse RK Luxmnl, explore live-selling sessions and request a private viewing in Quezon City.",
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3001"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "RK Luxmnl Diamond Jewelry",
    title: "RK Luxmnl Diamond Jewelry",
    description:
      "Natural diamonds, meaningful moments, and personal jewelry consultations.",
  },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  icons: { icon: "/icon.svg" },
  ...(process.env.ENABLE_DEMO_CATALOG === "true"
    ? { robots: { index: false, follow: false } }
    : {}),
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [products, categories, settings] = await Promise.all([
    publishedProducts(),
    db.category.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    }),
    getSettings(),
  ]);
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body>
        <StoreProvider
          initialProducts={products}
          initialCategories={categories.map((c) => c.name)}
          initialSettings={settings}
        >
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}

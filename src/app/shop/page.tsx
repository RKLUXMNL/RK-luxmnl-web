import { Catalog } from "@/components/storefront";
export const metadata = {
  title: "Jewelry Collection | RK Luxmnl",
  description:
    "Browse published jewelry, filter by category and price, and inquire about a piece.",
  alternates: { canonical: "/shop" },
};
export default function Page() {
  return <Catalog />;
}

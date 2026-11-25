import { Catalog } from "@/components/storefront";
export const metadata = {
  title: "Jewelry Showroom | RK Luxmnl",
  description:
    "Browse the RK Luxmnl showroom, filter by category and price, and inquire about a piece.",
  alternates: { canonical: "/showroom" },
};
export default function Page() {
  return <Catalog />;
}

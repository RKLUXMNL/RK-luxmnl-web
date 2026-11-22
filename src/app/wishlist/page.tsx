import { Catalog } from "@/components/storefront";
export const metadata = {
  title: "Your Jewelry Wishlist | RK Luxmnl",
  robots: { index: false, follow: false },
  alternates: { canonical: "/wishlist" },
};
export default function Page() {
  return <Catalog wishlistOnly />;
}

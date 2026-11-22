import { Admin } from "@/components/admin";
import { session } from "@/lib/security";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Business Studio | RK Luxmnl",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await session())) redirect("/admin/login");
  return <Admin />;
}

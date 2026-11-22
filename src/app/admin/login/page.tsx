import { Login } from "@/components/login";
import { session } from "@/lib/security";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Sign in | RK Luxmnl",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (await session()) redirect("/admin");
  return <Login />;
}

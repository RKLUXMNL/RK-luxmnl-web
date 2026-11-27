import { db } from "@/lib/db";
import { Stories } from "@/components/stories";
export const metadata = {
  title: "Stories of Sparkle | RK Luxmnl",
  description: "Read feedback and jewelry stories shared by RK Luxmnl clients.",
  alternates: { canonical: "/stories-of-sparkle" },
};
export default async function Page() {
  const rows = await db.sparkleStory.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <Stories
      stories={rows.map((row) => ({
        id: row.id,
        customerName: row.customerName,
        platform: row.platform as "Instagram" | "Facebook",
        message: row.message,
        sourceUrl: row.sourceUrl,
      }))}
    />
  );
}

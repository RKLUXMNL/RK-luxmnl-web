import { db } from "@/lib/db";
import { failure, json } from "@/lib/security";
import { manilaDate, manilaLabel } from "@/lib/manila";
export async function GET() {
  try {
    const blocked = await db.blockedDate.findMany();
    const slots = await db.appointmentSlot.findMany({
      where: {
        enabled: true,
        startsAt: { gt: new Date(), lt: new Date(Date.now() + 180 * 86400000) },
      },
      include: {
        appointments: {
          where: { status: { in: ["Pending", "Confirmed"] } },
          select: { id: true },
        },
      },
      orderBy: { startsAt: "asc" },
    });
    return json(
      slots
        .filter(
          (s) =>
            s.appointments.length < s.capacity &&
            !blocked.some((b) => b.date === manilaDate(s.startsAt)),
        )
        .map((s) => ({
          id: s.id,
          startsAt: s.startsAt,
          date: manilaDate(s.startsAt),
          label: manilaLabel(s.startsAt),
          remaining: s.capacity - s.appointments.length,
        })),
    );
  } catch (e) {
    return failure(e);
  }
}

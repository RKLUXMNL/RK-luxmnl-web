import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { db } from "../src/lib/db";
async function main() {
  const now = new Date();
  const sessions = await db.adminSession.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const limits = await db.rateLimit.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  console.log(
    `Expired sessions removed: ${sessions.count}; expired rate-limit entries removed: ${limits.count}.`,
  );
  await db.$disconnect();
}
main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});

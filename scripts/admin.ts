import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { db } from "../src/lib/db";
import { passwordHash } from "../src/lib/security";
import { z } from "zod";
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (
    !email ||
    !z.email().safeParse(email).success ||
    !password ||
    password.length < 14 ||
    password.length > 200
  )
    throw Error(
      "Set a valid ADMIN_EMAIL and ADMIN_PASSWORD (14–200 characters) in your environment.",
    );
  const first = (await db.adminUser.count()) === 0;
  await db.adminUser.upsert({
    where: { email },
    create: {
      email,
      passwordHash: await passwordHash(password),
      role: first ? "OWNER" : "ADMIN",
    },
    update: { passwordHash: await passwordHash(password), active: true },
  });
  await db.adminSession.deleteMany({ where: { user: { email } } });
  console.log("Administrator provisioned; existing sessions revoked.");
  await db.$disconnect();
}
main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});

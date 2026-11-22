CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN');

ALTER TABLE "AdminUser" ADD COLUMN "role" "AdminRole" NOT NULL DEFAULT 'ADMIN';

UPDATE "AdminUser" SET "role" = 'OWNER';

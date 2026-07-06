-- DropTable (drops the empty legacy table)
DROP TABLE IF EXISTS "Registry";

-- CreateEnum
CREATE TYPE "RegistryType" AS ENUM ('CASH_FUND', 'GIFT_REGISTRY', 'DONATION', 'EXTERNAL_LINK');

-- CreateTable
CREATE TABLE "registries" (
    "id" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "RegistryType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goal_amount" DECIMAL(12,2),
    "current_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "external_url" TEXT,
    "contributor_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_contributions" (
    "id" TEXT NOT NULL,
    "registry_id" TEXT NOT NULL,
    "contributor_id" TEXT,
    "contributor_name" TEXT,
    "contributor_email" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registries_event_id_idx" ON "registries"("event_id");
CREATE INDEX "registries_user_id_idx" ON "registries"("user_id");
CREATE INDEX "registries_type_idx" ON "registries"("type");
CREATE INDEX "registry_contributions_registry_id_idx" ON "registry_contributions"("registry_id");

-- AddForeignKey
ALTER TABLE "registries" ADD CONSTRAINT "registries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registries" ADD CONSTRAINT "registries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_contributions" ADD CONSTRAINT "registry_contributions_registry_id_fkey" FOREIGN KEY ("registry_id") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

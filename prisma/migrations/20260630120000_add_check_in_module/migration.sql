-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('QR', 'MANUAL');

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "guest_id" UUID,
    "ticket_id" TEXT,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_in_by_id" TEXT,
    "method" "CheckInMethod" NOT NULL DEFAULT 'MANUAL',
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "device_info" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_event_id_guest_id_key" ON "check_ins"("event_id", "guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_event_id_ticket_id_key" ON "check_ins"("event_id", "ticket_id");

-- CreateIndex
CREATE INDEX "check_ins_event_id_idx" ON "check_ins"("event_id");

-- CreateIndex
CREATE INDEX "check_ins_guest_id_idx" ON "check_ins"("guest_id");

-- CreateIndex
CREATE INDEX "check_ins_ticket_id_idx" ON "check_ins"("ticket_id");

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

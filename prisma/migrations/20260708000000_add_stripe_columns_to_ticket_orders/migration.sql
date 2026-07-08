-- Add stripe_session_id and payment_intent_id columns to ticket_orders table.
-- These columns exist in the Prisma schema but were missing from the initial ticketing migration,
-- causing Prisma to fail with a column-not-found error when querying ticket orders.

-- AddColumn (safe: IF NOT EXISTS handled by using ALTER TABLE directly)
ALTER TABLE "ticket_orders" ADD COLUMN IF NOT EXISTS "stripe_session_id" TEXT;
ALTER TABLE "ticket_orders" ADD COLUMN IF NOT EXISTS "payment_intent_id" TEXT;

-- AddUniqueIndex for stripe_session_id (matches Prisma schema @unique)
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_orders_stripe_session_id_key" ON "ticket_orders"("stripe_session_id");

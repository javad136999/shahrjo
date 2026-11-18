-- Manual bank-card payments with an uploaded invoice.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'MANUAL';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "invoice_url" VARCHAR(500);
CREATE UNIQUE INDEX IF NOT EXISTS "payments_subscription_id_key" ON "payments"("subscription_id");

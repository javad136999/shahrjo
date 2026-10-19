-- Cafe Bazaar replaces browser gateways for new subscription purchases.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'BAZAAR';
ALTER TABLE "payments" ALTER COLUMN "authority" TYPE VARCHAR(512);
ALTER TABLE "payments" ALTER COLUMN "ref_id" TYPE VARCHAR(64);

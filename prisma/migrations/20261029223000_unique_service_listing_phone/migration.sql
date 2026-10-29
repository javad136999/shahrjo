-- Preserve historical rows unchanged, but store a canonical phone key for duplicate checks.
ALTER TABLE "service_listings" ADD COLUMN "normalized_phone" VARCHAR(15);
ALTER TABLE "service_listings" ADD COLUMN "unique_phone_guard" BOOLEAN NOT NULL DEFAULT false;
UPDATE "service_listings"
SET "normalized_phone" = translate(
  regexp_replace("phone", '[^0-9۰-۹٠-٩]', '', 'g'),
  '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
  '01234567890123456789'
);
ALTER TABLE "service_listings" ALTER COLUMN "normalized_phone" SET NOT NULL;
CREATE INDEX "service_listings_normalized_phone_idx" ON "service_listings"("normalized_phone");
-- New rows are protected against concurrent duplicates. Old records (including
-- any historical duplicates) are not deleted or rewritten by a uniqueness fix.
CREATE UNIQUE INDEX "service_listings_normalized_phone_guard_key"
  ON "service_listings"("normalized_phone")
  WHERE "unique_phone_guard" = true;

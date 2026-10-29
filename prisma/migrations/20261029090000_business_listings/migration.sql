-- Business-owned property and vehicle listings.
CREATE TYPE "BusinessListingKind" AS ENUM ('PROPERTY', 'VEHICLE');

CREATE TABLE "business_listings" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "kind" "BusinessListingKind" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "deal_type" VARCHAR(30),
    "description" TEXT,
    "price" BIGINT,
    "deposit" BIGINT,
    "monthly_rent" BIGINT,
    "area_m2" INTEGER,
    "rooms" INTEGER,
    "brand" VARCHAR(80),
    "model" VARCHAR(80),
    "year" INTEGER,
    "mileage" INTEGER,
    "color" VARCHAR(40),
    "transmission" VARCHAR(40),
    "fuel" VARCHAR(40),
    "specifications" JSONB,
    "image_urls" JSONB NOT NULL DEFAULT '[]',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_listings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_listings_business_id_kind_is_available_sort_order_idx"
  ON "business_listings"("business_id", "kind", "is_available", "sort_order");

ALTER TABLE "business_listings"
  ADD CONSTRAINT "business_listings_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

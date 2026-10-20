CREATE TABLE "service_listings" (
  "id" SERIAL NOT NULL,
  "city_id" INTEGER NOT NULL,
  "category_id" INTEGER NOT NULL,
  "owner_id" INTEGER NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "phone" VARCHAR(15) NOT NULL,
  "description" VARCHAR(500),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_listings_city_id_category_id_is_active_created_at_idx"
  ON "service_listings"("city_id", "category_id", "is_active", "created_at");
CREATE INDEX "service_listings_owner_id_idx"
  ON "service_listings"("owner_id");

ALTER TABLE "service_listings"
  ADD CONSTRAINT "service_listings_city_id_fkey"
  FOREIGN KEY ("city_id") REFERENCES "cities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_listings"
  ADD CONSTRAINT "service_listings_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "business_categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_listings"
  ADD CONSTRAINT "service_listings_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

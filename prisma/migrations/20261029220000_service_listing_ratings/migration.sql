CREATE TABLE "service_listing_ratings" (
  "id" SERIAL NOT NULL,
  "service_listing_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "rating" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_listing_ratings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_listing_ratings_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);
CREATE UNIQUE INDEX "service_listing_ratings_service_listing_id_user_id_key" ON "service_listing_ratings"("service_listing_id", "user_id");
CREATE INDEX "service_listing_ratings_service_listing_id_rating_idx" ON "service_listing_ratings"("service_listing_id", "rating");
ALTER TABLE "service_listing_ratings" ADD CONSTRAINT "service_listing_ratings_service_listing_id_fkey" FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_listing_ratings" ADD CONSTRAINT "service_listing_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

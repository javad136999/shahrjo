-- Daily service-directory promotions on the city wall.
ALTER TABLE "wall_posts" ADD COLUMN "service_listing_id" INTEGER;

CREATE INDEX "wall_posts_service_listing_id_created_at_idx"
  ON "wall_posts"("service_listing_id", "created_at");

ALTER TABLE "wall_posts"
  ADD CONSTRAINT "wall_posts_service_listing_id_fkey"
  FOREIGN KEY ("service_listing_id") REFERENCES "service_listings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

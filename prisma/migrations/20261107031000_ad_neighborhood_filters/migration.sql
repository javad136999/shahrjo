-- Structured neighborhood label used by city classifieds filters.
ALTER TABLE "ads" ADD COLUMN "neighborhood" VARCHAR(120);

CREATE INDEX "ads_city_id_neighborhood_idx" ON "ads"("city_id", "neighborhood");

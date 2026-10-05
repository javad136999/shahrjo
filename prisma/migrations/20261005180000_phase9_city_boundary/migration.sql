-- Phase 9: city map boundary (GeoJSON Polygon stored as JSONB, nullable).
ALTER TABLE "cities" ADD COLUMN "boundary" JSONB;

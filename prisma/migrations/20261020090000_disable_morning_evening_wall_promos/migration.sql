-- Disable/remove the old automatic morning/evening business promotions.
-- Future publishing is disabled in WallRepostScheduler unless explicitly
-- enabled with ENABLE_WALL_REPOSTS=true.
DELETE FROM "wall_posts"
WHERE "business_id" IS NOT NULL
  AND (
    "content" LIKE '🌅 صبح بخیر شهر!%'
    OR "content" LIKE '🌇 عصرتان خوش، شهریان!%'
  );

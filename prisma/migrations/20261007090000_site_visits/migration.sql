-- Site-visit analytics: one row per Iranian calendar day (Asia/Tehran).
-- Daily rows are aggregated into monthly/yearly figures in the admin panel.
CREATE TABLE "site_visits" (
    "day" VARCHAR(10) NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("day")
);

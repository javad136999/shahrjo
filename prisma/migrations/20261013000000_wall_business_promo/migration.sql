-- Daily GOLD-business promo posts on the city wall (2/day: morning + evening).

-- AlterTable
ALTER TABLE "wall_posts" ADD COLUMN "business_id" INTEGER;

-- CreateIndex
CREATE INDEX "wall_posts_business_id_created_at_idx" ON "wall_posts"("business_id", "created_at");

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

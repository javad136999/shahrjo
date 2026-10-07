-- Phase 10: Telegram-style city wall chat (voice notes, edit marker, ad link).

-- AlterTable
ALTER TABLE "wall_posts" ADD COLUMN     "voice_url" TEXT,
ADD COLUMN     "ad_id" INTEGER,
ADD COLUMN     "edited_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "wall_posts_ad_id_created_at_idx" ON "wall_posts"("ad_id", "created_at");

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

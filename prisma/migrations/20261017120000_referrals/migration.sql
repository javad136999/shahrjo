ALTER TABLE "users"
  ADD COLUMN "referral_code" VARCHAR(16),
  ADD COLUMN "referred_by_user_id" INTEGER;

-- Give existing accounts stable, unique invite codes. New accounts receive a
-- random code in AuthService; the ID-derived legacy codes cannot collide.
UPDATE "users"
SET "referral_code" = 'SJ' || UPPER(TO_HEX("id"));

CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");
CREATE INDEX "users_referred_by_user_id_idx" ON "users"("referred_by_user_id");
ALTER TABLE "users"
  ADD CONSTRAINT "users_referred_by_user_id_fkey"
  FOREIGN KEY ("referred_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

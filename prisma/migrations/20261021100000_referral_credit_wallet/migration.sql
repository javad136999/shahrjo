CREATE TABLE "referral_credit_grants" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "milestone_count" INTEGER NOT NULL,
  "amount" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_credit_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referral_credit_redemptions" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "business_id" INTEGER NOT NULL,
  "plan_id" INTEGER NOT NULL,
  "subscription_id" INTEGER NOT NULL,
  "amount" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_credit_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_credit_grants_user_id_milestone_count_key"
  ON "referral_credit_grants"("user_id", "milestone_count");
CREATE INDEX "referral_credit_grants_user_id_created_at_idx"
  ON "referral_credit_grants"("user_id", "created_at");
CREATE UNIQUE INDEX "referral_credit_redemptions_subscription_id_key"
  ON "referral_credit_redemptions"("subscription_id");
CREATE INDEX "referral_credit_redemptions_user_id_created_at_idx"
  ON "referral_credit_redemptions"("user_id", "created_at");

ALTER TABLE "referral_credit_grants"
  ADD CONSTRAINT "referral_credit_grants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referral_credit_redemptions"
  ADD CONSTRAINT "referral_credit_redemptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "referral_credit_redemptions_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "referral_credit_redemptions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "referral_credit_redemptions_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

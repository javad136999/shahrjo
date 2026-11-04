-- Track whether an administrator has issued the campaign reward to a user.
ALTER TABLE "users"
  ADD COLUMN "reward_given" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reward_given_at" TIMESTAMP(3),
  ADD COLUMN "reward_given_by_admin_id" INTEGER;

CREATE INDEX "users_reward_given_created_at_idx"
  ON "users"("reward_given", "created_at");

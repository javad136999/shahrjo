ALTER TABLE "payments"
ADD COLUMN "bazaar_developer_payload" VARCHAR(64);

CREATE UNIQUE INDEX "payments_bazaar_developer_payload_key"
ON "payments"("bazaar_developer_payload");

-- Private one-to-one conversations and messages.
CREATE TABLE "direct_conversations" (
  "id" SERIAL NOT NULL,
  "user1_id" INTEGER NOT NULL,
  "user2_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_conversations_users_ordered_check" CHECK ("user1_id" < "user2_id")
);

CREATE TABLE "direct_messages" (
  "id" SERIAL NOT NULL,
  "conversation_id" INTEGER NOT NULL,
  "sender_id" INTEGER NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "direct_conversations_user1_id_user2_id_key"
  ON "direct_conversations"("user1_id", "user2_id");
CREATE INDEX "direct_conversations_user1_id_updated_at_idx"
  ON "direct_conversations"("user1_id", "updated_at");
CREATE INDEX "direct_conversations_user2_id_updated_at_idx"
  ON "direct_conversations"("user2_id", "updated_at");
CREATE INDEX "direct_messages_conversation_id_created_at_idx"
  ON "direct_messages"("conversation_id", "created_at");
CREATE INDEX "direct_messages_conversation_id_sender_id_read_at_idx"
  ON "direct_messages"("conversation_id", "sender_id", "read_at");

ALTER TABLE "direct_conversations"
  ADD CONSTRAINT "direct_conversations_user1_id_fkey"
  FOREIGN KEY ("user1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_conversations"
  ADD CONSTRAINT "direct_conversations_user2_id_fkey"
  FOREIGN KEY ("user2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages"
  ADD CONSTRAINT "direct_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages"
  ADD CONSTRAINT "direct_messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

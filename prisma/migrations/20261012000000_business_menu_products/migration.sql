-- Business menu & products (منو و محصولات کسب‌وکار).
-- `section` groups the rows into menu sections; price is Rial (NULL = توافقی).

-- CreateTable
CREATE TABLE "business_products" (
    "id" SERIAL NOT NULL,
    "business_id" INTEGER NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "price" BIGINT,
    "image_url" TEXT,
    "section" VARCHAR(80),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_products_business_id_sort_order_idx" ON "business_products"("business_id", "sort_order");

-- AddForeignKey
ALTER TABLE "business_products" ADD CONSTRAINT "business_products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- City service desk (دفتر خدمات شهر): the «شغلتو ثبت کن» / «چه خدماتی نیاز داری»
-- tiles only deal in service trades (تعمیرکار کولر، نقاش ساختمان، کابینت‌ساز…).
-- The flag keeps them apart from the general business categories used by the
-- full /business/new signup, without touching any existing row.
ALTER TABLE "business_categories" ADD COLUMN "is_service" BOOLEAN NOT NULL DEFAULT false;

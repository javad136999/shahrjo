# Database — PostgreSQL (فقط روی VPS)

Schema کامل: `prisma/schema.prisma` — Migration: `prisma/migrations/` — Seed: `prisma/seed/index.ts`

## جداول

| گروه | جداول |
|---|---|
| جغرافیا | `provinces`, `cities` |
| کاربران | `users`, `user_profiles`, `user_sessions`, `otp_codes` |
| RBAC | `roles`, `permissions`, `role_permissions`, `admin_users`, `audit_logs` |
| آگهی‌ها | `ads`, `ad_categories`, `ad_images` |
| کسب‌وکار | `businesses`, `business_categories`, `reviews` |
| اخبار | `news`, `news_categories` |
| چت | `chat_rooms`, `chat_messages`, `chat_reports` |
| نقشه | `map_locations` |
| تعامل | `favorites`, `comments`, `notifications`, `banners` |

## قوانین

- **Multi-City**: جدول‌های شهری `city_id` NOT NULL دارند (`chat_rooms.city_id` یکتا = یک Room عمومی برای هر شهر).
- **OTP**: فقط `code_hash` ذخیره می‌شود (هرگز کد خام)؛ `expires_at`، `attempts/max_attempts`، `consumed_at`، `last_ip`.
- **Session**: `refresh_token_hash` (یکتا) + `expires_at` + `revoked_at` — چرخش Refresh Token.
- **مبالغ** (`ads.price`): به‌صورت BigInt (ریال).
- **فایل‌ها**: فقط URL/Path در DB (`ad_images.url`, `businesses.logo_url`, ...) — باینری هرگز در Postgres.
- **`audit_logs`**: فقط append — عملیات حساس ادمین با actor, action, before/after, ip.
- **`comments`**: دقیقاً یکی از `ad_id` / `business_id` / `news_id` باید مقدار داشته باشد (کنترل در Service Layer).
- **`favorites`**: یکتای `user + ad` و `user + business`.

## Seed (idempotent — `pnpm db:seed`)

- استان‌ها: بوشهر، فارس
- شهرها: جم، عسلویه، کنگان، بوشهر، شیراز، جهرم، لار (با مختصات مرکز نقشه)
- ۶ نقش + ۱۸ Permission + لینک Role↔Permission
- دسته‌بندی آگهی (۸)، کسب‌وکار (۱۰)، خبر (۶)

> افزودن شهر جدید: فقط INSERT در `cities` (از پنل ادمین در فاز ۱۰) — بدون تغییر کد.

# شهرجو (ShahrJo)

پلتفرم شهری چنداستانی (وب‌اپ/PWA + Android). نسخه اول: فارس و بوشهر.
**بدون Supabase** — تمام Backend/Auth/DB/Realtime/Storage مال خود پروژه و روی VPS.

## استک
Next.js + TypeScript + Tailwind · NestJS + TypeScript · PostgreSQL 17 + Prisma · Redis 7 · Nginx (Let's Encrypt) · Docker

## ساختار
```
apps/web     وب‌اپ کاربران (shahrjo.ir)
apps/api     Backend مشترک (api.shahrjo.ir)
apps/admin   پنل مدیریت (admin.shahrjo.ir)
packages/    types / config / ui مشترک
prisma/      schema, migrations, seed
docker/      nginx (reverse proxy)
docs/        معماری، دیتابیس، API
scripts/     اسکریپت‌های کمکی
```

## راه‌اندازی محلی
```bash
cp .env.example .env          # سپس مقادیر CHANGE_ME را عوض کنید
pnpm install                  # وابستگی‌ها
pnpm check:env                # بررسی .env
pnpm infra:up                 # PostgreSQL + Redis
docker compose ps             # هر دو باید healthy باشند
pnpm db:migrate               # اعمال migration
pnpm db:seed                  # استان/شهر/نقش/دسته‌بندی‌ها
pnpm verify:step1             # بررسی ساختار
```

## CI (GitHub Actions)
`.github/workflows/ci.yml` بعد از هر push/PR اجرا می‌شود:
- **checks**: `pnpm verify:phase1..phase9` (ساختار + اسکن Secret + قواعد امنیتی هر فاز + `prisma validate` + typecheck) و سپس تست‌ها (`pnpm run --if-present test`)
- **database**: `prisma migrate deploy` + seed روی یک PostgreSQL 17 تمیز

## دستورات مفید
```bash
pnpm --filter @shahrjo/api start:dev   # اجرای API (نیازمند infra بالا)
pnpm --filter @shahrjo/api test        # تست‌های unit
pnpm smoke                             # تست زنده جریان auth (نیازمند infra + build)
pnpm typecheck:all                     # بررسی تایپ همه پکیج‌ها
pnpm db:studio                         # مرور دیتابیس
```

## فازها (هر فاز: Build + TypeCheck + Tests + Security Check)
1. Architecture + Database ✅ · 2. Backend + Auth ✅ · 3. City Selection ✅ · 4. City Dashboard ✅
5. Ad Submission (ثبت آگهی + آپلود عکس + تأیید) ✅ · 6. جزئیات + پروفایل + علاقه‌مندی ✅
7. اشتراک و پرداخت زرین‌پال ✅ · 8. پنل مدیریت ✅ · 8b. دیوار شهر · 9. ویترین طلایی + نقشه شهر + سهمیه ذخیره‌سازی ✅
10. چت · 11. کسب‌وکار + محصولات + نظرات · 12. تخفیف/رویداد · 13. ناظر/ادمین + اعلان‌ها
14. PWA + معرفی + بیمه/ترب · 15. Docker + Production

## قوانین
- هیچ Secret ای در Git قرار نگیرد (فقط `.env.example`).
- استان/شهر/دسته‌بندی هرگز در Frontend یا Backend hard-code نمی‌شوند.
- هر مرحله فقط پس از تست موفق مرحله قبل شروع می‌شود.
- هیچ وابستگی به Supabase (Auth/DB/Realtime/Storage) ایجاد نمی‌شود.

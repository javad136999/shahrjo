# معماری شهرجو (ShahrJo)

پلتفرم شهری چنداستانی. **Supabase در معماری اصلی وجود ندارد** — تمام Backend، Auth،
Realtime، Cache و Storage متعلق به خود پروژه است و روی VPS اجرا می‌شود.

```
Internet ──HTTPS──► Reverse Proxy [VPS]  ── Caddyِ موجود یا Nginx اختیاری + certbot
   shahrju.ir        ► web    (Next.js :3000)  PWA + پنل مدیریت در /admin
   shahrju.ir/api/*  ► api    (NestJS :4000، prefix /api/v1)

api ──► PostgreSQL 17 (Prisma)   ── داده‌های واقعی، فقط روی VPS
api ──► Redis 7                  ── Rate Limit (OTP/آپلود/دیوار) + Health
api ──► SMS Provider (Abstract)  ── IPPanel/KPanel | Kavenegar | SMS.ir | Console
api ──► Storage (Abstract)       ── VPS filesystem  |  S3-compatible (بعداً)
web ──HTTP polling (هر ۵ ثانیه)──► api   ── دیوار/چت (بدون WebSocket — طرح آینده)
```

## قوانین معماری (غیرقابل مذاکره)

- ❌ Supabase Auth / Database / Realtime / Storage — هیچ‌کدام استفاده نمی‌شوند.
- ✅ PostgreSQL، Redis، Auth، OTP، Storage همه مال خود پروژه روی VPS (بدون Supabase).
- GitHub فقط Source Code؛ هیچ Secret یا داده کاربر در Repository نیست (فقط `.env.example`).
- هیچ استان/شهر/دسته‌بندی در کد hard-code نمی‌شود؛ همه از PostgreSQL می‌آیند و
  مدیر بدون تغییر کد شهر جدید اضافه می‌کند.
- هر رکورد شهری (`ads`, `businesses`, `news`, `chat_rooms`, `banners`, `map_locations`)
  الزاماً `city_id` دارد و فیلتر در لایه Service انجام می‌شود.

## اجزا

| جزء | تصمیم |
|---|---|
| Monorepo | pnpm workspaces: `apps/web`, `apps/api`, `packages/*` — پوشهٔ `apps/admin` فقط اسکلت خالی است و پنل مدیریت عملاً در `apps/web/src/app/admin` پیاده شده |
| قراردادها | `packages/types` — قالب پاسخ `{ data, meta, error }` |
| Backend | NestJS + TypeScript — ماژول‌های موجود: auth, users, cities, content, ads, uploads, payments, wall, admin, analytics, sms, rbac, redis, health, common |
| Auth | شماره موبایل + SMS OTP (بدون Password) — Access کوتاه + Refresh چرخشی (hash در `user_sessions`) |
| OTP | در **PostgreSQL** با hash، انقضا، محدودیت تلاش، یک‌بارمصرف؛ Rate Limit روی IP و Phone در Redis |
| SMS | اینترفیس `SmsProvider` + Adapter — تعویض Provider بدون تغییر Auth (پروژه: IPPanel/KPanel با `SMS_PATTERN_CODE` پترن تاییدشده فعال است و OTP واقعی ارسال می‌شود؛ پارامتر پترن با `SMS_PATTERN_PARAM` روی `%user_code%` تنظیم شده. تا زمانی که پترن ثبت نشده باشد بدون فراخوانی API فقط OTP در لاگ ثبت می‌شود) |
| Realtime | دیوار/چت با **HTTP polling** (هر ۵ ثانیه روی `GET /wall`)؛ پیام‌ها در PostgreSQL (`wall_posts`) — سرویس WebSocket/Socket.IO وجود ندارد و فعلاً بلوک proxy هم حذف شده |
| نقشه | **Leaflet + تایل OSM** (بدون کلید API) در `city-map.tsx` و `wall-view.tsx`؛ داده از `GET /map?city=` و `GET /showcase` |
| Storage | پردازش تصویر با **sharp** (WebP کیفیت ۸۲، ضلع ≤۱۶۰۰px، Thumbnail ≤۴۰۰px، حذف EXIF)؛ فقط Key/ابعاد/حجم در DB (بدون فایل در PostgreSQL)؛ interface `StorageDriver` — امروز local (Docker volume) فردا Arvan Object Storage + CDN |
| RBAC | `roles`, `permissions`, `role_permissions`, `admin_users` با scope استان/شهر |
| Reverse Proxy | در prod: Caddy موجودِ دامنهٔ `shahrju.ir` (طبق نظر compose) یا Nginx اختیاری (`docker/nginx` + certbot) — مسیرهای Nginx با endpointهای واقعی (`/api/`، `/api/v1/files/`) هماهنگ است |
| Backup | `pg_dump` روزانه + Retention |

## نقش‌ها (RBAC)

`SUPER_ADMIN` · `PROVINCE_ADMIN` · `CITY_ADMIN` · `MODERATOR` · `BUSINESS_OWNER` · `USER`

- `SUPER_ADMIN` همه‌چیز را دارد.
- `PROVINCE_ADMIN` فقط داده‌های استان خودش (scope از طریق `admin_users.province_id`).
- `CITY_ADMIN` فقط شهر خودش (scope از طریق `admin_users.city_id`).
- `MODERATOR` نظارت محتوا: آگهی، کسب‌وکار، چت، گزارش‌ها.
- دسترسی‌ها در `permissions` به‌صورت `code` (مثل `ads.moderate`) و در seed مقداردهی می‌شوند.

## متدولوژی توسعه — ۱۵ فاز (+ 8b)

هر فاز فقط پس از موفقیت فاز قبل و با اجرای **Build + TypeCheck + Tests + Security Check** تمام می‌شود:

| فاز | محتوا | وضعیت |
|---|---|---|
| 1 | Architecture + Database | ✅ |
| 2 | Backend + Authentication (OTP/JWT/Refresh) | ✅ |
| 3 | City Selection (صفحه اول + `city_id` در profile) | ✅ |
| 4 | City Dashboard (صفحه اصلی شهر) | ✅ |
| 5 | Ad Submission (ثبت آگهی: فرم + آپلود عکس + ارسال برای تأیید) | ✅ |
| 6 | جزئیات + پروفایل + علاقه‌مندی (آگهی/خبر/کسب‌وکار، `/ad` `/news` `/business` `/profile`) | ✅ |
| 7 | اشتراک و پرداخت زرین‌پال (checkout + callback + verify سمت سرور) | ✅ |
| 8 | پنل مدیریت (صف‌های نظارت آگهی/کسب‌وکار/اشتراک + audit + 09174057031) | ✅ |
| 8b | دیوار شهر (پست، لایک، پین ناظر + فیلتر دسته‌بندی نقشه + ورود مستقیم به شهر) | ✅ |
| 9 | ویترین طلایی متحرک + نقشه شهر (محدوده GeoJSON + پین کسب‌وکارها) + سهمیه ذخیره‌سازی تصاویر | ✅ |
| 10 | چت‌روم دیوار شهر (اسم دیوار + تعداد اعضا، عکس/ویس/ریپلای/ویرایش، دکمهٔ ثبت آگهی در کامپوزر) + بازنشر روزانهٔ ۲ آگهی طلایی و ۱۰ آگهی قدیمی | ✅ |
| 11 | ثبت کسب‌وکار (فرم چندمرحله‌ای + `POST /businesses` + صف تأیید) ✅ — پنل مالک + محصولات + نظرات ⬜ | 🟡 |
| 12 | تخفیف‌ها + رویدادها | ⬜ |
| 13 | اعلان‌ها (notifications API + UI) + صفحه ناظر مستقل (تأیید آگهی‌ها اکنون در پنل فاز ۸ هست) | ⬜ |
| 14 | PWA/نصب + معرفی (زیرمجموعه) + بیمه و جستجوی ترب | ⬜ |
| 15 | Docker + Production Deployment — کد `docker-compose.prod.yml`، سرویس بکاپ و `docs/deploy.md` آماده‌اند؛ **استقرار روی VPS انجام نشده** | 🟡 |

## SEO / URL (برنامه‌ریزی‌شده — فاز ۱۳)

```
/city/jam            /city/jam/map
/city/jam/businesses /city/jam/ads
/city/jam/news
```

## جریان ورود (Divar-like)

```
شماره موبایل ─► POST /auth/send-otp ─► (validate + rate limit + hash + ذخیره در Postgres + SMS)
کد OTP       ─► POST /auth/verify-otp ─► (hash check + انقضا + تلاش‌ها + یک‌بارمصرف)
              ─► کاربر جدید؟ create : login ─► accessToken + refreshToken
اولین ورود   ─► «شهر خودت را انتخاب کن» ─► city_id در profile
              ─► «شهرجو جم» (نقشه، چت، آگهی‌ها، کسب‌وکارها، اخبار)
```

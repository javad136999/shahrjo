# معماری شهرجو (ShahrJo)

پلتفرم شهری چنداستانی. **Supabase در معماری اصلی وجود ندارد** — تمام Backend، Auth،
Realtime، Cache و Storage متعلق به خود پروژه است و روی VPS اجرا می‌شود.

```
Internet ──HTTPS──► Nginx (Let's Encrypt)  [VPS]
   shahrjo.ir        ► web    (Next.js :3000)  PWA
   api.shahrjo.ir    ► api    (NestJS :4000)
   admin.shahrjo.ir  ► admin  (Next.js :3002)

api ──► PostgreSQL 17 (Prisma)   ── داده‌های واقعی، فقط روی VPS
api ──► Redis 7                  ── Cache / Rate Limit / Presence
api ──► SMS Provider (Abstract)  ── Kavenegar | SMS.ir | FarazSMS | Console
api ──► Storage (Abstract)       ── VPS filesystem  |  S3-compatible (بعداً)
api ◄──► WebSocket (چت Real-Time)
```

## قوانین معماری (غیرقابل مذاکره)

- ❌ Supabase Auth / Database / Realtime / Storage — هیچ‌کدام استفاده نمی‌شوند.
- ✅ PostgreSQL، Redis، Auth، OTP، WebSocket، Storage همه مال خود پروژه روی VPS.
- GitHub فقط Source Code؛ هیچ Secret یا داده کاربر در Repository نیست (فقط `.env.example`).
- هیچ استان/شهر/دسته‌بندی در کد hard-code نمی‌شود؛ همه از PostgreSQL می‌آیند و
  مدیر بدون تغییر کد شهر جدید اضافه می‌کند.
- هر رکورد شهری (`ads`, `businesses`, `news`, `chat_rooms`, `banners`, `map_locations`)
  الزاماً `city_id` دارد و فیلتر در لایه Service انجام می‌شود.

## اجزا

| جزء | تصمیم |
|---|---|
| Monorepo | pnpm workspaces: `apps/web`, `apps/api`, `apps/admin`, `packages/*` |
| قراردادها | `packages/types` — قالب پاسخ `{ data, meta, error }` |
| Backend | NestJS + TypeScript — ماژول‌ها: auth, users, geo, categories, ads, businesses, news, chat, uploads, notifications, admin, audit |
| Auth | شماره موبایل + SMS OTP (بدون Password) — Access کوتاه + Refresh چرخشی (hash در `user_sessions`) |
| OTP | در **PostgreSQL** با hash، انقضا، محدودیت تلاش، یک‌بارمصرف؛ Rate Limit روی IP و Phone در Redis |
| SMS | اینترفیس `SmsProvider` + Adapter — تعویض Provider بدون تغییر Auth |
| Realtime | WebSocket (Socket.IO) — یک Chat Room عمومی per-city؛ Presence در Redis؛ پیام‌ها در PostgreSQL |
| نقشه | OpenStreetMap/Mapbox/سرویس ایرانی — قابل تعویض از طریق abstraction لایه نقشه |
| Storage | فقط URL/Path در DB؛ ابتدا VPS سپس S3-compatible |
| RBAC | `roles`, `permissions`, `role_permissions`, `admin_users` با scope استان/شهر |
| Reverse Proxy | Nginx + Let's Encrypt |
| Backup | `pg_dump` روزانه + Retention |

## نقش‌ها (RBAC)

`SUPER_ADMIN` · `PROVINCE_ADMIN` · `CITY_ADMIN` · `MODERATOR` · `BUSINESS_OWNER` · `USER`

- `SUPER_ADMIN` همه‌چیز را دارد.
- `PROVINCE_ADMIN` فقط داده‌های استان خودش (scope از طریق `admin_users.province_id`).
- `CITY_ADMIN` فقط شهر خودش (scope از طریق `admin_users.city_id`).
- `MODERATOR` نظارت محتوا: آگهی، کسب‌وکار، چت، گزارش‌ها.
- دسترسی‌ها در `permissions` به‌صورت `code` (مثل `ads.moderate`) و در seed مقداردهی می‌شوند.

## متدولوژی توسعه — ۱۴ فاز

هر فاز فقط پس از موفقیت فاز قبل و با اجرای **Build + TypeCheck + Tests + Security Check** تمام می‌شود:

| فاز | محتوا | وضعیت |
|---|---|---|
| 1 | Architecture + Database | ✅ |
| 2 | Backend + Authentication (OTP/JWT/Refresh) | ✅ |
| 3 | City Selection (صفحه اول + `city_id` در profile) | ✅ |
| 4 | City Dashboard (صفحه اصلی شهر) | ✅ |
| 5 | Ad Submission (ثبت آگهی: فرم + آپلود عکس + ارسال برای تأیید) | ✅ |
| 6 | Map | ⬜ |
| 7 | Chat (WebSocket per-city) | ⬜ |
| 8 | Ads — نمایش/جستجو/علاقه‌مندی (Marketplace) | ⬜ |
| 9 | Businesses | ⬜ |
| 10 | News | ⬜ |
| 11 | Admin | ⬜ |
| 12 | Notifications | ⬜ |
| 13 | PWA | ⬜ |
| 14 | Docker + Production Deployment (compose prod + backup + دامنه/SSL) | ⬜ |

## SEO / URL (فاز ۱۳)

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

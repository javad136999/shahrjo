# API v1 (`/api/v1`)

قالب پاسخ: `{ data, meta, error }`

## Auth (شماره موبایل + OTP — بدون Password)

| Endpoint | Body | توضیح |
|---|---|---|
| POST `/auth/send-otp` | `{ phone }` | Validate شماره، Rate Limit (IP+Phone)، تولید OTP امن، Hash، ذخیره در Postgres با انقضا، ارسال SMS |
| POST `/auth/verify-otp` | `{ phone, code }` | بررسی Hash/انقضا/تلاش‌ها/یک‌بارمصرف؛ ایجاد یا Login کاربر؛ برمی‌گرداند `{ accessToken, refreshToken, user }` |
| POST `/auth/refresh` | `{ refreshToken }` | چرخش Refresh Token (hash در `user_sessions`) |
| POST `/auth/logout` | `{ refreshToken }` | Revoked کردن یک Session |
| GET `/auth/sessions` | — | لیست نشست‌های فعال کاربر (نیازمند Access Token) |
| POST `/auth/logout-all` | — | Revoked کردن همه نشست‌های کاربر (همه دستگاه‌ها) |

## Users / City

| Module | Endpoint | وضعیت |
|---|---|---|
| users | GET/PATCH `/users/me` — `cityId` در PATCH اعتبارسنجی می‌شود (فقط شهرهای فعال) و در پاسخ `hasSelectedCity` برمی‌گردد | ✅ Phase 2/3 |
| cities | GET `/cities` — عمومی (@Public)، فقط شهرهای فعال استان‌های فعال، ویژه‌ها اول، برای صفحه انتخاب شهر | ✅ Phase 3 |
| city | GET `/me/city`, PUT `/me/city` — ذخیره/تغییر `city_id` انتخابی | ⬜ Planned |
| provinces | GET `/provinces`, GET `/provinces/:id/cities` | ⬜ Planned |
| users extra | GET `/users/me/ads`, GET `/users/me/favorites` | ⬜ Planned |

## Ads Submission / Uploads (فاز ۵ — ثبت آگهی کاربر)

> ✅ **پیاده‌شده در Phase 5**: فرم ثبت آگهی + آپلود عکس + ارسال برای تأیید (Moderation).
> شهر از profile کاربر می‌آید (نه از body) · وضعیت همیشه `PENDING` · قیمت اختیاری (خالی = «توافقی»).

| Endpoint | Auth | Body / توضیح |
|---|---|---|
| GET `/ad-categories` | @Public | دسته‌بندی‌های فعال برای فرم ثبت آگهی (ترتیب `sortOrder`) |
| POST `/uploads` | Bearer | multipart با فیلد `file` (JPG/PNG/WebP/GIF، حداکثر ۵MB، magic-byte sniff) → `{ id, url }`؛ سقف ۳۰ آپلود در ساعت |
| POST `/ads` | Bearer | `{ categoryId, title(4..160), description(10..4000), price?, phone?, address?, imageIds?(≤5) }` → ایجاد آگهی با وضعیت `PENDING`، انقضا +۳۰ روز، سقف ۲۰ آگهی در ساعت؛ تصاویر متعلق به کاربر claim می‌شوند |
| GET `/ads/mine` | Bearer | آگهی‌های خودِ کاربر با وضعیت نظارت (شامل `rejectedReason`) |

فایل‌های آپلودی از مسیر `/api/v1/files/<storageKey>` (static در همان origin) سرو می‌شوند.

## Detail pages / Profile / Favorites (فاز ۶ — جزئیات و پروفایل)

> ✅ **پیاده‌شده در Phase 6**: صفحات جزئیات آگهی/خبر/کسب‌وکار + پروفایل کاربر + علاقه‌مندی‌ها.
> گارد روی مسیرهای `@Public` در صورت داشتن توکن معتبر، کاربر را به درخواست ضمیمه می‌کند (شناسایی اختیاری).

| Endpoint | Auth | توضیح |
|---|---|---|
| GET `/ads/:id` | @Public (+اختیاری توکن) | جزئیات کامل آگهی؛ فقط `APPROVED` و بدون انقضا برای عموم؛ مالک هر وضعیتی (PENDING/REJECTED) را می‌بیند + `rejectedReason` فقط برای مالک؛ بازدید فقط برای غیرمالک +۱؛ `favorited` برای کاربرِ واردشده |
| POST `/ads/:id/favorite` | Bearer | toggle علاقه‌مندی → `{ favorited }` |
| GET `/ads/favorites` | Bearer | لیست آگهی‌های ذخیره‌شده (همان شکل `GET /ads/mine`) |
| GET `/news/:slug` | @Public | جزئیات خبر منتشرشده + شمارش بازدید؛ 404 برای غیرمنتشرشده |
| GET `/businesses/:id` | @Public | پروفایل کامل کسب‌وکار (توضیحات، ساعات کاری، شبکه‌های اجتماعی) + شمارش بازدید؛ فقط `APPROVED` |
| GET/PATCH `/users/me` | Bearer | اطلاعات پروفایل (نام نمایشی قابل ویرایش) — پیش‌تر پیاده‌شده |

## Subscriptions / ZarinPal (فاز ۷ — اشتراک و پرداخت)

> ✅ **پیاده‌شده در Phase 7**: انتخاب پلن → درگاه زرین‌پال → بازگشت callback → verify سمت سرور → ایجاد اشتراک.
> مبلغ verify همیشه از ردیف پرداختِ ذخیره‌شده خوانده می‌شود (هرگز از query/کلاینت)؛ callback با `@Public` است و با 302 به `/plans/result` در وب برمی‌گردد.

| Endpoint | Auth | Body / توضیح |
|---|---|---|
| GET `/subscription-plans` | @Public | پلن‌های فعال (`GOLD`/`SILVER`، قیمت BigInt → عدد) برای صفحه /plans |
| POST `/payments/checkout` | Bearer | `{ planId, businessId? }` → ایجاد پرداخت `CREATED`، دریافت authority از زرین‌پال، وضعیت `STARTED` → `{ paymentId, payUrl, authority, amount }`؛ سقف ۱۰ checkout در ساعت؛ `businessId` فقط اگر متعلق به خود کاربر باشد |
| GET `/payments/callback?Authority=&Status=` | @Public | بازگشت درگاه: اگر `Status=OK` → verify سمت سرور (کد 100/101 = موفق)؛ تراکنش موفق در یک تراکنش DB به `SUCCESS` + ایجاد `Subscription` می‌شود (تکرارِ callback → `ALREADY_PAID` بدون اشتراک دوم)؛ وگرنه `CANCELED`/`FAILED`؛ سپس 302 به `WEB_URL/plans/result?status=...` |
| GET `/payments/mine` | Bearer | تاریخچه پرداخت‌های کاربر (مبلغ عددی، برچسب پلن) |
| GET `/subscriptions/mine` | Bearer | اشتراک‌های کاربر + وضعیت (`ACTIVE`/`PENDING_REVIEW`) و نام کسب‌وکار |

قانون اشتراک: پلنِ متصل به کسب‌وکار پس از پرداخت `PENDING_REVIEW` می‌ماند (تأیید مدیر)؛ پلنِ شخصی بلافاصله `ACTIVE` می‌شود. merchant id فقط در env (`ZARINPAL_*`).

## Content (همه City-scoped)

> ✅ **پیاده‌شده در Phase 4** (فیدهای عمومی داشبورد شهر — همه با `?city=<slug>&limit=1..50`، فقط شهر فعال):
> `GET /news` فقط `PUBLISHED` · `GET /ads` فقط `APPROVED` و بدون انقضا (قیمت BigInt → عدد در JSON؛ دسته‌بندی با `icon`/`color` برای چیپ‌های ایموجی UI) · `GET /businesses` فقط `APPROVED` با ترتیب showcase (طلایی‌ها اول، بعد بالاترین امتیاز).

| Module | Endpoint |
|---|---|
| categories | GET `/categories?scope=ad\|business&city=` |
| ads | GET/POST `/ads`, GET/PATCH/DELETE `/ads/:id`, POST `/ads/:id/submit`, POST `/ads/:id/favorite` |
| businesses | GET/POST `/businesses`, GET `/businesses/:slug`, PATCH `/businesses/:id`, GET `/businesses/:id/stats` |
| map | GET `/map/:citySlug?bbox=&kind=` — مارکرهای نقشه (کسب‌وکار + آگهی + مکان‌ها) |
| news | GET `/news?city=`, GET `/news/:slug` |
| chat | GET `/chat/:citySlug/rooms/:id/messages` + WebSocket برای Real-Time |
| uploads | POST `/uploads` (multipart) — Storage abstraction |
| notifications | GET `/notifications`, PATCH `/notifications/:id/read`, POST `/notifications/devices` |

## Admin (فاز ۸ — پنل مدیریت، RBAC + Scope استان/شهر)

> ✅ **پیاده‌شده در Phase 8**: صف‌های نظارت روی آگهی/کسب‌وکار/اشتراک + تأیید/رد با علت + لاگ ممیزی.
> هر route با `@RequirePermissions` محافظت است؛ `AdminService` کوئری‌ها را به شهر/استان اپراتور محدود می‌کند (SUPER_ADMIN بدون محدودیت).
> اپراتور از seed ساخته می‌شود (شماره فقط داده است، نه کد) و ورود همچنان نیازمند OTP پیامکی.

| Endpoint | Permission | توضیح |
|---|---|---|
| GET `/admin/overview` | `dashboard.view` | شمارنده‌های صف (در انتظار/تأییدشده) برای داشبورد پنل |
| GET `/admin/ads?status=PENDING` | `ads.view` | صف آگهی‌ها با مالک/شهر/دسته/جلد (حداکثر ۱۰۰ ردیف) |
| POST `/admin/ads/:id/approve` | `ads.moderate` | `APPROVED` + `publishedAt` + تمدید انقضای ۳۰ روزه + audit |
| POST `/admin/ads/:id/reject` | `ads.moderate` | `{ reason }` الزامی (حداقل ۳ حرف) → `REJECTED` + audit |
| GET `/admin/businesses?status=PENDING` | `businesses.view` | صف کسب‌وکارها |
| POST `/admin/businesses/:id/approve` | `businesses.moderate` | تأیید + اختیاراً `latitude`/`longitude` (هر دو یا هیچ، با اعتبارسنجی دامنه) برای مارکر نقشه |
| POST `/admin/businesses/:id/reject` | `businesses.moderate` | `{ reason }` الزامی → `REJECTED` + audit |
| GET `/admin/subscriptions?status=PENDING_REVIEW` | `subscriptions.manage` | اشتراک‌های پرداخت‌شده در انتظار تأیید |
| POST `/admin/subscriptions/:id/approve` | `subscriptions.manage` | `ACTIVE` + `startsAt`/`expiresAt` + ارتقای tier کسب‌وکار (`showcasePriority` طلایی=۱۰، نقره‌ای=۵۰)؛ هرگز انقضای فعالِ فعلی را کوتاه‌تر نمی‌کند + audit |
| POST `/admin/subscriptions/:id/reject` | `subscriptions.manage` | `{ reason }` الزامی → `REJECTED` + `reviewNote` + audit |

### Admin UI

`/admin` (فقط اپراتورها — دیگران پیام «دسترسی ندارید» می‌بینند): تب‌های آگهی/کسب‌وکار/اشتراک با فیلتر وضعیت، شمارنده‌های بالای پنل، تأیید/رد با علت. ورودی پنل در هدر (badge 🛡️ فقط برای اپراتورها) و صفحه پروفایل.

### Legacy outline (بعضی هنوز Planned)

```
/admin/users, /admin/ads, /admin/businesses, /admin/provinces, /admin/cities,
/admin/categories, /admin/news, /admin/chat/reports, /admin/banners,
/admin/reports, /admin/dashboard, /admin/audit-logs
```

Guard: `PermissionsGuard` (کد permission از `role_permissions`) + Scope
(`CITY_ADMIN` فقط `city_id` خودش، `PROVINCE_ADMIN` فقط استان خودش).

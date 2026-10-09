# API v1 (`/api/v1`)

قالب پاسخ: `{ data, meta, error }`

## سیاست کش (Cache-Control) و محدودیت نرخ (Rate Limit)

**کش** — پاسخ‌های JSON شخصی/حساس هرگز کش نمی‌شوند (`Cache-Control: private, no-store`):

- وقتی درخواست کاربر واردشده باشد (حتی مسیرهای عمومی، چون `favorited`/مالکیت در پاسخ می‌آید): `/users/me`، `/payments/mine`، `/subscriptions/mine`، `/ads/mine`، `/ads/favorites`، `/auth/sessions`، `/wall` و…
- یا وقتی مسیر با `@NoStore()` علامت خورده باشد: همهٔ `/auth/*` (توکن‌ها) و `GET /ads/:id`.
- پاسخ‌های خطا همیشه `Cache-Control: no-store`.
- استثنا: فایل‌های آپلودی `/api/v1/files/*` برعکس `public, max-age=31536000, immutable` می‌گیرند.

**Rate Limit** — لایهٔ Redis (`RateLimitGuard`) جلوی endpointهای عمومی/قابل سوءاستفاده؛
سقف‌های قبلی OTP، checkout و سرویس‌ها (DB) دست‌نخورده‌اند:

| مسیر | کلید | سقف |
|---|---|---|
| POST `/auth/send-otp`، POST `/auth/verify-otp` | IP ساعتی + شماره ساعتی + cooldown ارسال (داخل سرویس auth) | همان سقف‌های قبلی |
| POST `/payments/checkout` | کاربر | ۱۰ در ساعت (داخل سرویس payments) |
| GET `/ads/:id` | کاربر یا IP (اگر واردشده باشد کاربر، وگرنه IP) | ۳۰۰ در دقیقه |
| POST `/uploads` و POST `/uploads/voice` | کاربر | ۳۰ تلاش در ساعت (پیش‌فیلتر پیش از خواندن بدنه؛ سقف ۳۰ آپلود موفق روی DB همچنان برقرار) |
| POST `/wall` | کاربر | ۱۰ در دقیقه (پیش‌فیلتر؛ سقف DB سرویس مرجع نهایی) |
| POST `/businesses` | کاربر | ۱۰ تلاش در ساعت |
| POST `/analytics/visit` | IP | ۱۲۰ در ساعت (بی‌صدا نادیده گرفته می‌شود) |

پاسخ ۴۲۹: `{ data: null, error: { code: 'RATE_LIMITED', details: { retryAfterSeconds } } }`.
GET `/wall` عمداً محدود نشده چون کلاینت هر ۵ ثانیه آن را poll می‌کند.


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
| POST `/uploads` | Bearer | multipart با فیلد `file` (JPG/PNG/WebP، حداکثر ۱۰MB، magic-byte sniff) → پردازش با **sharp**: WebP کیفیت ۸۲ (ضلع بزرگ ≤۱۶۰۰px، بدون Upscale، حذف EXIF/metadata) + Thumbnail ≤۴۰۰px → `{ id, url, thumbUrl, width, height }`؛ سقف ۳۰ آپلود در ساعت و سهمیهٔ ۱۰۰MB برای هر کاربر |
| POST `/ads` | Bearer | `{ categoryId, title(4..160), description(10..4000), price?, phone?, address?, imageIds?(≤5) }` → ایجاد آگهی با وضعیت `PENDING`، انقضا +۳۰ روز، سقف ۲۰ آگهی در ساعت؛ تصاویر متعلق به کاربر claim می‌شوند |
| GET `/ads/mine` | Bearer | آگهی‌های خودِ کاربر با وضعیت نظارت (شامل `rejectedReason`) |

فایل‌های آپلودی از مسیر `/api/v1/files/<storageKey>` (static در همان origin) سرو می‌شوند. فایل اصلی کاربر هرگز ذخیره نمی‌شود؛ هر تصویر دو نسخه دارد: نمایشی (≤۱۶۰۰px) و `*.thumb.webp` (≤۴۰۰px) که لیست‌ها/کارت‌ها از آن استفاده می‌کنند و صفحهٔ جزئیات نسخهٔ کامل را می‌باید. ذخیره‌سازی پشت interface `StorageDriver` است (`local` = Docker volume امروز، Arvan Object Storage فردا — فقط یک Driver جدید + `STORAGE_DRIVER` در `.env`) و فایل‌های حذف‌شده/یتیم طی Sweep پاک می‌شوند.

## Business Registration (ثبت کسب‌وکار)

> ✅ **پیاده‌شده**: فرم چندمرحله‌ای وب در `/businesses/new` (اطلاعات، دسته، تماس، تصاویر، پین نقشه).
> وضعیت همیشه `PENDING` است و فقط تأیید مدیر در پنل، کسب‌وکار را منتشر می‌کند؛ مجوز `businesses.create`
> روی endpoint اعمال می‌شود (نه فقط در UI) و نقش `USER` در seed این مجوز را دارد. سطح اشتراک
> (`subscriptionTier=FREE`) هنگام ثبت هرگز از ورودی کاربر پر نمی‌شود.

| Endpoint | Auth | Body / توضیح |
|---|---|---|
| GET `/business-categories` | @Public | دسته‌بندی‌های فعال برای فرم ثبت (ترتیب `sortOrder`) |
| POST `/businesses` | Bearer + `businesses.create` | `{ categoryId, name(3..160), description?, phone?, address?, latitude?, longitude?, logoMediaId?, coverMediaId?, socialLinks? }` — شهر از profile کاربر (نه body)؛ مختصات «هر دو یا هیچ» با بازه استاندارد؛ جلوگیری از تکرار: یک درخواست `PENDING` باز در همان شهر + نام فعال تکراری → `409 DUPLICATE_BUSINESS`؛ سقف ۱۰ تلاش در ساعت (Redis)؛ لوگو/کاور از `POST /uploads?entity=business` و claim در همان تراکنش (`slug = b-<id>`) → `{ id, name, status: 'PENDING' }` |
| GET `/businesses/mine` | Bearer | درخواست‌های خودِ کاربر با وضعیت نظارت (نمایش «در انتظار بررسی» در فرم) |

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

> ✅ **پیاده‌شده در Phase 4** (فیدهای عمومی داشبورد شهر — همه با `?city=<slug>&limit=1..50`، فقط شهر فعال؛ جدول پایین بخش Content را با وضعیت واقعی کد ببینید):
> `GET /news` فقط `PUBLISHED` · `GET /ads` فقط `APPROVED` و بدون انقضا (قیمت BigInt → عدد در JSON؛ دسته‌بندی با `icon`/`color` برای چیپ‌های ایموجی UI) · `GET /businesses` فقط `APPROVED` با ترتیب showcase (طلایی‌ها اول، بعد بالاترین امتیاز).

**پیاده‌شده (وضعیت فعلی کد):**

| Module | Endpoint |
|---|---|
| news | GET `/news?city=`, GET `/news/:slug` |
| ads | GET `/ads?city=&limit=` (فقط `APPROVED`)؛ عملیات دیگر در بخش‌های فاز ۵/۶: POST `/ads`, GET `/ads/:id`, POST `/ads/:id/favorite`, GET `/ads/mine` |
| businesses | GET `/businesses?city=&limit=` (فقط `APPROVED`)، GET `/businesses/:id`، GET `/businesses/mine`، POST `/businesses`، GET `/business-categories` (بخش «ثبت کسب‌وکار») |
| map | GET `/map?city=<slug>` — مرکز + boundary + پین کسب‌وکارهای دارای مختصات (جزئیات در فاز ۹) |
| uploads | POST `/uploads` (multipart — فاز ۵؛ پارامتر اختیاری `?entity=ad\|business` تعیین می‌کند کدام ردیف Media را می‌گیرد)؛ POST `/uploads/voice` برای ویس دیوار (فاز ۱۰) |

**برنامه‌ریزی‌شده (⬜ هنوز پیاده‌نشده — به‌عنوان پیاده‌شده محسوب نشود):**

| Module | Endpoint | فاز |
|---|---|---|
| categories | GET `/categories?scope=ad\|business&city=` (امروز فقط GET `/ad-categories` برای فرم آگهی وجود دارد) | ۱۱ |
| businesses | PATCH `/businesses/:id`, GET `/businesses/:slug`, GET `/businesses/:id/stats` (ایجاد با POST `/businesses` پیاده شد) | ۱۱ |
| chat | GET `/chat/:citySlug/rooms/:id/messages` + WebSocket — دیوار شهر فعلاً با HTTP polling کار می‌کند | ۱۳ |
| notifications | GET `/notifications`, PATCH `/notifications/:id/read`, POST `/notifications/devices` | ۱۳ |

## Admin (فاز ۸ — پنل مدیریت، RBAC + Scope استان/شهر)

> ✅ **پیاده‌شده در Phase 8**: صف‌های نظارت روی آگهی/کسب‌وکار/اشتراک + تأیید/رد با علت + لاگ ممیزی.
> هر route با `@RequirePermissions` محافظت است؛ `AdminService` کوئری‌ها را به شهر/استان اپراتور محدود می‌کند (SUPER_ADMIN بدون محدودیت).
> اپراتور از seed ساخته می‌شود (شماره فقط داده است، نه کد) و ورود همچنان نیازمند OTP پیامکی.

| Endpoint | Permission | توضیح |
|---|---|---|
| GET `/admin/overview` | `dashboard.view` | شمارنده‌های صف (در انتظار/تأییدشده) برای داشبورد پنل |
| GET `/admin/analytics/visits` | `dashboard.view` | آمار بازدید سایت: `daily` (امروز + ۳۰ روز اخیر)، `monthly` (ماه جاری + ۱۲ ماه)، `yearly` (سال جاری + ۳ سال) |
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

`/admin` (فقط اپراتورها — دیگران پیام «دسترسی ندارید» می‌بینند): تب‌های آگهی/کسب‌وکار/اشتراک با فیلتر وضعیت، شمارنده‌های بالای پنل، **آمار بازدید سایت (روزانه/ماهانه/سالانه + نمودار)**، تأیید/رد با علت. ورودی پنل در هدر (badge 🛡️ فقط برای اپراتورها) و صفحه پروفایل.

## Analytics (شمارش بازدید سایت)

| Endpoint | Auth | توضیح |
|---|---|---|
| POST `/analytics/visit` | @Public | Beacon که وب بعد از هر page view می‌فرستد؛ شمارنده در `site_visits` (یک ردیف به ازای هر روز شمسی/تقویم ایران) upsert می‌شود. محدودیت ۱۲۰ درخواست در ساعت به ازای هر IP (Redis) و فراتر از آن بی‌صدا نادیده گرفته می‌شود؛ خطا هرگز به کلاینت برنمی‌گردد. |

روز، واحد ذخیره‌سازی است؛ ماه/سال در لحظه خواندن از روی روزها جمع می‌شوند (بدون cron و بدون جدول اضافه).

### Legacy outline (بعضی هنوز Planned)

```
/admin/users, /admin/ads, /admin/businesses, /admin/provinces, /admin/cities,
/admin/categories, /admin/news, /admin/chat/reports, /admin/banners,
/admin/reports, /admin/dashboard, /admin/audit-logs
```

Guard: `PermissionsGuard` (کد permission از `role_permissions`) + Scope
(`CITY_ADMIN` فقط `city_id` خودش، `PROVINCE_ADMIN` فقط استان خودش).

## Showcase + City Map + Storage (فاز ۹ — ویترین طلایی، نقشه شهر، سهمیه ذخیره‌سازی)

> ✅ **پیاده‌شده در Phase 9**: ویترین متحرک بالای نقشه، نقشه محدوده شهر با پین کسب‌وکارهای تأییدشده، و سقف ذخیره‌سازی تصاویر + پاک‌سازی خودکار.

| Endpoint | Auth | توضیح |
|---|---|---|
| GET `/showcase?city=<slug>&limit=` | Public | کسب‌وکارهای `GOLD`/`SILVER` تأییدشده با `showcaseEnabled`، در ترتیب `showcasePriority` (طلایی‌ها اول) — تغذیه‌کننده پنل ویترین متحرک؛ شامل `logoUrl`/`category`/`rating`، بدون شماره تلفن |
| GET `/map?city=<slug>` | Public | مرکز شهر + `boundary` (GeoJSON Polygon یا null) + کسب‌وکارهای تأییدشده‌ای که مختصات دارند (`latitude`/`longitude` نام null نمی‌گیرند) — ترتیب showcase |
| POST `/admin/cities/:id/boundary` | `map.manage` | ذخیره/پاک‌کردن محدوده شهر `{ boundary: Polygon | null }` (اعتبارسنجی حلقه/دامنه/سقف ۵۰۰۰ نقطه، بستن حلقه باز، محدود به scope اپراتور) + audit `city.boundary` |
| GET `/admin/storage/overview` | `storage.manage` | مصرف کل تصاویر + سقف کاربر/فایل |
| POST `/admin/storage/sweep` | `storage.manage` | اجرای دستی پاک‌سازی: حذف فایل‌های soft-delete‌شده قدیمی، آپلودهای بدون آگهی (>۴۸ساعت)، مدیای آگهی حذفشده، و فایل‌های یتیم دیسک |

### قوانین سهمیه (فضای سرور پر نمی‌شود)

- هر فایل حداکثر ۵MB (multer + بررسی مجدد) · هر کاربر حداکثر ۳۰ آپلود در ساعت · **هر کاربر مجموعاً ۱۰۰MB** (`MAX_BYTES_PER_USER`) — با رسیدن به سقف، آپلود بعدی `413` می‌شود.
- سویپ خودکار هر ۶ ساعت (اولین اجرا ۱۰ دقینه پس از بوت، `unref` — برنامه را نگه نمی‌دارد): آپلودهای ادعاشده‌نشده >۴۸ساعت، مدیای نرم‌حذف‌شده >۷ روز، مدیای آگهی حذفشده، و فایل‌های دیسک بدون ردیف Media (با محافظ سنّ <۴۸ساعت برای آپلود در جریان).

### UI (ویترین + نقشه)

`/city/[slug]`: پنل «ویترین طلایی» بلافاصله **بالای نقشه** — marquee بی‌نهایت (RTL، `translateX(50%)`، تکرار لیست برای حلقه یکپارچه، توقف با hover/focus، احترام به `prefers-reduced-motion`) با تاج طلایی و CTA اشتراک. نقشه Leaflet + OSM (بدون کلید API): مرز GeoJSON از نوع `Polygon` یا `MultiPolygon` با قاب کامل شهر؛ اگر مرزی ثبت نشده باشد، قاب وسیع شهر از مرکز و پین‌ها ساخته می‌شود؛ پین‌های رنگی per-tier با popup لینک‌دار.

## City Wall (فاز ۸b + فاز ۱۰ — دیوار شهر / چت‌روم)

> ✅ **پیاده‌شده در Phase 8b + 10**: دیوار عمومی هر شهر مثل JamCity — پست متنی/عکسی/ویسی، لایک، پاسخ، ویرایش پیام، پین ناظر؛ هدر اتاق با اسم دیوار + تعداد اعضا؛ دکمهٔ «ثبت آگهی» سمت راست کامپوزر؛ به‌علاوه **بازنشر روزانهٔ آگهی‌ها**، فیلتر دسته‌بندی روی نقشه و ورود مستقیم کاربر به شهر خودش.

ثبت آگهی همچنان وضعیت `PENDING` و بررسی ناظر را حفظ می‌کند؛ همان transaction یک پست آگهی در دیوار شهر می‌سازد تا پیش‌نمایش فوراً دیده شود. کارت تا زمان تأیید برچسب «در انتظار تأیید» دارد و لینک جزئیات فقط پس از تأیید فعال می‌شود؛ آگهی ردشده از فید عمومی کنار گذاشته می‌شود.

| Endpoint | Auth | توضیح |
|---|---|---|
| GET `/wall?city=<slug>&limit=&before=` | Login | فید جدیدترین پست‌های شهر + پست پین‌شده جدا؛ شامل `likedByMe`، `canDelete`/`canEdit`/`canPin`، کرسر `nextBefore` و **متای اتاق `room { name, memberCount, messageCount }`** (فاز ۱۰) |
| POST `/wall` | Login | پست جدید `{ cityId, content?, replyToId?, imageIds?, voiceMediaId? }` — حداکثر ۱۰ پست در دقیقه (`429`)، پاسخ فقط به پستِ همان شهر، ادعای ۱ تصویر + ۱ ویس (`entityType → WALL`) با rollback کامل در صورت شکست؛ پیام فقط-ویس با `content` خالی مجاز است |
| PATCH `/wall/:id` | Login | ویرایش متن پیامِ خود کاربر (فقط نویسنده، غیر از آن `403`) — `editedAt` ست می‌شود و UI «ویرایش شد» نشان می‌دهد |
| POST `/wall/:id/like` | Login | toggle لایک در transaction — برمی‌گرداند `{ liked, likeCount }` |
| DELETE `/wall/:id` | Login | فقط نویسنده یا اپراتور با scope (`403` در غیر این صورت) — فایل‌های پست همان لحظه از Storage پاک می‌شوند |
| POST `/wall/:id/pin` | `chat.moderate` | پین/آнопین — قبلش بقیه پست‌های پین‌شده شهر آزاد می‌شوند |
| POST `/uploads/voice` | Bearer | multipart (فیلد `file`) — ویس حداکثر **۵MB**، sniff با magic-byte (WebM/OGG/M4A/MP3/WAV ردِ SVG/HTML/تصویر)، کلید تصادفی `voice/YYYY/MM/<rand>.<ext>`، **بدون re-encode** → `{ id, url }`؛ ردیف `WALL` بدون `entityId` تا ادعای پست |

### بازنشر روزانهٔ آگهی‌ها (فاز ۱۰)

`WallRepostScheduler` داخل خود API (تیک هر ۶۰ ثانیه، ساعت تهران UTC+3:30 بدون DST) — هر اسلات **حداکثر یک بار در هر روز شمسی** اجرا می‌شود (ری‌استارت همان روز باعث ارسال دوباره نمی‌شود):

- **۰۸:۰۰ صبح**: ۱ آگهی GOLD (مالک با اشتراک طلایی فعال) + ۳ آگهی قدیمی
- **۱۲:۰۰ ظهر**: ۲ آگهی قدیمی
- **۱۸:۰۰ عصر**: ۱ آگهی GOLD + ۳ آگهی قدیمی
- **۲۲:۰۰ شب**: ۲ آگهی قدیمی

⇒ روزی **۲ تبلیغ طلایی (صبح + عصر)** و **۱۰ آگهی قدیمی** (حداقل ۲ در هر بازه)، انتخاب **تصادفی** از آگهی‌های `APPROVED` و منقضی‌نشدهٔ ≥۷ روز، **بدون تکرار در همان روز** (هر آگهیِ استفاده‌شده از `wall_posts.ad_id` همان روز کنار گذاشته می‌شود). هر پیام به دیوارِ همان شهر با `imageUrl` آگهی + کارت لینک‌دار `/ad/:id` می‌افتد؛ اگر صاحب طلایی‌ای نبود، اسلات GOLD به آگهی قدیمی fallback می‌کند.

### UI دیوار (چت‌روم)

`/wall` (با resolution شهر از localCity → profile → انتخاب‌گر): **هدر چسبان اتاق** (اسم دیوار + تعداد اعضا و پیام‌ها + دکمه‌های شهر/تغییر شهر)، بنر پین‌شده، فید **کرونولوژیکال** (جدیدترین پایین، اسکرول خودکار) با حباب‌ها (آواتار، `timeAgo`، «ویرایش شد»، نقل‌قول پاسخ، عکس thumbnail، پلیر ویس، کارت آگهی)، لایک optimistic، پاسخ/ویرایش/حذف/پین روی هر پیام؛ کامپوزر پایین با **دکمهٔ «ثبت آگهی» سمت راست** (جابه‌جایی از هدر و ناوبری پایین)، پیوست عکس، **ضبط ویس** (`MediaRecorder` با تایمر و انصراف) و ارسال با Enter؛ بارگذاری قدیمی با کرسور، پولینگ ۵ ثانیه‌ای، و درِ ورود `401 → /login?next=/wall`. دکمه قرمز ضربان‌دار «ورود به دیوار شهر» بالای صفحهٔ اصلی شهر، بالای ویترین طلایی.

### نقشه: فیلتر دسته‌بندی + ورود به شهر

- دکمه ✨ **بالای گوشه نقشه** (سمت چپ RTL) → منوی `role=listbox` با دسته‌بندی‌های موجود در پین‌ها؛ انتخاب، فقط پین‌های همان دسته را نگه می‌دارد و نما را refit می‌کند (تک‌پین `setView(...,17)`، چندپین `fitBounds maxZoom 16`). payload نقشه شامل `category.slug` است.
- ورود: بعد از `verify-otp` بدون پارامتر `next`، کاربر از `/users/me` + `/cities` شهر خودش را می‌گیرد، در `localCity` ذخیره می‌کند و مستقیم به `/city/<slug>` می‌رود.

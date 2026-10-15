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
| POST `/uploads/business` | Bearer | همان قواعد `/uploads` اما با **پروفایل فشرده‌سازی کسب‌وکار**: WebP کیفیت **۷۲** و ضلع بزرگ **≤۱۰۰۰px** + thumbnail **≤۳۲۰px** (`BUSINESS_PROFILE`) و `entityType = BUSINESS` — عکس لوگو/منو/محصول مالک‌ها؛ همین که به کسب‌وکار وصل شود claim می‌شود، و اگر ثبت نیمه‌کاره بماند sweep آن را پاک می‌کند |
| POST `/uploads` | Bearer | multipart با فیلد `file` (JPG/PNG/WebP، حداکثر ۱۰MB، magic-byte sniff) → پردازش با **sharp**: WebP کیفیت ۸۲ (ضلع بزرگ ≤۱۶۰۰px، بدون Upscale، حذف EXIF/metadata) + Thumbnail ≤۴۰۰px → `{ id, url, thumbUrl, width, height }`؛ سقف ۳۰ آپلود در ساعت و سهمیهٔ ۱۰۰MB برای هر کاربر  **سیاست نگه‌داشت:** عکس آگهی/پیام دیوار ۴ روز روی سایت می‌ماند (`POST_IMAGE_MAX_AGE_MS`)؛ سپس در sweep بعدی (هر ۶ ساعت) فایل + ردیف Media حذف و ارجاعش خالی می‌شود (AdImage مربوطه پاک، `wallPost.imageUrl` تهی) و **متن آگهی/پیام دست‌نخورده می‌ماند** |
| POST `/ads` | Bearer | `{ categoryId, title(4..160), description(10..4000), price?, phone?, address?, imageIds?(≤5) }` → ایجاد آگهی با وضعیت `PENDING`، انقضا +۳۰ روز، سقف ۲۰ آگهی در ساعت؛ تصاویر متعلق به کاربر claim می‌شوند |
| GET `/ads/mine` | Bearer | آگهی‌های خودِ کاربر با وضعیت نظارت (شامل `rejectedReason`) |
| DELETE `/ads/:id` | Bearer | **حذف آگهی از دیوار و همهٔ صفحات** — فقط مالک یا ناظر (`403` برای دیگران)؛ `DELETED` + پاک‌سازی گالری از دیسک (`purgeEntity('AD', id)`) → `{ id, status, removedFiles }`؛ کارت‌های دیوار چون فقط آگهی PENDING/APPROVED را رندر می‌کنند همان لحظه می‌روند |

فایل‌های آپلودی از مسیر `/api/v1/files/<storageKey>` (static در همان origin) سرو می‌شوند. فایل اصلی کاربر هرگز ذخیره نمی‌شود؛ هر تصویر دو نسخه دارد: نمایشی (≤۱۶۰۰px) و `*.thumb.webp` (≤۴۰۰px) که لیست‌ها/کارت‌ها از آن استفاده می‌کنند و صفحهٔ جزئیات نسخهٔ کامل را می‌باید. ذخیره‌سازی پشت interface `StorageDriver` است (`local` = Docker volume امروز، Arvan Object Storage فردا — فقط یک Driver جدید + `STORAGE_DRIVER` در `.env`) و فایل‌های حذف‌شده/یتیم طی Sweep پاک می‌شوند.

## Detail pages / Profile / Favorites (فاز ۶ — جزئیات و پروفایل)

> ✅ **پیاده‌شده در Phase 6**: صفحات جزئیات آگهی/خبر/کسب‌وکار + پروفایل کاربر + علاقه‌مندی‌ها.
> گارد روی مسیرهای `@Public` در صورت داشتن توکن معتبر، کاربر را به درخواست ضمیمه می‌کند (شناسایی اختیاری).

| Endpoint | Auth | توضیح |
|---|---|---|
| GET `/ads/:id` | @Public (+اختیاری توکن) | جزئیات کامل آگهی؛ فقط `APPROVED` و بدون انقضا برای عموم؛ مالک هر وضعیتی (PENDING/REJECTED) را می‌بیند + `rejectedReason` فقط برای مالک؛ بازدید فقط برای غیرمالک +۱؛ `favorited` برای کاربرِ واردشده |
| POST `/ads/:id/favorite` | Bearer | toggle علاقه‌مندی → `{ favorited }` |
| GET `/ads/favorites` | Bearer | لیست آگهی‌های ذخیره‌شده (همان شکل `GET /ads/mine`) |
| GET `/news/:slug` | @Public | جزئیات خبر منتشرشده + شمارش بازدید؛ 404 برای غیرمنتشرشده |
| GET `/businesses/:id` | @Public | پروفایل کامل کسب‌وکار (توضیحات، ساعات کاری، شبکه‌های اجتماعی) + **`products[]` = منو و محصولات** (اسم، توضیح، عکس، `section`، قیمت ریالی یا `null` = توافقی، `isAvailable`) + شمارش بازدید؛ فقط `APPROVED`. ورود از پین نقشه/ویترین هم همین را نشان می‌دهد |
| GET/PATCH `/users/me` | Bearer | اطلاعات پروفایل (نام نمایشی قابل ویرایش) — پیش‌تر پیاده‌شده |

## Subscriptions / Sepal (فاز ۷ — اشتراک و پرداخت)

> ✅ **پیاده‌شده در Phase 7**: انتخاب پلن → **درگاه سپال (Sepal)** → بازگشت callback → verify سمت سرور → ایجاد اشتراک.
> زرین‌پال به‌عنوان fallback می‌ماند: اگر `SEPAL_API_KEY` خالی باشد، checkout از ZarinPal استفاده می‌کند و درجِ `provider` روی ردیف پرداخت (SEPAL/ZARINPAL) تعیین می‌کند callback با کدام گیت‌وی verify شود.
> مبلغ verify همیشه از ردیف پرداختِ ذخیره‌شده خوانده می‌شود (هرگز از query/کلاینت)؛ callback با `@Public` است و با 302 به `/plans/result` در وب برمی‌گردد.

| Endpoint | Auth | Body / توضیح |
|---|---|---|
| GET `/subscription-plans` | @Public | پلن‌های فعال (`GOLD`/`SILVER`، قیمت BigInt → عدد) برای صفحه /plans |
| POST `/payments/checkout` | Bearer | `{ planId, businessId? }` → ایجاد پرداخت `CREATED` (+ `provider`)، دریافت pay URL از سپال (`invoiceNumber` = شناسه پرداخت)، وضعیت `STARTED` → `{ paymentId, payUrl, authority, amount }`؛ سقف ۱۰ checkout در ساعت؛ `businessId` فقط اگر متعلق به خود کاربر باشد |
| GET `/payments/callback?Authority=&Status=` یا `?paymentNumber=&status=` | @Public | بازگشت درگاه (هر دو سبک: زرین‌پال `Authority/Status=OK`، سپال `paymentNumber/status=1` با `callbackMethod=get`) → نرمال‌سازی به یک قرارداد و verify سمت سرور با همان providerِ ثبت‌شده (کد 100/101 = موفق)؛ تراکنش موفق در یک تراکنش DB به `SUCCESS` + ایجاد `Subscription` می‌شود (تکرارِ callback → `ALREADY_PAID` بدون اشتراک دوم)؛ وگرنه `CANCELED`/`FAILED`؛ سپس 302 به `WEB_URL/plans/result?status=...` |
| GET `/payments/mine` | Bearer | تاریخچه پرداخت‌های کاربر (مبلغ عددی، برچسب پلن) |
| GET `/subscriptions/mine` | Bearer | اشتراک‌های کاربر + وضعیت (`ACTIVE`؛ ردیف‌های قدیمی `PENDING_REVIEW`) و نام کسب‌وکار |

قانون اشتراک: هر پرداختِ تأییدشده (شخصی یا کسب‌وکاری) بلافاصله `ACTIVE` می‌شود و تراکنشِ verify همان لحظه تیِر کسب‌وکار را اعمال و ثبت‌نامِ `PENDING` را تأیید می‌کند — بدون تأیید مدیر. کسب‌وکارِ `CLOSED` (تعلیق‌شده — دستی توسط مدیر یا با پایان مهلت اشتراک) با همین پرداخت به `APPROVED` برمی‌گردد و مدتِ خریداری‌شده به باقی‌ماندهٔ دورهٔ قبلی اضافه می‌شود. ردِ صریح مدیر (`REJECTED`) هرگز با پرداخت جدید بازنویسی نمی‌شود؛ `PENDING_REVIEW` فقط برای ردیف‌های قدیمی می‌ماند. کلیدها فقط در env (`SEPAL_*` و `ZARINPAL_*`) — هرگز در کد یا سمت کلاینت.

## Content (همه City-scoped)

> ✅ **پیاده‌شده در Phase 4** (فیدهای عمومی داشبورد شهر — همه با `?city=<slug>&limit=1..50`، فقط شهر فعال):
> `GET /news` فقط `PUBLISHED` **و حداکثر ۷ روز اخیر** (پنجرهٔ `NEWS_MAX_AGE_MS`: `publishedAt`، و اگر خالی بود `createdAt`؛ خبر قدیمی‌تر از هفته از فید جا می‌ماند و `GET /news/:slug` آن را **۴۰۴** می‌کند) · `GET /ads` فقط `APPROVED` و بدون انقضا (قیمت BigInt → عدد در JSON؛ دسته‌بندی با `icon`/`color` برای چیپ‌های ایموجی UI) · `GET /businesses` فقط `APPROVED` با ترتیب showcase (طلایی‌ها اول، بعد بالاترین امتیاز).
> پاک‌سازی: sweep هر ۶ ساعت **کاور خبرهای خارج از پنجرهٔ هفتگی** را از دیسک آزاد می‌کند (اول `coverUrl` ردیف News تهی می‌شود، بعد فایل + ردیف Media — URLهای seed/خارجی بدون ردیف Media دست نمی‌خورند).

| Module | Endpoint |
|---|---|
| categories | GET `/categories?scope=ad\|business&city=` |
| ads | GET/POST `/ads`, GET/PATCH/DELETE `/ads/:id`, POST `/ads/:id/submit`, POST `/ads/:id/favorite` |
| businesses | GET/POST `/businesses`, GET `/businesses/:slug`, PATCH `/businesses/:id`, GET `/businesses/:id/stats` |
| map | GET `/map/:citySlug?bbox=&kind=` — مارکرهای نقشه (کسب‌وکار + آگهی + مکان‌ها) |
| news | GET `/news?city=`, GET `/news/:slug` |
| chat | GET `/chat/:citySlug/rooms/:id/messages` + WebSocket برای Real-Time |
| uploads | POST `/uploads` (multipart) — Storage abstraction؛ POST `/uploads/voice` برای ویس دیوار (فاز ۱۰) |
| notifications | GET `/notifications`, PATCH `/notifications/:id/read`, POST `/notifications/devices` |

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
| POST `/admin/businesses` | `businesses.moderate` | **ثبت دستی کسب‌وکار توسط مدیر**: `{ cityId, categoryId, name, description?, phone?, address?, ownerPhone?, latitude?, longitude?, tier?, months?, logoUrl? }` → انتشار فوری (`APPROVED`، بدون صف و بدون پرداخت)؛ شهر و پین باید داخل محدودهٔ همان شهر باشند؛ `tier=GOLD/SILVER` + `months` (۱–۶۰) اشتراک را همان لحظه فعال می‌کند (پایانش را sweep ساعتی تعلیق می‌کند)؛ `logoUrl` باید آپلود خودِ مدیر باشد؛ مالک با `ownerPhone` (کاربر موجود) یا خودِ مدیر؛ + audit |
| POST `/admin/businesses/:id/approve` | `businesses.moderate` | تأیید + اختیاراً `latitude`/`longitude` (هر دو یا هیچ، با اعتبارسنجی دامنه) برای مارکر نقشه |
| POST `/admin/businesses/:id/reject` | `businesses.moderate` | `{ reason }` الزامی → `REJECTED` + audit |
| POST `/admin/businesses/:id/suspend` | `businesses.moderate` | `{ reason }` الزامی (حداقل ۳ حرف) → **تعلیق**: `CLOSED` — کسب‌وکار همان لحظه از فهرست/نقشه/ویترین/جزئیات خارج می‌شود (همهٔ کوئری‌های عمومی `APPROVED` فیلتر می‌کنند) اما در «کسب‌وکارهای من» صاحبش می‌ماند و با خرید اشتراک خودبه‌خود فعال می‌شود؛ برگشت‌پذیر با تأیید دوباره هم هست + audit |
| POST `/admin/businesses/:id/delete` | `businesses.moderate` | **حذف**: `DELETED` + صفرشدن `logoUrl`/`coverUrl` + پاک‌سازی فوری عکس‌های claim‌شدهٔ همان کسب‌وکار از دیسک (`purgeEntity('BUSINESS', id)`)؛ ردیف برای audit می‌ماند + audit با `removedFiles` |
| GET `/admin/subscriptions?status=PENDING_REVIEW` | `subscriptions.manage` | صف اشتراک‌های قدیمیِ در انتظار تأیید (پرداخت‌های جدید خودکار فعال می‌شوند) |
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
| POST `/admin/storage/sweep` | `storage.manage` | اجرای دستی پاک‌سازی: حذف فایل‌های soft-delete‌شده قدیمی، **انقضای عکس‌های آگهی/دیوار قدیمی‌تر از ۴ روز**، آپلودهای بدون آگهی (>۴۸ساعت)، مدیای آگهی حذفشده، و فایل‌های یتیم دیسک |

### قوانین سهمیه (فضای سرور پر نمی‌شود)

- هر فایل حداکثر ۵MB (multer + بررسی مجدد) · هر کاربر حداکثر ۳۰ آپلود در ساعت · **هر کاربر مجموعاً ۱۰۰MB** (`MAX_BYTES_PER_USER`) — با رسیدن به سقف، آپلود بعدی `413` می‌شود.
- سویپ خودکار هر ۶ ساعت (اولین اجرا ۱۰ دقینه پس از بوت، `unref` — برنامه را نگه نمی‌دارد): آپلودهای ادعاشده‌نشده >۴۸ساعت، مدیای نرم‌حذف‌شده >۷ روز، مدیای آگهی حذفشده، و فایل‌های دیسک بدون ردیف Media (با محافظ سنّ <۴۸ساعت برای آپلود در جریان).

### UI (ویترین + نقشه)

`/city/[slug]`: پنل «ویترین طلایی» بلافاصله **بالای نقشه** — marquee بی‌نهایت (RTL، `translateX(50%)`، تکرار لیست برای حلقه یکپارچه، توقف با hover/focus، احترام به `prefers-reduced-motion`) با تاج طلایی و CTA اشتراک. نقشه Leaflet + OSM (بدون کلید API): مرز GeoJSON از نوع `Polygon` یا `MultiPolygon` با قاب کامل شهر؛ اگر مرزی ثبت نشده باشد، قاب وسیع شهر از مرکز و پین‌ها ساخته می‌شود؛ پین‌های رنگی per-tier با popup لینک‌دار.

## City Wall (فاز ۸b + فاز ۱۰ — دیوار شهر / چت‌روم)

> ✅ **پیاده‌شده در Phase 8b + 10**: دیوار عمومی هر شهر مثل JamCity — پست متنی/عکسی/ویسی، لایک، پاسخ، ویرایش پیام، پین ناظر؛ هدر اتاق با اسم دیوار + تعداد اعضا؛ **کامپوزر به سبک واتساپ با آیکون 📝 ثبت آگهی کنار آن**؛ به‌علاوه **بازنشر روزانهٔ آگهی‌ها**، فیلتر دسته‌بندی روی نقشه و ورود مستقیم کاربر به شهر خودش.

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

### پیام تبلیغاتی کسب‌وکارهای طلایی (روزی ۲ — صبح + عصر)

اسلاتهای **۰۸:۰۰** و **۱۸:۰۰** علاوه بر آگهی طلایی، هر کدام **یک پیام تبلیغاتی جذاب** هم از یک کسب‌وکار طلایی می‌فرستند (`wall_posts.business_id` — migration `20261013000000_wall_business_promo`):

- **کاندیدا**: کسب‌وکار `APPROVED` با اشتراک `GOLD` فعال (انقضا گذشته = رد) و showcaseEnabled؛ انتخاب ** Fisher–Yates تصادفی**.
- **بدون تکرار**: هرگز دو بار در یک روز شمسی (صبح و عصر کسب‌وکارهای متفاوت)؛ و تا ۷ روز اخیر ترجیحاً تکرار نمی‌شود (اگر کل استخر همین اندازه بود، fallback به کل استخر).
- **متن**: سلام روز/عصر + اسم کسب‌وکار، دسته‌بندی با ایکون، آدرس، و توضیحات خودِ مالک در یک خط (بدون ادعای اختراعی).
- پست روی **دیوار همان شهر** با نویسنده = مالک کسب‌وکار ثبت می‌شود؛ کارت UI (`wall-promocard`) عکس واقعی/آیکون دسته + «👑 طلایی» و لینک `/business/:id` دارد. با حذف/تعلیق کسب‌وکار، FK روی `SET NULL` است و کارت به پست عادی تبدیل می‌شود (عکس live خوانده می‌شود تا هرگز broken نماند).

### UI دیوار (چت‌روم)

`/wall` (با resolution شهر از localCity → profile → انتخاب‌گر): **هدر چسبان اتاق** (اسم دیوار + تعداد اعضا و پیام‌ها + آیکون 🏠 بازگشت به صفحهٔ همان شهر)، بنر پین‌شده، فید **کرونولوژیکال** (جدیدترین پایین، اسکرول خودکار) با حباب‌ها (آواتار، `timeAgo`، «ویرایش شد»، نقل‌قول پاسخ، عکس thumbnail، پلیر ویس، کارت آگهی)، لایک optimistic، پاسخ/ویرایش/حذف/پین روی هر پیام + **🗑 «آگهی»** روی کارت آگهی برای مالک/ناظر (خودِ آگهی را از کل سایت پاک می‌کند، نه فقط این بازنشر)؛ کامپوزر پایین حالا **یک نوار به سبک واتساپ** است — پیوست عکس 🖼 · ورودی متن (خودکار رشد می‌کند) · میکروفن 🎤 · دکمهٔ گرد ارسال ➤ — و تنها اکشن اضافهٔ اتاق، آیکون **📝 ثبت آگهی** با یک جداکننده کنار همان نوار است (جابه‌جایی از هدر و ناوبری پایین)، **ضبط ویس** (`MediaRecorder` با تایمر و انصراف) و ارسال با Enter؛ بارگذاری قدیمی با کرسور، پولینگ ۵ ثانیه‌ای، و درِ ورود `401 → /login?next=/wall`. دکمه قرمز ضربان‌دار «ورود به دیوار شهر» بالای صفحهٔ اصلی شهر، بالای ویترین طلایی.

### پیل هدر: اخبار شهر

آیکون 📰 در پیل هدر، برچسب **«اخبار شهر»** کنار خود دارد (در همهٔ عرضها — حتی موبایل، برخلاف بقیهٔ پیل‌ها که فقط آیکون می‌شوند) و به صفحهٔ اخبار همان شهر می‌رود؛ صفحه فقط **خبرهای یک هفتهٔ اخیر همان شهر** را نشان می‌دهد و متن حالت خالی هم این پنجره را توضیح می‌دهد.

## کسب‌وکارهای من + منو و محصولات (فاز ۱۱b)

> ✅ **پیاده‌شده در Phase 11b**: مالک کسب‌وکار می‌تواند **عکس کسب‌وکار** را هم انتخاب کند (در سه‌مرحلهٔ ثبت و در پنل مدیریت)، مشخصات عمومی‌اش را ویرایش کند و برای کسب‌وکار **منو** بسازد — هر ردیف با عکس، مشخصات و قیمت. همه‌چیز در `GET /businesses/:id` (صفحهٔ عمومی و ورودی از پین نقشه/ویترین) دیده می‌شود؛ عکس واقعی، در **ویترین طلایی** و **پین نقشه** جای آیکون دسته‌بندی را می‌گیرد. عکس‌ها با `POST /uploads/business` فشرده ذخیره می‌شوند (WebP q۷۲، ≤۱۰۰۰px + thumb ≤۳۲۰px) و ۴ روزه expire **نمی‌شوند** (سیاست ۴ روزه فقط برای عکس آگهی/دیوار است) — فقط با پاک‌کردن یا حذف محصول آزاد می‌شوند.

عکس کسب‌وکار و محصولات فقط از **آپلودهای خودِ کاربر** پذیرفته می‌شود: مسیر باید `/api/v1/files/...` باشد و ردیف Media متعلق به همان کاربر وجود داشته باشد (هیچ URL خارجی/hot-link قبول نمی‌شود)؛ سپس همان ردیف Media به کسب‌وکار **claim** می‌شود (`entityType: BUSINESS`) تا sweep یتیم آن را پاک نکند. با پاک‌کردن عکس (ارسال رشتهٔ خالی)، اگر هیچ محصول/لوگوی دیگری از همان فایل استفاده نکند، ردیف Media نرم‌حذف می‌شود تا sweep بایت‌هایش را آزاد کند.

مسیرهای مالک زیر `/my-businesses` هستند (نه `/businesses/mine`) تا با `GET /businesses/:id` عمومی قاطی نشوند و `ParseIntPipe` آن‌ها را ۴۰۰ نکند — همان تلهٔ مسیریابی `GET /ads/favorites` در فاز ۶. هر کوئری با `ownerId` خودِ توکن محدود می‌شود؛ کسب‌وکار دیگری **۴۰۴** می‌دهد، نه ۴۰۳ (بدون لو دادن وجود رکورد).

| Endpoint | Auth | توضیح |
|---|---|---|
| GET `/business-categories` | @Public | دسته‌بندی‌های فعال برای فرم ثبت کسب‌وکار (ترتیب `sortOrder`) |
| POST `/businesses` | Bearer | ثبت کسب‌وکار جدید — `{ name, categoryId, description?, phone?, address?, logoUrl?, latitude?, longitude? }` → وضعیت `PENDING` + `FREE`؛ شهر از پروفایل کاربر و پین باید داخل محدودهٔ همان شهر باشد (سقف ۵ ثبت در روز) |
| GET `/my-businesses` | Bearer | کسب‌وکارهای خودِ کاربر (حذف‌شده‌ها `DELETED` دیگر نمی‌آیند؛ تعلیق‌شده‌ها `CLOSED` می‌مانند): `status`, `subscriptionTier`, `subscriptionStatus`, `subscriptionExpiresAt`, `productCount`, `pinned` (آیا روی نقشه هست) |
| GET `/my-businesses/:id` | Bearer | همان ردیف + `description`/`phone`/`address`/`latitude`/`longitude`/`categoryId` + `products[]` کامل منو |
| PATCH `/my-businesses/:id` | Bearer | ویرایش `name`, `categoryId`, `description`, `phone`, `address`, **`logoUrl`** — رشتهٔ خالی = پاک‌کردن مقدار (NULL)؛ وضعیت/اشتراک/شهر در اختیار پلتفرم می‌ماند (ویرایش، تأیید را باطل نمی‌کند) |
| POST `/my-businesses/:id/products` | Bearer | `{ name, section?, description?, price?, imageUrl?, sortOrder?, isAvailable? }` — `section` = دستهٔ منو («نوشیدنی»، «غذاهای اصلی»)، `price` ریال و خالی = «توافقی» (NULL)، `imageUrl` از `POST /uploads/business` (باید آپلود خودِ کاربر باشد) |
| PATCH `/my-businesses/:id/products/:productId` | Bearer | ویرایش جزئی همان ردیف (فقط محصولی که متعلق به همین کسب‌وکار است) |
| DELETE `/my-businesses/:id/products/:productId` | Bearer | حذف ردیف محصول |

پیاده‌سازی UI: `/businesses` (**کسب‌وکارهای من** — آیکون 🏬 در ناوبری پایین، جای آیکون اخبار که به پیل هدر منتقل شد) و `/business/:id/manage` (تبِ «مشخصات» با انتخاب عکس کسب‌وکار + تبِ «منو و محصولات» با افزودن/ویرایش/حذف و آپلود عکس محصول). صفحهٔ جزئیات کسب‌وکار، منو را **گروه‌بندی‌شده بر اساس `section`** با عکس thumbnail، توضیح، قیمت و برچسب «ناموجود» نشان می‌دهد.

### نقشه و ویترین (فاز ۱۱b)

- فیلتر دسته‌بندی بین‌کسب‌وکارها از یک **نوار تمام‌عرض بالای نقشه** به یک دکمهٔ شیشه‌ای **چسبیده به گوشهٔ بالای خود نقشه** تبدیل شد (`.map-catbar` داخل `.city-map__frame` با `position: absolute`)؛ روی موبایل فقط آیکونش دیده می‌شود تا نقشه پوشیده نشود. بنابراین فضای بالای نقشه آزاد و نقشه در صفحهٔ شهر **بالاتر از ویترین طلایی** آمده است.
- `GET /map?city=<slug>` حالا `logoUrl` هر کسب‌وکار را هم می‌فرستد؛ اگر مالک عکس واقعی گذاشته باشد، **پین نقشه همان عکس** را نشان می‌دهد و در غیر این صورت آیکون دسته‌بندی.

### نقشه: فیلتر دسته‌بندی + ورود به شهر

- دکمه ✨ **بالای گوشه نقشه** (سمت چپ RTL) → منوی `role=listbox` با دسته‌بندی‌های موجود در پین‌ها؛ انتخاب، فقط پین‌های همان دسته را نگه می‌دارد و نما را refit می‌کند (تک‌پین `setView(...,17)`، چندپین `fitBounds maxZoom 16`). payload نقشه شامل `category.slug` است.
- ورود: بعد از `verify-otp` بدون پارامتر `next`، کاربر از `/users/me` + `/cities` شهر خودش را می‌گیرد، در `localCity` ذخیره می‌کند و مستقیم به `/city/<slug>` می‌رود.

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
| POST `/uploads` | Bearer | multipart با فیلد `file` (JPG/PNG/WebP، حداکثر ۱۰MB، magic-byte sniff) → پردازش با **sharp**: WebP کیفیت ۸۲ (ضلع بزرگ ≤۱۶۰۰px، بدون Upscale، حذف EXIF/metadata) + Thumbnail ≤۴۰۰px → `{ id, url, thumbUrl, width, height }`؛ سقف ۳۰ آپلود در ساعت و سهمیهٔ ۱۰۰MB برای هر کاربر |
| POST `/ads` | Bearer | `{ categoryId, title(4..160), description(10..4000), price?, phone?, address?, imageIds?(≤5) }` → ایجاد آگهی با وضعیت `PENDING`، انقضا +۳۰ روز، سقف ۲۰ آگهی در ساعت؛ تصاویر متعلق به کاربر claim می‌شوند |
| GET `/ads/mine` | Bearer | آگهی‌های خودِ کاربر با وضعیت نظارت (شامل `rejectedReason`) |

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
| businesses | GET `/businesses?city=<slug>&limit=`, GET `/businesses/:id`, POST `/businesses` |
| business categories | GET `/business-categories` — دسته‌بندی‌های فعال برای فرم ثبت |
| map | GET `/map?city=<slug>` — مرز شهر + کسب‌وکارهای تأییدشدهٔ دارای مختصات |
| news | GET `/news?city=`, GET `/news/:slug` |
| chat | GET `/chat/:citySlug/rooms/:id/messages` + WebSocket برای Real-Time |
| uploads | POST `/uploads` (multipart) — Storage abstraction؛ POST `/uploads/voice` برای ویس دیوار (فاز ۱۰) |
| notifications | GET `/notifications`, PATCH `/notifications/:id/read`, POST `/notifications/devices` |

### ثبت کسب‌وکار و خرید اشتراک

`GET /business-categories` عمومی است و فقط دسته‌بندی‌های فعال را برمی‌گرداند. `POST /businesses` به Bearer token نیاز دارد و ورودی آن `{ categoryId, name, description?, phone?, address?, latitude, longitude }` است؛ شهر و مالک از پروفایل احراز‌شده گرفته می‌شوند، نه از بدنهٔ کاربر. کسب‌وکار جدید با وضعیت `PENDING` ساخته می‌شود و محدودیت ثبت روزانه دارد. فرم `/business/register` محل را روی نقشه می‌گیرد، فقط پلن‌های نقره‌ای/طلایی را ارائه می‌کند و سپس `POST /payments/checkout` را با `businessId` صدا می‌زند تا کاربر به زرین‌پال منتقل شود. پرداخت تأییدشده به‌تنهایی کسب‌وکار را عمومی نمی‌کند؛ انتشار نیازمند تأیید مدیر است.

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

`/city/[slug]`: نقشهٔ شهر در بالای ویترین قرار می‌گیرد تا زودتر دیده شود و عنوان تکراریِ نقشه حذف شده است. نقشه Leaflet + OSM (بدون کلید API): مرز GeoJSON از نوع `Polygon` یا `MultiPolygon` با قاب کامل شهر؛ اگر مرزی ثبت نشده باشد، قاب شهر از مرکز و پین‌ها ساخته می‌شود؛ پین‌های رنگی per-tier با popup لینک‌دار. پنل «ویترین طلایی» زیر نقشه marquee بی‌نهایت RTL با توقف hover/focus و احترام به `prefers-reduced-motion` است.

## City Wall (فاز ۸b + فاز ۱۰ — دیوار شهر / چت‌روم)

> ✅ **پیاده‌شده در Phase 8b + 10**: دیوار عمومی هر شهر مثل JamCity — پست متنی/عکسی/ویسی، لایک، پاسخ، ویرایش پیام، پین ناظر؛ هدر اتاق با اسم دیوار + تعداد اعضا؛ دکمهٔ «ثبت آگهی» سمت راست کامپوزر؛ به‌علاوه **بازنشر روزانهٔ آگهی‌ها**، فیلتر دسته‌بندی روی نقشه و ورود مستقیم کاربر به شهر خودش.

ثبت آگهی همچنان وضعیت `PENDING` و بررسی ناظر را حفظ می‌کند؛ همان transaction یک پست آگهی در دیوار شهر می‌سازد تا پیش‌نمایش فوراً دیده شود. کارت تا زمان تأیید برچسب «در انتظار تأیید» دارد و لینک جزئیات فقط پس از تأیید فعال می‌شود؛ آگهی ردشده از فید عمومی کنار گذاشته می‌شود.

| Endpoint | Auth | توضیح |
|---|---|---|
| GET `/wall?city=<slug>&limit=&before=` | Login | فید جدیدترین پست‌های شهر + پست پین‌شده جدا؛ شامل `likedByMe`، `canDelete`/`canEdit`/`canPin`، کرسر `nextBefore` و **متای اتاق `room { name, memberCount, messageCount }`** (فاز ۱۰) |
| GET `/wall/unread?city=<slug>&after=<ISO8601>` | Login | تعداد پست‌های قابل‌نمایش از کاربران دیگر پس از آخرین زمان بازدید دیوار؛ برای badge شهر در نوار پایین |
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


## پیام‌های خصوصی

گفت‌وگوها یک‌به‌یک و فقط برای دو عضو همان گفت‌وگو قابل دسترسی‌اند؛ همهٔ routeها Bearer token می‌خواهند. ارسال پیام به ۲۰ پیام در دقیقه برای هر کاربر محدود است (`429`). صفحهٔ `/messages` صندوق گفتگوها، تعداد پیام‌های خوانده‌نشده و متن گفتگو را نشان می‌دهد؛ بازکردن گفتگو پیام‌های دریافتی را به‌عنوان خوانده‌شده ثبت می‌کند. لینک «پیام خصوصی» در پروفایل عمومی کسب‌وکار به گفت‌وگوی مالک آن کسب‌وکار می‌رود.

| Endpoint | Auth | توضیح |
|---|---|---|
| GET `/messages/conversations` | Login | فهرست گفتگوهای کاربر، آخرین پیام و تعداد خوانده‌نشده |
| POST `/messages/conversations` | Login | آغاز/بازیابی گفت‌وگوی دونفره `{ recipientId }`؛ گفت‌وگو با خود کاربر رد می‌شود |
| GET `/messages/conversations/:id` | Login | دریافت پیام‌های گفتگو؛ عضویت بررسی و پیام‌های دریافتی خوانده‌شده علامت‌گذاری می‌شوند |
| POST `/messages/conversations/:id` | Login | ارسال `{ body }` تا ۲۰۰۰ نویسه؛ فقط عضو گفتگو، با محدودیت نرخ |
| PATCH `/messages/conversations/:id/read` | Login | علامت‌گذاری پیام‌های دریافتی گفتگو به‌عنوان خوانده‌شده |

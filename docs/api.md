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

## Admin (RBAC + Scope استان/شهر)

```
/admin/users, /admin/ads, /admin/businesses, /admin/provinces, /admin/cities,
/admin/categories, /admin/news, /admin/chat/reports, /admin/banners,
/admin/reports, /admin/dashboard, /admin/audit-logs
```

Guard: `PermissionsGuard` (کد permission از `role_permissions`) + Scope
(`CITY_ADMIN` فقط `city_id` خودش، `PROVINCE_ADMIN` فقط استان خودش).

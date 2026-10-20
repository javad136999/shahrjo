# اپ اندروید شهرجو

این پروژهٔ native، وب‌سایت `https://shahrju.ir` را در WebView باز می‌کند و پرداخت‌های درون‌برنامه‌ای بازار را با کتابخانهٔ رسمی [Poolakey](https://github.com/cafebazaar/Poolakey) انجام می‌دهد. نسخهٔ Poolakey روی `2.3.0` ثابت شده است. پل JavaScript فقط برای دامنه‌های امن `shahrju.ir` و `www.shahrju.ir` و با AndroidX `WebMessageListener` فعال می‌شود.

## پیش‌نیازها

Android Studio یا Android SDK با Platform 35، JDK 17 یا جدیدتر و اتصال اینترنت برای دریافت Gradle/وابستگی‌ها لازم است. شناسهٔ برنامه در این پروژه `ir.shahrju.app` است و باید دقیقاً با package name برنامهٔ ثبت‌شده در پیشخوان بازار و متغیر `BAZAAR_PACKAGE_NAME` سمت API یکی باشد. برای جایگزینی نسخهٔ ردشده با version code 1، این build از version code 2 استفاده می‌کند.

## کلید عمومی بازار

از پیشخوان توسعه‌دهندگان بازار، RSA public key همین برنامه را بردارید. این کلید محرمانه نیست و در APK قرار می‌گیرد؛ اما کلید دسترسی API بازار (`BAZAAR_ACCESS_TOKEN`) نباید در اپ اندروید یا این مخزن قرار بگیرد. کلید را در فایل محلی `~/.gradle/gradle.properties` (نه در Git) بنویسید:

```properties
BAZAAR_RSA_PUBLIC_KEY=کلید_عمومی_RSA_برنامه
```

برای ساخت Debug:

```bash
cd apps/android
./gradlew :app:assembleDebug
```

فایل در `app/build/outputs/apk/debug/app-debug.apk` ساخته می‌شود. برای ساخت Release، کلید عمومی باید تنظیم شده باشد؛ در غیر این صورت taskهای Release عمداً با خطا متوقف می‌شوند:

```bash
./gradlew :app:assembleRelease
```

این پروژه keystore انتشار ندارد. قبل از بارگذاری در بازار، APK/AAB را با keystore رسمی همان اپ از Android Studio امضا کنید؛ keystore و رمز آن را به مخزن نفرستید. اگر قبلاً نسخه‌ای از همین package name بارگذاری کرده‌اید، `versionCode` در `app/build.gradle.kts` باید از آخرین نسخهٔ بارگذاری‌شده بزرگ‌تر باشد.

## محصولات و روند خرید

شناسه‌های محصولات این نسخه `GOLD_1M`, `GOLD_6M`, `GOLD_12M`, `SILVER_1M`, `SILVER_6M` و `SILVER_12M` هستند. همین شناسه‌ها باید در پیشخوان بازار ساخته شوند و پاسخ checkout سرور نیز باید همین شناسه و package name برنامه را برگرداند.

این شناسه‌ها محصول اشتراکی هستند و با `subscribeProduct` در Poolakey خریداری می‌شوند. سرور payload یکتای هر سفارش را به اپ می‌دهد، payload برگشتی و پایان اعتبار اشتراک را با API بازار بررسی می‌کند و فقط در صورت معتبر و فعال‌بودن اشتراک دسترسی می‌دهد. اشتراک نباید consume شود؛ عملیات consume فقط برای محصولات یک‌بارمصرف است.

این مخزن سورس native و کتابخانه را فراهم می‌کند؛ دسترسی حساب بازار، کلید RSA واقعی، تنظیم محصولات در پیشخوان، keystore امضا و تأیید نهایی پرداخت در بازار باید با حساب مالک برنامه انجام شود.

# اتصال اپ اندروید شهرجو به پرداخت درون‌برنامه‌ای بازار

سورس native در `apps/android` قرار دارد. اپ با شناسهٔ `ir.shahrju.app` سایت `https://shahrju.ir` را در WebView باز می‌کند و کتابخانهٔ رسمی Poolakey نسخهٔ `2.3.0` را به کار می‌برد. روش ساخت و تنظیم کلید RSA در `apps/android/README.md` آمده است.

## امنیت پل وب

اپ با AndroidX `WebMessageListener` یک پل محدود به originهای `https://shahrju.ir` و `https://www.shahrju.ir` می‌سازد. برای frameهای دیگر یا دامنه‌های دیگر interface پرداخت تزریق نمی‌شود. وب‌اپ قرارداد زیر را استفاده می‌کند:

```ts
window.ShahrjoBazaar = {
  purchase: async ({ productId, packageName }) => ({
    purchaseToken: 'TOKEN_FROM_POOLAKEY',
    productId,
  }),
};
```

عملیات native فقط روی اشتراک‌های `M1_GOLD`, `M6_GOLD`, `M12_GOLD`, `M1_SILVER`, `M6_SILVER` و `M12_SILVER` اجازه داده می‌شود. شناسهٔ داخلی پلن در دیتابیس به همین شناسهٔ دقیق بازار نگاشت می‌شود. RSA public key بازار در build به `BuildConfig` تزریق می‌شود؛ access token بازار در اپ وجود ندارد و فقط سمت سرور استفاده می‌شود.

## جریان خرید

1. وب‌اپ `POST /api/v1/payments/checkout` را با `{ planId, businessId? }` صدا می‌زند و `paymentId`, `productId`, `packageName` می‌گیرد.
2. وب‌اپ `ShahrjoBazaar.purchase` را صدا می‌زند. Poolakey با `subscribeProduct` اشتراک را در برنامهٔ بازار باز می‌کند و پس از موفقیت، توکن خرید را به وب‌اپ برمی‌گرداند.
3. وب‌اپ `POST /api/v1/payments/bazaar/verify` را با `{ paymentId, productId, purchaseToken }` می‌فرستد. سرور با `BAZAAR_ACCESS_TOKEN` خرید را اعتبارسنجی می‌کند و اشتراک را فعال می‌کند.
4. وب‌اپ فقط نتیجهٔ سرور را نمایش می‌دهد؛ برای اشتراک هیچ درخواست `consume` ارسال نمی‌شود.

قیمت یا وضعیت پرداخت از سمت کلاینت معتبر نیست. مرجع فعال‌سازی اشتراک همواره پاسخ اعتبارسنجی سرور است. برای تنظیم RSA public key، package name، محصولات بازار و امضای APK راهنمای `apps/android/README.md` را دنبال کنید.

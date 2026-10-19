# اتصال نسخهٔ اندروید شهرجو به پرداخت درون‌برنامه‌ای بازار

مخزن فعلی شهرجو شامل کد native اندروید نیست؛ وب‌اپ از یک bridge استفاده می‌کند تا wrapper اندرویدِ منتشرشده در بازار، Poolakey را اجرا کند. در WebView باید این interface به `window.ShahrjoBazaar` تزریق شود:

```ts
window.ShahrjoBazaar = {
  purchase: async ({ productId, packageName }) => ({
    purchaseToken: 'TOKEN_FROM_POOLAKEY',
    productId,
  }),
};
```

پیاده‌سازی native باید از Poolakey استفاده کند، package name و RSA public key برنامهٔ بازار را تنظیم کند و برای محصول `productId` (همان code پلن، مانند `GOLD_1M`) خرید را انجام دهد. پس از موفقیت، فقط `purchaseToken` را به bridge برگرداند؛ مبلغ یا موفقیت پرداخت از سمت کلاینت قابل اعتماد نیست.

وب‌اپ سپس این دو درخواست را انجام می‌دهد:

1. `POST /api/v1/payments/checkout` با `{ planId, businessId? }` و دریافت `paymentId`, `productId`, `packageName`.
2. بازکردن Poolakey با `productId` و ارسال `POST /api/v1/payments/bazaar/verify` با `{ paymentId, productId, purchaseToken }`.

API شهرجو توکن را با `BAZAAR_ACCESS_TOKEN` در سمت سرور و API اعتبارسنجی بازار بررسی می‌کند و فقط بعد از پاسخ معتبر، اشتراک و کسب‌وکار را فعال می‌کند. کلید RSA عمومی در native app قرار می‌گیرد؛ کلید JWT تخفیف پویا فقط در صورت استفاده در تنظیمات امن native/server قرار گیرد و در Git commit نشود.

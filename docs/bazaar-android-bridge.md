# اتصال اپ اندروید شهرجو به اشتراک درون‌برنامه‌ای بازار

سورس native در `apps/android` قرار دارد. اپ با شناسهٔ `ir.shahrju.app` وب‌سایت `https://shahrju.ir` را در WebView باز می‌کند و از Poolakey `2.3.0` استفاده می‌کند. خرید پلن‌های GOLD و SILVER باید با `subscribeProduct` انجام شود؛ این شناسه‌ها SKU اشتراک بازار هستند، نه محصول یک‌باره. روش ساخت و تنظیم RSA public key در `apps/android/README.md` آمده است.

## امنیت پل وب

پل با AndroidX `WebMessageListener` فقط برای originهای امن `https://shahrju.ir` و `https://www.shahrju.ir` فعال می‌شود. frame یا دامنهٔ دیگر به خرید دسترسی ندارد. قرارداد وب چنین است:

```ts
window.ShahrjoBazaar = {
  purchase: async ({ productId, packageName, developerPayload }) => ({
    purchaseToken: 'TOKEN_FROM_POOLAKEY',
    productId,
  }),
};
```

فقط شناسه‌های `GOLD_1M`, `GOLD_6M`, `GOLD_12M`, `SILVER_1M`, `SILVER_6M` و `SILVER_12M` مجازند. payload یکتای خرید را سرور تولید و در رکورد همان پرداخت ذخیره می‌کند. توکن API بازار فقط روی سرور می‌ماند؛ RSA public key برنامه در build اندروید قرار می‌گیرد.

## جریان خرید اشتراک

1. وب‌اپ `POST /api/v1/payments/checkout` را با `{ planId, businessId? }` صدا می‌زند و `paymentId`, `productId`, `packageName`, `developerPayload` می‌گیرد.
2. وب‌اپ bridge را صدا می‌زند؛ Poolakey با `shouldSupportSubscription=true` و `subscribeProduct(PurchaseRequest(productId, payload))` صفحهٔ خرید اشتراک بازار را باز می‌کند.
3. پس از callback موفق، وب‌اپ `purchaseToken` را به `POST /api/v1/payments/bazaar/verify` می‌دهد.
4. سرور از endpoint اشتراک بازار `applications/<package>/subscriptions/<subscription_id>/purchases/<purchase_token>` استعلام می‌گیرد؛ payload برگشتی باید با payload پرداخت ذخیره‌شده برابر باشد و `validUntilTimestampMsec` باید از زمان فعلی جلوتر باشد. سرور تاریخ پایان entitlement را از همین timestamp می‌گیرد، نه از ادعای کلاینت.
5. اشتراک consume نمی‌شود. طبق راهنمای بازار، consume فقط برای محصول فروشیِ یک‌بارمصرف است و endpoint آن برای اشتراک مناسب نیست.

قیمت/وضعیت ارسالی کلاینت مبنای فعال‌سازی نیست. قیمت نمایشی اپ و SKUهای ساخته‌شده در پیشخوان باید با هم منطبق باشند. منابع رسمی: [پیاده‌سازی Poolakey](https://developers.cafebazaar.ir/en/guidelines/in-app-billing/implementation/kotlin)، [بررسی وضعیت اشتراک](https://developers.cafebazaar.ir/fa/guidelines/in-app-billing/api/subscription)، [امنیت پرداخت](https://developers.cafebazaar.ir/fa/guidelines/in-app-billing/security)، و [قوانین انتشار پرداخت](https://developers.cafebazaar.ir/fa/app-publish-guidelines/rules/payment).

export interface BazaarBridge {
  purchase(input: { productId: string; packageName: string }): Promise<{ purchaseToken: string; productId?: string }>;
  /** Optional for older native wrappers; new Android builds consume after server verification. */
  consume?(input: { purchaseToken: string }): Promise<void>;
}

declare global {
  interface Window {
    ShahrjoBazaar?: BazaarBridge;
  }
}

/**
 * The web/PWA cannot open Bazaar billing by itself. The Android app injects this
 * bridge and implements it with Poolakey. Desktop users get an explicit message
 * instead of a browser/card fallback.
 */
export async function purchaseWithBazaar(productId: string, packageName: string): Promise<string> {
  const bridge = typeof window !== 'undefined' ? window.ShahrjoBazaar : undefined;
  if (!bridge) throw new Error('برای پرداخت باید نسخه اندروید شهرجو را از بازار باز کنید.');
  const result = await bridge.purchase({ productId, packageName });
  if (!result?.purchaseToken) throw new Error('توکن خرید بازار دریافت نشد.');
  if (result.productId && result.productId !== productId) throw new Error('محصول خریداری‌شده با پلن انتخابی یکسان نیست.');
  return result.purchaseToken;
}

/** Consume an in-app item only after the server has verified and granted it. */
export async function consumeBazaarPurchase(purchaseToken: string): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.ShahrjoBazaar : undefined;
  if (bridge?.consume) await bridge.consume({ purchaseToken });
}

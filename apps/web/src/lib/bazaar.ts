export interface BazaarBridge {
  purchase(input: { productId: string; packageName: string }): Promise<{ purchaseToken: string; productId?: string }>;
  querySubscribedProducts?: () => Promise<{ purchases: BazaarSubscriptionPurchase[] }>;
}

export interface BazaarSubscriptionPurchase {
  productId: string;
  purchaseToken: string;
  purchaseState: string;
}

/** Database plan codes match the exact product IDs in the Bazaar catalog. */
export function bazaarProductIdForPlanCode(planCode: string): string {
  const ids: Record<string, string> = {
    GOLD_1M: 'GOLD_1M',
    GOLD_6M: 'GOLD_6M',
    GOLD_12M: 'GOLD_12M',
    SILVER_1M: 'SILVER_1M',
    SILVER_6M: 'SILVER_6M',
    SILVER_12M: 'SILVER_12M',
  };
  return ids[planCode] ?? planCode;
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

/** Recover an active subscription token from Poolakey without starting a new charge. */
export async function getSubscribedProductsWithBazaar(): Promise<BazaarSubscriptionPurchase[]> {
  const query = typeof window !== 'undefined' ? window.ShahrjoBazaar?.querySubscribedProducts : undefined;
  if (!query) throw new Error('برای بازیابی خرید، نسخهٔ جدید اپ اندروید شهرجو را از بازار نصب کنید.');
  const result = await query();
  return Array.isArray(result?.purchases) ? result.purchases : [];
}

import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BazaarPurchase {
  purchaseState: number;
  orderId: string | null;
  validUntilTimestampMsec: number | null;
  raw: Record<string, unknown>;
}

/** Server-side Cafe Bazaar Developer API client. Secrets stay in the API env. */
@Injectable()
export class BazaarService {
  private readonly logger = new Logger(BazaarService.name);
  private readonly accessToken: string;
  readonly packageName: string;
  private readonly timeoutMs = 15_000;

  constructor(config: ConfigService) {
    this.accessToken = (config.get<string>('BAZAAR_ACCESS_TOKEN') ?? '').trim();
    this.packageName = (config.get<string>('BAZAAR_PACKAGE_NAME') ?? '').trim();
  }

  get isConfigured(): boolean {
    return this.accessToken.length > 0 && this.packageName.length > 0;
  }

  async verifyPurchase(productId: string, purchaseToken: string): Promise<BazaarPurchase> {
    this.assertConfigured();
    const product = encodeURIComponent(productId);
    const token = encodeURIComponent(purchaseToken);
    const pkg = encodeURIComponent(this.packageName);
    const url = `https://pardakht.cafebazaar.ir/devapi/v2/api/applications/${pkg}/subscriptions/${product}/purchases/${token}/?access_token=${encodeURIComponent(this.accessToken)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new HttpException('ارتباط با بازار برقرار نشد؛ دوباره تلاش کنید', HttpStatus.BAD_GATEWAY);
    }
    let body: string;
    try {
      body = await response.text();
    } catch {
      throw new HttpException('پاسخ نامعتبر از بازار دریافت شد', HttpStatus.BAD_GATEWAY);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      const contentType = response.headers.get('content-type') ?? 'unknown';
      this.logger.warn(`Bazaar validation returned non-JSON: HTTP ${response.status}, content-type=${contentType}, bytes=${body.length}`);
      throw new HttpException('پاسخ نامعتبر از بازار دریافت شد', HttpStatus.BAD_GATEWAY);
    }
    if (!response.ok || !payload || typeof payload !== 'object') {
      this.logger.warn(`Bazaar validation rejected with HTTP ${response.status}`);
      throw new HttpException(
        'خرید بازار قابل تأیید نیست',
        response.status >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_REQUEST,
      );
    }
    const raw = payload as Record<string, unknown>;
    const purchaseState = Number(raw.purchaseState ?? raw.purchase_state ?? -1);
    const orderId = typeof raw.orderId === 'string' ? raw.orderId : typeof raw.order_id === 'string' ? raw.order_id : null;
    const rawValidUntil = raw.validUntilTimestampMsec;
    const parsedValidUntil = typeof rawValidUntil === 'number' || typeof rawValidUntil === 'string'
      ? Number(rawValidUntil)
      : Number.NaN;
    const validUntilTimestampMsec = Number.isFinite(parsedValidUntil) && parsedValidUntil > 0
      ? parsedValidUntil
      : null;
    if (!Number.isInteger(purchaseState) || purchaseState < 0) {
      throw new HttpException('پاسخ اعتبارسنجی خرید بازار نامعتبر است', HttpStatus.BAD_GATEWAY);
    }
    return { purchaseState, orderId, validUntilTimestampMsec, raw };
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new HttpException('پرداخت بازار هنوز در سرور پیکربندی نشده است (BAZAAR_ACCESS_TOKEN)', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}

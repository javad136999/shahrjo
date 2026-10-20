import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const REGISTERED_BAZAAR_PACKAGE_NAME = 'ir.shahrju.app';

export interface BazaarPurchase {
  purchaseState: number | null;
  orderId: string | null;
  developerPayload: string | null;
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
    return this.accessToken.length > 0 && this.packageName === REGISTERED_BAZAAR_PACKAGE_NAME;
  }

  async verifyPurchase(productId: string, purchaseToken: string): Promise<BazaarPurchase> {
    this.assertConfigured();
    const product = encodeURIComponent(productId);
    const token = encodeURIComponent(purchaseToken);
    const pkg = encodeURIComponent(this.packageName);
    const url = `https://pardakht.cafebazaar.ir/devapi/v2/api/applications/${pkg}/subscriptions/${product}/purchases/${token}?access_token=${encodeURIComponent(this.accessToken)}`;
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
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new HttpException('پاسخ نامعتبر از بازار دریافت شد', HttpStatus.BAD_GATEWAY);
    }
    if (!response.ok || !payload || typeof payload !== 'object') {
      this.logger.warn(`Bazaar subscription validation rejected with HTTP ${response.status}`);
      throw new HttpException('اشتراک بازار قابل تأیید نیست', HttpStatus.BAD_REQUEST);
    }
    const raw = payload as Record<string, unknown>;
    const purchaseStateValue = raw.purchaseState ?? raw.purchase_state;
    const purchaseState = purchaseStateValue === undefined ? null : Number(purchaseStateValue);
    const orderId = typeof raw.orderId === 'string' ? raw.orderId : typeof raw.order_id === 'string' ? raw.order_id : null;
    const developerPayload = typeof raw.developerPayload === 'string'
      ? raw.developerPayload
      : typeof raw.developer_payload === 'string'
        ? raw.developer_payload
        : null;
    const validUntilValue = raw.validUntilTimestampMsec ?? raw.valid_until_timestamp_msec;
    const validUntilTimestampMsec = validUntilValue === undefined ? null : Number(validUntilValue);

    if (purchaseState !== null && (!Number.isInteger(purchaseState) || purchaseState < 0)) {
      throw new HttpException('پاسخ وضعیت اشتراک بازار نامعتبر است', HttpStatus.BAD_GATEWAY);
    }
    if (validUntilTimestampMsec === null || !Number.isFinite(validUntilTimestampMsec) || validUntilTimestampMsec <= 0) {
      throw new HttpException('زمان اعتبار اشتراک از بازار دریافت نشد', HttpStatus.BAD_GATEWAY);
    }
    return { purchaseState, orderId, developerPayload, validUntilTimestampMsec, raw };
  }

  private assertConfigured(): void {
    if (!this.accessToken) {
      throw new HttpException('توکن API بازار روی سرور پیکربندی نشده است (BAZAAR_ACCESS_TOKEN)', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (this.packageName !== REGISTERED_BAZAAR_PACKAGE_NAME) {
      throw new HttpException(`BAZAAR_PACKAGE_NAME باید ${REGISTERED_BAZAAR_PACKAGE_NAME} باشد`, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}

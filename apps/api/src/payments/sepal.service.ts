import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SepalRequestResult {
  /** Sepal paymentNumber — stored in Payment.authority (the lookup key of the callback). */
  authority: string;
  payUrl: string;
  /** Normalized to ZarinPal's vocabulary so PaymentsService keeps one success path (100 = OK). */
  code: number;
  message: string;
}

export interface SepalVerifyResult {
  /** 100 = verified, 101 = already verified (idempotent replay), other = failed. */
  code: number;
  refId: number | string | null;
  message: string;
}

const SEPAL_BASE = 'https://payment.sepal.ir';

/**
 * Sepal (سپال) REST client — https://payment.sepal.ir/api/v1/payment/.
 *
 * The web-service API key only ever lives in env (SEPAL_API_KEY) — never in
 * client code. A callback with status=1 is NOT trusted by itself: the payer's
 * browser always comes back through GET /payments/callback, which calls
 * verifyPayment() server-to-server with our own stored amount, mirroring the
 * ZarinPal contract (code 100/101 = money moved) so PaymentsService keeps a
 * single success path for both gateways.
 *
 * Network/shape failures surface as a 502 with a Persian message; the caller
 * (PaymentsService) records them on the Payment row before rethrowing.
 */
@Injectable()
export class SepalService {
  private readonly logger = new Logger(SepalService.name);
  private readonly apiKey: string;
  private readonly callbackUrl: string;
  private readonly timeoutMs = 15_000;

  constructor(config: ConfigService) {
    this.apiKey = (config.get<string>('SEPAL_API_KEY') ?? '').trim();
    this.callbackUrl = (
      config.get<string>('SEPAL_CALLBACK_URL') ?? 'http://localhost:4000/api/v1/payments/callback'
    ).trim();
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /** Opens a Sepal payment session and returns the redirect URL for the payer. */
  async requestPayment(
    amountRial: bigint,
    invoiceNumber: string,
    description: string,
  ): Promise<SepalRequestResult> {
    this.assertConfigured();
    const data = await this.post<{
      status?: boolean;
      message?: string;
      paymentNumber?: string | number;
    }>(`${SEPAL_BASE}/api/v1/payment/request/`, {
      apiKey: this.apiKey,
      amount: Number(amountRial),
      callbackUrl: this.callbackUrl,
      invoiceNumber,
      // GET callback keeps the existing GET /payments/callback contract
      // (query params) shared with the ZarinPal return URL.
      callbackMethod: 'get',
      description,
    });

    const paymentNumber = data.paymentNumber;
    if (data.status !== true || paymentNumber === undefined || paymentNumber === null || paymentNumber === '') {
      this.logger.warn(`Sepal request rejected: message=${data.message ?? ''}`);
      throw new HttpException(
        'درگاه پرداخت در دسترس نیست؛ کمی بعد دوباره تلاش کنید',
        HttpStatus.BAD_GATEWAY,
      );
    }
    return {
      authority: String(paymentNumber),
      // Browser redirect — Sepal requires a Referer/Origin, which the payer's
      // navigation from /plans provides naturally.
      payUrl: `${SEPAL_BASE}/api/v1/payment/${paymentNumber}/`,
      code: 100,
      message: data.message ?? '',
    };
  }

  /**
   * Confirms a payment server-side. 100 = verified, 101 = already verified
   * (Sepal's `alreadyVerified` on a replayed callback) — both mean the money
   * moved. The echoed amount is checked against OUR stored amount: Sepal's
   * verify takes no amount, so the response echo is the only cross-check.
   */
  async verifyPayment(
    amountRial: bigint,
    paymentNumber: string,
    invoiceNumber: string,
  ): Promise<SepalVerifyResult> {
    this.assertConfigured();
    const data = await this.post<{
      status?: boolean;
      message?: string;
      referenceNumber?: string | number;
      amount?: string | number;
      alreadyVerified?: boolean;
    }>(`${SEPAL_BASE}/api/v1/payment/verify/`, {
      apiKey: this.apiKey,
      paymentNumber,
      invoiceNumber,
    });

    if (data.status !== true) {
      return { code: -1, refId: null, message: data.message ?? 'verify failed' };
    }

    const echoed = Number(data.amount);
    if (data.amount !== undefined && data.amount !== null && Number.isFinite(echoed) && echoed !== Number(amountRial)) {
      this.logger.warn(`Sepal amount mismatch: echoed=${echoed} stored=${amountRial}`);
      return { code: -52, refId: null, message: 'مبلغ تأییدشده با مبلغ تراکنش یکسان نیست' };
    }

    return {
      code: data.alreadyVerified ? 101 : 100,
      refId: data.referenceNumber ?? null,
      message: data.message ?? '',
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new HttpException(
        'درگاه پرداخت هنوز پیکربندی نشده است (SEPAL_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async post<T>(url: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new HttpException('ارتباط با درگاه پرداخت برقرار نشد', HttpStatus.BAD_GATEWAY);
    }

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // non-JSON body handled below
    }
    if (json === null || typeof json !== 'object') {
      this.logger.warn(`Sepal HTTP ${res.status} from ${url}: non-JSON body`);
      throw new HttpException('پاسخ نامعتبر از درگاه پرداخت', HttpStatus.BAD_GATEWAY);
    }
    return json as T;
  }
}

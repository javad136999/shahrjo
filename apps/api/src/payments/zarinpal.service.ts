import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ZarinpalRequestResult {
  authority: string;
  payUrl: string;
  code: number;
  message: string;
}

export interface ZarinpalVerifyResult {
  code: number;
  refId: number | null;
  message: string;
}

/**
 * ZarinPal v4 REST client (payment.zarinpal.com, sandbox.zarinpal.com).
 * The merchant id only ever lives in env — never in client code.
 * All network failures surface as a 502 with a Persian message; the caller
 * (PaymentsService) records them on the Payment row before rethrowing.
 */
@Injectable()
export class ZarinpalService {
  private readonly logger = new Logger(ZarinpalService.name);
  private readonly merchantId: string;
  private readonly sandbox: boolean;
  private readonly callbackUrl: string;
  private readonly timeoutMs = 15_000;

  constructor(config: ConfigService) {
    this.merchantId = (config.get<string>('ZARINPAL_MERCHANT_ID') ?? '').trim();
    this.sandbox = (config.get<string>('ZARINPAL_SANDBOX') ?? 'true').toLowerCase() !== 'false';
    this.callbackUrl = (
      config.get<string>('ZARINPAL_CALLBACK_URL') ?? 'http://localhost:4000/api/v1/payments/callback'
    ).trim();
  }

  get isConfigured(): boolean {
    return this.merchantId.length > 0;
  }

  private base(): string {
    return this.sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  }

  /** Opens a gateway session and returns the redirect URL for the payer. */
  async requestPayment(amountRial: bigint, description: string): Promise<ZarinpalRequestResult> {
    this.assertConfigured();
    const body = {
      merchant_id: this.merchantId,
      amount: Number(amountRial),
      callback_url: this.callbackUrl,
      description,
      currency: 'IRR',
    };

    const data = await this.post<{ code?: number; message?: string; authority?: string }>(
      `${this.base()}/pg/v4/payment/request.json`,
      body,
    );

    const authority = data.authority ?? '';
    const code = typeof data.code === 'number' ? data.code : -1;
    if (!authority || (code !== 100 && code !== 101)) {
      this.logger.warn(`ZarinPal request rejected: code=${code} message=${data.message ?? ''}`);
      throw new HttpException(
        'درگاه پرداخت در دسترس نیست؛ کمی بعد دوباره تلاش کنید',
        HttpStatus.BAD_GATEWAY,
      );
    }
    return {
      authority,
      payUrl: `${this.base()}/pg/StartPay/${authority}`,
      code,
      message: data.message ?? '',
    };
  }

  /**
   * Confirms a payment server-side. code 100 = verified, 101 = already
   * verified (idempotent callback) — both mean the money moved.
   */
  async verifyPayment(amountRial: bigint, authority: string): Promise<ZarinpalVerifyResult> {
    this.assertConfigured();
    const data = await this.post<{ code?: number; message?: string; ref_id?: number }>(
      `${this.base()}/pg/v4/payment/verify.json`,
      {
        merchant_id: this.merchantId,
        amount: Number(amountRial),
        authority,
      },
    );
    const code = typeof data.code === 'number' ? data.code : -1;
    return { code, refId: typeof data.ref_id === 'number' ? data.ref_id : null, message: data.message ?? '' };
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new HttpException(
        'درگاه پرداخت هنوز پیکربندی نشده است (ZARINPAL_MERCHANT_ID)',
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
    const payload = (json ?? {}) as { data?: T; errors?: unknown; code?: number; message?: string };
    if (res.ok && payload.data !== undefined && payload.data !== null) return payload.data;
    // ZarinPal reports failures in two shapes:
    //   { errors: { code, message, validations } }  (HTTP 4xx, e.g. verify -51)
    //   { code, message }                            (top-level)
    // Surface either as { code, message } so the caller can record the exact
    // result code instead of a generic throw.
    const errors = payload.errors as { code?: unknown; message?: unknown } | undefined;
    const errCode = typeof errors?.code === 'number' ? errors.code : payload.code;
    if (typeof errCode === 'number') {
      const message = (typeof errors?.message === 'string' ? errors.message : payload.message) ?? '';
      this.logger.warn(`ZarinPal HTTP ${res.status} from ${url}: code=${errCode} ${message}`);
      return { code: errCode, message } as unknown as T;
    }
    this.logger.warn(`ZarinPal HTTP ${res.status} from ${url}: ${JSON.stringify(payload.errors ?? json)}`);
    throw new HttpException('پاسخ نامعتبر از درگاه پرداخت', HttpStatus.BAD_GATEWAY);
  }
}

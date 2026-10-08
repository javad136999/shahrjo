import { Logger } from '@nestjs/common';
import { ConsoleSmsProvider } from './console.provider';
import type { SmsProvider, SmsSendResult } from '../sms.types';

/**
 * IPPanel / KPanel (Edge) adapter — official docs:
 * https://ippanelcom.github.io/Edge-Document/ → "Send Pattern SMS"
 *
 *   POST https://edge.ippanel.com/v1/api/send
 *   Authorization: <API key>        (raw key, no "Bearer" prefix — per docs)
 *   { sending_type: "pattern", from_number, code: <pattern code>,
 *     recipients: ["+989..."], params: { <param>: <otp> } }
 *
 * Behavior without a pattern code (pending activation):
 *   NO request is made to any endpoint; sendOtp() delegates to the console
 *   adapter and logs a "pending activation" warning, so auth keeps working.
 *   Enabling real sending is a pure config change — SMS_PATTERN_CODE
 *   (+ SMS_SENDER, + SMS_PATTERN_PARAM matching the pattern's %variable%)
 *   — no code rewrite. Verified live against pattern type "otp".
 */
const BASE_URL = 'https://edge.ippanel.com/v1';

interface IpPanelResponse {
  data?: { message_outbox_ids?: number[] } | null;
  meta?: { status?: boolean; message?: string; message_code?: string };
}

/**
 * Edge base64-decodes the Authorization header before matching the key, so a
 * raw uuid-style key would be rejected ("Invalid token") unless encoded first.
 * A key already provided in base64 form (as displayed in the KPanel/IPPanel
 * panel) passes through untouched.
 */
function authHeader(apiKey: string): string {
  const key = apiKey.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(key)
    ? Buffer.from(key, 'utf8').toString('base64')
    : key;
}

/** `09XXXXXXXXX` (our normalized form) → E.164 `+989XXXXXXXXX` as required by the API. */
function toE164(phone: string): string {
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('0')) return `+98${phone.slice(1)}`;
  if (phone.startsWith('98')) return `+${phone}`;
  return `+98${phone}`;
}

export class IpPanelSmsProvider implements SmsProvider {
  readonly name = 'ippanel';
  private readonly logger = new Logger('Sms:ippanel');
  private readonly pending = new ConsoleSmsProvider();

  constructor(
    private readonly apiKey: string,
    private readonly patternCode?: string,
    /** Sender number in E.164 (e.g. +983000505) — required by the API in pattern mode. */
    private readonly fromNumber?: string,
    /** Placeholder key inside the pattern that carries the OTP (docs example: "code"). */
    private readonly patternParam: string = 'code',
  ) {}

  async sendOtp(to: string, code: string): Promise<SmsSendResult> {
    // Pending activation: no pattern code yet => no API call, no real SMS.
    if (!this.patternCode) {
      this.logger.warn(`SMS_PATTERN_CODE not set — pending activation, SMS NOT sent to ${to}`);
      return this.pending.sendOtp(to, code);
    }

    if (!this.fromNumber) {
      return {
        success: false,
        error: 'ippanel: SMS_SENDER (from_number) is required when SMS_PATTERN_CODE is set',
      };
    }

    try {
      const res = await fetch(`${BASE_URL}/api/send`, {
        method: 'POST',
        headers: {
          Authorization: authHeader(this.apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sending_type: 'pattern',
          from_number: this.fromNumber,
          code: this.patternCode,
          recipients: [toE164(to)],
          params: { [this.patternParam]: code },
        }),
      });

      const body = (await res.json().catch(() => null)) as IpPanelResponse | null;
      const meta = body?.meta;
      if (res.ok && meta?.status === true) {
        const outboxId = body?.data?.message_outbox_ids?.[0];
        this.logger.log(`pattern SMS accepted for ${to} (outbox ${outboxId ?? 'n/a'})`);
        return { success: true, messageId: outboxId !== undefined ? String(outboxId) : undefined };
      }
      return {
        success: false,
        error: `ippanel status=${res.status} ${meta?.message_code ?? ''} ${meta?.message ?? ''}`.trim(),
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'ippanel request failed' };
    }
  }
}

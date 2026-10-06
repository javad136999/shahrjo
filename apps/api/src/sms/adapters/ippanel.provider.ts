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
 * Behavior without a pattern code (current state of the project):
 *   SMS_PATTERN_CODE is NOT required and NO request is made to any endpoint.
 *   sendOtp() delegates to the console adapter and logs a "pending activation"
 *   warning, so auth keeps working and enabling real sending later is a pure
 *   config change (set SMS_PATTERN_CODE + SMS_SENDER) — no code rewrite.
 */
const BASE_URL = 'https://edge.ippanel.com/v1';

interface IpPanelResponse {
  data?: { message_outbox_ids?: number[] } | null;
  meta?: { status?: boolean; message?: string; message_code?: string };
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
          Authorization: this.apiKey,
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

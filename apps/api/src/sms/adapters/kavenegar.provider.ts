import type { SmsProvider, SmsSendResult } from '../sms.types';

/**
 * Kavenegar adapter.
 * - With SMS_OTP_TEMPLATE: uses /verify/lookup.json (template-based OTP).
 * - Without template: falls back to /sms/send.json with a plain message.
 * Docs: https://kavenegar.com/doc/
 */
export class KavenegarSmsProvider implements SmsProvider {
  readonly name = 'kavenegar';

  constructor(
    private readonly apiKey: string,
    private readonly template?: string,
    private readonly sender?: string,
  ) {}

  async sendOtp(to: string, code: string): Promise<SmsSendResult> {
    const receptor = to.replace(/^0/, '');
    const url = this.template
      ? `https://kavenegar.com/v1/${this.apiKey}/verify/lookup.json?receptor=${receptor}` +
        `&token=${encodeURIComponent(code)}&template=${encodeURIComponent(this.template)}`
      : `https://kavenegar.com/v1/${this.apiKey}/sms/send.json?receptor=${receptor}` +
        `&sender=${encodeURIComponent(this.sender ?? '')}` +
        `&message=${encodeURIComponent(`شهرجو: کد ورود ${code}`)}`;

    try {
      const res = await fetch(url);
      const body = (await res.json()) as { return?: number; requestId?: string; messageid?: string };
      if (res.ok && body.return === 200) {
        return { success: true, messageId: String(body.requestId ?? body.messageid ?? '') };
      }
      return { success: false, error: `kavenegar return=${body.return} status=${res.status}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'kavenegar request failed' };
    }
  }
}

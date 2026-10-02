import type { SmsProvider, SmsSendResult } from '../sms.types';

/**
 * SMS.ir adapter (docs: https://sms.ir/rest-api/).
 * - With SMS_OTP_TEMPLATE (numeric template id): POST /v1/send/verify
 * - Otherwise: POST /v1/send/bulk using SMS_SENDER as the line number.
 * The template parameter name defaults to `CODE` (sms.ir parameter name in your template).
 */
export class SmsIrProvider implements SmsProvider {
  readonly name = 'smsir';

  constructor(
    private readonly apiKey: string,
    private readonly templateId?: string,
    private readonly lineNumber?: string,
  ) {}

  async sendOtp(to: string, code: string): Promise<SmsSendResult> {
    const mobile = to.replace(/^0/, '');

    if (this.templateId) {
      return this.post('https://api.sms.ir/v1/send/verify', {
        mobile,
        templateId: Number(this.templateId),
        parameters: [{ name: 'CODE', value: code }],
      });
    }

    if (this.lineNumber) {
      return this.post('https://api.sms.ir/v1/send/bulk', {
        lineNumber: Number(this.lineNumber),
        messageText: `شهرجو: کد ورود ${code}`,
        mobiles: [mobile],
        sendDateTime: null,
      });
    }

    return { success: false, error: 'smsir: set SMS_OTP_TEMPLATE (template id) or SMS_SENDER (line number)' };
  }

  private async post(url: string, payload: unknown): Promise<SmsSendResult> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/plain',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { code?: number; message?: string; id?: number };
      if (res.ok && body.code === 200) {
        return { success: true, messageId: body.id !== undefined ? String(body.id) : undefined };
      }
      return { success: false, error: `smsir code=${body.code} status=${res.status} ${body.message ?? ''}`.trim() };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'smsir request failed' };
    }
  }
}

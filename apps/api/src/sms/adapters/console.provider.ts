import { Logger } from '@nestjs/common';
import type { SmsProvider, SmsSendResult } from '../sms.types';

/** Development adapter: prints the OTP to the server log instead of sending SMS. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger('Sms:console');

  async sendOtp(to: string, code: string): Promise<SmsSendResult> {
    this.logger.log(`OTP for ${to}: ${code}`);
    return { success: true, messageId: `console-${Date.now()}` };
  }
}

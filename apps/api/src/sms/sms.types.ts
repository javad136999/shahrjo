/** Provider-agnostic SMS abstraction — swap providers without touching auth. */
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  /** Sends an OTP code to a normalized `09XXXXXXXXX` number. */
  sendOtp(to: string, code: string): Promise<SmsSendResult>;
}

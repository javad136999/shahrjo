import { ConfigService } from '@nestjs/config';
import { ConsoleSmsProvider } from './adapters/console.provider';
import { IpPanelSmsProvider } from './adapters/ippanel.provider';
import { KavenegarSmsProvider } from './adapters/kavenegar.provider';
import { SmsIrProvider } from './adapters/smsir.provider';
import type { SmsProvider } from './sms.types';

/**
 * Creates the configured SMS adapter. Adding a provider = adding one file
 * here; auth code never changes (SMS_PROVIDER abstraction).
 */
export function createSmsProvider(config: ConfigService): SmsProvider {
  const provider = (config.get<string>('SMS_PROVIDER') ?? 'console').toLowerCase();
  const apiKey = config.get<string>('SMS_API_KEY') || undefined;
  const template = config.get<string>('SMS_OTP_TEMPLATE') || undefined;
  const sender = config.get<string>('SMS_SENDER') || undefined;
  // IPPanel/KPanel pattern OTP (empty until the pattern is approved — then
  // setting it activates real sending without touching auth code).
  const patternCode = config.get<string>('SMS_PATTERN_CODE') || undefined;
  const patternParam = config.get<string>('SMS_PATTERN_PARAM') || 'code';

  switch (provider) {
    case 'console':
      return new ConsoleSmsProvider();
    case 'kavenegar':
      if (!apiKey) throw new Error('SMS_API_KEY is required for SMS_PROVIDER=kavenegar');
      return new KavenegarSmsProvider(apiKey, template, sender);
    case 'smsir':
      if (!apiKey) throw new Error('SMS_API_KEY is required for SMS_PROVIDER=smsir');
      return new SmsIrProvider(apiKey, template, sender);
    case 'ippanel':
      if (!apiKey) throw new Error('SMS_API_KEY is required for SMS_PROVIDER=ippanel');
      return new IpPanelSmsProvider(apiKey, patternCode, sender, patternParam);
    default:
      throw new Error(`Unknown SMS_PROVIDER "${provider}" (expected console | kavenegar | smsir | ippanel)`);
  }
}

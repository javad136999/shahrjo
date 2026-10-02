import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSmsProvider } from './sms.provider';
import { SMS_PROVIDER } from './sms.types';

@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: (config: ConfigService) => createSmsProvider(config),
      inject: [ConfigService],
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}

import { Module } from '@nestjs/common';
import { MailerService } from './mailer.services';

@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}

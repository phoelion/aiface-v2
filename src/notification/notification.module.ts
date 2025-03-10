import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TelegramService } from '../telegram/telegram.service';
import { OneSignalService } from './oneSignal.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [NotificationService, TelegramService, OneSignalService],
  exports: [NotificationService],
})
export class NotificationModule {}

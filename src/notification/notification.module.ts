import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TelegramService } from '../telegram/telegram.service';
import { OneSignalService } from './oneSignal.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [NotificationService, TelegramService, OneSignalService, ConfigService],
  exports: [NotificationService],
})
export class NotificationModule {}

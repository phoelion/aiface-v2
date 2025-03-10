import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [],
  providers: [TelegramService],
})
export class TelegramModule {}

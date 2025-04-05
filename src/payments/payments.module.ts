import { Logger, Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AppleNotificationsService } from './apple-notifications.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports:[HttpModule],
  controllers: [PaymentsController],
  providers: [PaymentsService,AppleNotificationsService,Logger]
})

export class PaymentsModule {}

import { Logger, Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AppleNotificationsService } from './apple-notifications.service';
import { HttpModule } from '@nestjs/axios';
import { UsersModule } from 'src/users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schema/payment.schema';
import { NotificationModule } from 'src/notification/notification.module';
import { AppLogsModule } from 'src/applogs/app-logs.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]), HttpModule, UsersModule, NotificationModule, AppLogsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, AppleNotificationsService, Logger],
})
export class PaymentsModule {}

import { Logger, Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { AppleNotificationsService } from './apple-notifications.service';
import { HttpModule } from '@nestjs/axios';
import { UsersModule } from 'src/users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schema/payment.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]), HttpModule, UsersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, AppleNotificationsService, Logger],
})
export class PaymentsModule {}

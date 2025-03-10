import { Module } from '@nestjs/common';
import { ContactUsController } from './contact-us.controller';
import { ContactUsService } from './contact-us.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ContactUs, ContactUsSchema } from './schema/contact-us.schema';
import { UsersModule } from 'src/users/users.module';
import { NotificationService } from '../notification/notification.service';


@Module({
  imports: [MongooseModule.forFeature([{ name: ContactUs.name, schema: ContactUsSchema }]), UsersModule],
  controllers: [ContactUsController],
  providers: [ContactUsService, NotificationService],
})
export class ContactUsModule {}

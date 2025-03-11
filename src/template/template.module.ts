import { Module } from '@nestjs/common';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Template, TemplateSchema } from './model/templates.schema';
import { UsersModule } from 'src/users/users.module';
import { NotificationService } from '../notification/notification.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Template.name, schema: TemplateSchema }]), UsersModule, NotificationModule],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}

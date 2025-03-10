import { Module } from '@nestjs/common';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Template, TemplateSchema } from './model/templates.schema';
import { UsersModule } from 'src/users/users.module';
import { ResizeService } from 'src/services/resizer.service';
import { NotificationService } from 'src/services/notification.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Template.name, schema: TemplateSchema }]), UsersModule],
  controllers: [TemplateController],
  providers: [TemplateService, ResizeService, NotificationService],
  exports: [TemplateService],
})
export class TemplateModule {}

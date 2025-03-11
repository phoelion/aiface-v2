import { Module } from '@nestjs/common';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Template, TemplateSchema } from './model/templates.schema';
import { UsersModule } from 'src/users/users.module';
import { NotificationService } from '../notification/notification.service';
import { NotificationModule } from '../notification/notification.module';
import { Category, CategorySchema } from './model/category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Template.name, schema: TemplateSchema },
      {
        name: Category.name,
        schema: CategorySchema,
      },
    ]),
    UsersModule,
    NotificationModule,
  ],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}

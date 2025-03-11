import { Module } from '@nestjs/common';
import { FaceSwapController } from './face-swap.controller';
import { FaceSwapService } from './face-swap.service';
import { UsersModule } from 'src/users/users.module';
import { HttpModule } from '@nestjs/axios';
import { TemplateModule } from '../template/template.module';
import { NovitaService } from './novita.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [UsersModule, TemplateModule, HttpModule, NotificationModule],
  providers: [FaceSwapService, NovitaService],
  controllers: [FaceSwapController],
})
export class FaceSwapModule {}

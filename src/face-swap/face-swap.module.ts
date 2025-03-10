import { Module } from '@nestjs/common';
import { FaceSwapController } from './face-swap.controller';
import { FaceSwapService } from './face-swap.service';
import { UsersModule } from 'src/users/users.module';
import { HttpModule } from '@nestjs/axios';
import { TemplateModule } from '../template/template.module';
import { NotificationService } from '../notification/notification.service';
import { NovitaService } from './novita.service';

@Module({
  imports: [ UsersModule, TemplateModule, HttpModule],
  providers: [FaceSwapService, NotificationService, NovitaService],
  controllers: [FaceSwapController],
})
export class FaceSwapModule {}

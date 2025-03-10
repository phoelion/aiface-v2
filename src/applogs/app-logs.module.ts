import { Module, forwardRef } from '@nestjs/common';
import { LogsController } from './app-logs.controller';
import { LogsService } from './app-logs.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AppLog, AppLogSchema } from './model/app-logs.schema';

import { BackLog, BackLogSchema } from './model/back-logs.schema';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppLog.name, schema: AppLogSchema },
      { name: BackLog.name, schema: BackLogSchema },
    ]),
    UsersModule,
  ],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class AppLogsModule {}

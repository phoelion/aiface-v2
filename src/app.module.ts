import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MulterModule } from '@nestjs/platform-express';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import configuration from './config/configuration';
import { AppLoggerMiddleware } from './common/middlewares/app.logger.middleware';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import * as dotenv from 'dotenv';
import { HomeModule } from './home/home.module';
import { TelegramModule } from './telegram/telegram.module';
import { NotificationModule } from './notification/notification.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AppLogsModule } from './applogs/app-logs.module';
import { SERVE_ROOT_URL } from './config/app-constants';
import { FaceSwapModule } from './face-swap/face-swap.module';
import { PaymentsModule } from './payments/payments.module';

dotenv.config();

const nodeEnv = process.env.NODE_ENV;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      load: [configuration],
    }),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: SERVE_ROOT_URL,
    }),

    MulterModule.register({
      dest: join(__dirname, '..', 'public'),
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        return {
          uri: config.get<string>('dbUrl'),
        };
      },
      inject: [ConfigService],
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      global: true,
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret'),
      }),
      inject: [ConfigService],
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 300,
        limit: 10,
      },
    ]),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,

    HomeModule,
    TelegramModule,

    NotificationModule,

    AppLogsModule,
    FaceSwapModule,
    PaymentsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AppLoggerMiddleware).forRoutes('*');
  }
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import * as mongoSanitize from 'express-mongo-sanitize';
import * as compression from 'compression';
import { urlencoded, json } from 'express';
import { ConfigService } from '@nestjs/config';
import { GlobalExceptionFilter } from './common/filters/global-exceprion.filter';
import { GLOBAL_PREFIX } from './config/app-constants';

async function bootstrap(): Promise<void> {
  const app:INestApplication = await NestFactory.create(AppModule, {
    bodyParser: true,
  });
  const configService = app.get(ConfigService);

  const nodeEnv = configService.get('NODE_ENV');
  const port = parseInt(process.env[`PORT_${nodeEnv}`], 10) || 6475;


  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.use(mongoSanitize());
  app.setGlobalPrefix(GLOBAL_PREFIX);

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.use(compression());
  await app.listen(port, () => {
    Logger.log(`listening on port: ${port}`);
  });
}

bootstrap();

const exitHandler = () => {
  process.exit(1);
};

const unexpectedErrorHandler = (error: Error) => {
  console.log(error);
  if ('response' in error) {
    Logger.error('🔥🔥🔥Fucked Up situation', JSON.parse(JSON.stringify(error)));
  } else {
    Logger.error(error);
  }
};
process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

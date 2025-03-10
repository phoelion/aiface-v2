import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';

import { MongooseModule } from '@nestjs/mongoose';
import { HomeService } from './home.service';
import { Home, HomeSchema } from './schema/home.schema';

import { UsersModule } from 'src/users/users.module';

import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Home.name, schema: HomeSchema }]),

    UsersModule,
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 5,
    }),
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}

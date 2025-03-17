import { Controller, Post, Req, Get, Res, Query, Param, Body, UseInterceptors, UploadedFiles, UseGuards, Patch, UploadedFile, BadRequestException, Logger } from '@nestjs/common';
import { Response } from 'express';

import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dtos/create-template.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

import { NotificationService } from '../notification/notification.service';
import { UsersService } from '../users/users.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthGuard } from '../common/guards/auth.guard';
import { RequestWithUser } from '../common/interfaces/request-with-user';
import { MULTER_OPTIONS_IMAGE_TEMPLATE, MULTER_OPTIONS_PUBLIC, MULTER_OPTIONS_VIDEO_TEMPLATE } from '../config/app-constants';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { CategoryTypeEnum } from './enums/category-type.enum';

@Controller('templates')
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly usersService: UsersService,
    private readonly notificationService: NotificationService
  ) {}

  @Roles('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Post('/create-photo-template')
  @UseInterceptors(FileInterceptor('image', MULTER_OPTIONS_IMAGE_TEMPLATE))
  async createTemplate(@Req() req: RequestWithUser, @Body() body: CreateTemplateDto, @UploadedFile() image: Express.Multer.File) {
    if (!image) {
      throw new BadRequestException('Image is required');
    }

    const data = await this.templateService.createPhotoTemplate(body, image);
    return {
      success: true,
      message: 'template successfully created',
      data,
    };
  }

  @Roles('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Post('/create-video-template')
  @UseInterceptors(FileInterceptor('video', MULTER_OPTIONS_VIDEO_TEMPLATE))
  async createVideoTemplate(@Req() req: RequestWithUser, @Body() body: CreateTemplateDto, @UploadedFile() video: Express.Multer.File) {
    if (!video) {
      throw new BadRequestException('Video is required');
    }
    //TODO: add logic of creating video templates
    const data = await this.templateService.createVideoTemplate(body, video);
    return {
      success: true,
      message: 'template successfully created',
      data,
    };
  }

  @Roles('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Post('/categories')
  async createCategory(@Body() body: CreateCategoryDto, @Req() req: RequestWithUser) {
    const data = await this.templateService.createCategory(body);

    return {
      success: true,
      message: 'template successfully created',
      data,
    };
  }

  @UseGuards(AuthGuard)
  @Get('/categories')
  async getCategories(@Req() req: RequestWithUser, @Query('type') type: string) {
    const data = await this.templateService.getAllCategories(type as CategoryTypeEnum);

    return {
      success: true,
      message: 'template successfully created',
      data,
    };
  }

  @UseGuards(AuthGuard)
  @Get('/categories/:id/templates')
  async getCategoryTemplates(@Req() req: RequestWithUser, @Param('id') id: string) {
    const data = await this.templateService.getCategoryTemplates(id);

    return {
      success: true,
      data,
    };
  }
}

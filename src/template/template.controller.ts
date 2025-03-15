import { Controller, Post, Req, Get, Res, Query,Param, Body, UseInterceptors, UploadedFiles, UseGuards, Patch, UploadedFile, BadRequestException, Logger } from '@nestjs/common';
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

  @Roles('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Get('/categories')
  async getCategories(@Req() req: RequestWithUser, @Query('type') type: string) {
    const data = await this.templateService.getAllCategories(type as CategoryTypeEnum);

    return {
      success: true,
      message: 'template successfully created',
      data,
    };
  }


  // @Roles('admin')
  // @UseGuards(AuthGuard, RolesGuard)
  // @Patch('/categories/categoryname')
  // async updateTemplates(@Req() req: RequestWithUser, @Res() res: Response, @Body() body) {
  //   const { prevName, newName } = body;
  //
  //   const data = await this.templateService.updateTemplates(prevName, newName);
  //   res.status(200).json({
  //     success: true,
  //     data,
  //   });
  // }
  //
  // @Roles('admin')
  // @UseGuards(AuthGuard, RolesGuard)
  // @Post('/multi')
  // @UseInterceptors(
  //   FileInterceptor('file', {
  //     storage: diskStorage({
  //       destination: path.join(__dirname, '..', '..', 'aiface', 'templates', 'temp'),
  //       filename: (req, file, cb) => {
  //         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  //         const ext = path.extname(file.originalname);
  //
  //         if (ext !== '.zip') {
  //           cb(new BadRequestException('not valid file, expect zip file'), null);
  //         }
  //         cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  //       },
  //     }),
  //   })
  // )
  // async createMultiTemplates(@UploadedFile() file: Express.Multer.File, @Body() createMultiTemplatesDto: CreateMultiTemplatesDto) {
  //   // console.log(file);
  //   const destinationFolder = path.join(__dirname, '..', '..', 'aiface', 'templates');
  //   const { templateIds, imageNames } = await this.templateService.createMultiTemplates(file.path, destinationFolder, createMultiTemplatesDto.category);
  //   const res = await this.resizeService.bulkCoverCreator(imageNames);
  //   console.log(res);
  //   return {
  //     message: 'File uploaded and processed successfully',
  //     templateIds,
  //     imageNames,
  //   };
  // }

  // @UseGuards(AuthGuard, RolesGuard)
  // @Roles('admin')
  // @Post('/multi-without-image')
  // async createMultiImageLessTemplates(@Body() body) {
  //   const res = await this.templateService.createMultiImageLess(body.startTempId, body.endTempId, body.category);
  //
  //   return {
  //     message: 'File uploaded and processed successfully',
  //     res,
  //   };
  // }
  //
  // @Post('/with-images')
  // @UseInterceptors(FilesInterceptor('images', 2, multerOptions))
  // async createTemplateWithImages(@Body() body: createTemplateDto, @Req() req: RequestWithUser, @Res() res: Response, @UploadedFiles() images: Array<Express.Multer.File>) {
  //   const data = await this.templateService.createTemplate(body);
  //   res.status(200).json({
  //     success: true,
  //     message: 'template successfully created',
  //     data,
  //   });
  // }
  //
  // @Get('/all')
  // async getAllTemplate(@Req() req: RequestWithUser, @Res() res: Response) {
  //   const data = await this.templateService.findAllTemplates();
  //   console.log(data.length);
  //   res.status(200).json({
  //     success: true,
  //     message: 'all templates',
  //     data,
  //   });
  // }
  //
  // @Get('/categories')
  // async getCategoriesTemplates(@Req() req: RequestWithUser, @Res() res: Response) {
  //   const data = await this.templateService.getCategoriesTemplates();
  //   res.status(200).json({
  //     success: true,
  //     message: 'templates grouped by category',
  //     data,
  //   });
  // }

  // @Get('/user/all')
  // @UseGuards(AuthGuard)
  // async getAllUserTemplate(@Req() req: RequestWithUser, @Res() res: Response) {
  //   const { user } = req;
  //   const data = await this.templateService.findAllUserTemplates(user);
  //   res.status(200).json({
  //     success: true,
  //     message: 'all user templates',
  //     data,
  //   });
  // }

  // @Get('/id/:tempId')
  // async getTemplateByName(@Param('tempId') tempId: string, @Req() req: RequestWithUser, @Res() res: Response) {
  //   const data = await this.templateService.findTemplateByName(tempId);
  //   res.status(200).json({
  //     success: true,
  //     message: 'template data',
  //     data,
  //   });
  // }

  // @Roles('admin')
  // @UseGuards(AuthGuard, RolesGuard)
  // @Post('/report')
  // async report(@Req() req: RequestWithUser, @Res() res: Response, @Body() body: { start; end }) {
  //   const { totalImageSwaps, totalVideoSwaps } = await this.usersService.getTotals(new Date(body.start), new Date(body.end));
  //   //
  //   const data = await this.templateService.swapsReport(totalImageSwaps, totalVideoSwaps);
  //   res.status(200).json({
  //     success: true,
  //     totalVideoSwaps: totalVideoSwaps.length,
  //     totalImageSwaps: totalImageSwaps.length,
  //     data,
  //   });
  // }

  // @Roles('admin')
  // @UseGuards(AuthGuard, RolesGuard)
  // @Post('/update-sort-order')
  // async updateSortOrder(@Body() body: { categoryCounts }) {
  //   if (!body || !body.categoryCounts) {
  //     throw new BadRequestException('fuck off');
  //   }
  //   await this.templateService.updateSortOrder(body.categoryCounts);
  // }

  // @Roles('admin')
  // @UseGuards(AuthGuard, RolesGuard)
  // @Post('/update-multi-templates')
  // async updateMultiTemplates(@Body() body: { categoryCounts }) {
  //   // await this.templateService.updateSortOrder(body.categoryCounts);
  //
  //   return this.templateService.updateMultiTemplatesV2();
  // }

  // @Roles('admin')
  // @UseGuards(AuthGuard, RolesGuard)
  // @Post('/templates-report')
  // async reportV2(@Req() req: RequestWithUser, @Res() res: Response, @Body() body: { start; end }) {
  //   const data = await this.templateService.templateUsages(new Date(body.start), new Date(body.end));
  //
  //   //    const updatedSortOrders = await this.templateService.updateSortOrder(data);
  //
  //   res.status(200).json({
  //     success: true,
  //     data,
  //   });
  // }

  // @Cron('30 10 * * *')
  // async cronUpdate() {
  //   const today = new Date();

  //   const tenDaysAgo = new Date();
  //   tenDaysAgo.setDate(today.getDate() - 10);

  //   const todayFormatted = today.toISOString().split('T')[0];
  //   const tenDaysAgoFormatted = tenDaysAgo.toISOString().split('T')[0];
  //   const { newData } = await this.templateService.templateUsages(new Date(tenDaysAgoFormatted), new Date(today));
  //   const updatedSortOrders = await this.templateService.updateSortOrder(newData);
  //   Logger.log('Categories Sorted');

  //   await this.notificationService.notifyAdmin(`Categories Sorted:\n${Object.keys(newData).reverse().join('\n')}`);
  // }
}

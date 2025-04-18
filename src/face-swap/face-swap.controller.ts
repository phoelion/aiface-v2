import {
  Controller,
  Post,
  ClassSerializerInterceptor,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Req,
  UseGuards,
  Param,
  Get,
  UploadedFile,
  Body,
  HttpCode,
  Delete,
  Patch,
} from '@nestjs/common';
import { FaceSwapService } from './face-swap.service';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { videoOptions } from './uploadImage.service';
import { ConfigService } from '@nestjs/config';
import { MULTER_OPTIONS_PUBLIC, PUBLIC_BASE_URL, VIDEO_TEMPLATES_BASE_PATH } from '../config/app-constants';
import { AuthGuard } from '../common/guards/auth.guard';
import { RequestWithUser } from '../common/interfaces/request-with-user';

import { DevGuard } from '../common/guards/dev.guard';
import { UsersService } from 'src/users/users.service';
import { TemplateService } from 'src/template/template.service';
import { join } from 'path';

@Controller('face-swap')
@UseInterceptors(ClassSerializerInterceptor)
export class FaceSwapController {
  constructor(
    private readonly faceSwapService: FaceSwapService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly templateService: TemplateService
  ) {}

  @Post('/photo-swap')
  @UseGuards(AuthGuard, DevGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'firstImage', maxCount: 1 },
        { name: 'secondImage', maxCount: 1 },
      ],
      MULTER_OPTIONS_PUBLIC
    )
  )
  async swapPhotos(
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files: {
      firstImage: Express.Multer.File[];
      secondImage: Express.Multer.File[];
    }
  ) {
    if (!files.firstImage || !files.secondImage || !files) {
      throw new BadRequestException('you must upload images');
    }

    if ((await this.usersService.userCanTry(req.user._id)) === false) {
      throw new BadRequestException("you don't have any valid subscription.");
    }

    const swapResult = await this.faceSwapService.photoSwap(files.firstImage[0], files.secondImage[0], req.user._id);
    const finalUrl = `${PUBLIC_BASE_URL}/${swapResult.result}`;
    return {
      success: true,
      message: 'photos swapped successfully',
      result: finalUrl,
      historyId: swapResult.historyId,
    };
  }

  @Post('/template-photo-swap')
  @UseGuards(AuthGuard, DevGuard)
  @UseInterceptors(FileInterceptor('image', MULTER_OPTIONS_PUBLIC))
  async swapWithTemplatePhotos(@Req() req: RequestWithUser, @UploadedFile() image: Express.Multer.File, @Body('templateId') templateId: string) {
    if (!image) throw new BadRequestException('you must upload an image');
    if ((await this.usersService.userCanTry(req.user._id)) === false) {
      throw new BadRequestException("you don't have any valid subscription.");
    }
    const swapResult = await this.faceSwapService.templatePhotoSwap(image, templateId, req.user._id);
    const finalUrl = `${PUBLIC_BASE_URL}/${swapResult.result}`;
    return {
      success: true,
      message: 'photos swapped successfully',
      result: finalUrl,
      historyId: swapResult.historyId,
    };
  }

  @Post('/template-video-swap')
  @UseGuards(AuthGuard, DevGuard)
  @UseInterceptors(FileInterceptor('image', MULTER_OPTIONS_PUBLIC))
  async swapWithTemplateVideos(@Req() req: RequestWithUser, @UploadedFile() image: Express.Multer.File, @Body('templateId') templateId: string) {
    if (!image) throw new BadRequestException('you must upload an image');

    const template = await this.templateService.getTemplateWithDetails(templateId);
    if (!template) {
      throw new BadRequestException('template name is not valid');
    }
    const videoPath = join(VIDEO_TEMPLATES_BASE_PATH, template.file);

    const toBeConsumedCredits = await this.faceSwapService.creditsCalculator(videoPath);

    if (toBeConsumedCredits > req.user.videoCredits) {
      throw new BadRequestException('not enough credits');
    }
    const swapResult = await this.faceSwapService.templateVideoSwap(req.user._id, image, templateId);

    if (!swapResult) {
      return { success: false, jobId: null, historyId: null };
    }
    await this.usersService.updateCredits(req.user._id, req.user.videoCredits - toBeConsumedCredits);
    return { success: true, jobId: swapResult.jobId, historyId: swapResult.historyId };
  }

  @UseGuards(AuthGuard, DevGuard)
  @Post('/video-swap')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'video', maxCount: 1 },
      ],
      videoOptions
    )
  )
  async swapVideos(
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files: {
      image: Express.Multer.File[];
      video: Express.Multer.File[];
    }
  ) {
    if (!files.video || !files.image || !files) {
      throw new BadRequestException('you must upload image and video');
    }

    const toBeConsumedCredits = await this.faceSwapService.creditsCalculator(files.video[0].path);
    if (toBeConsumedCredits > req.user.videoCredits) {
      throw new BadRequestException('not enough credits');
    }
    const swapResult = await this.faceSwapService.videoSwapV2(req.user._id, files.image[0], files.video[0]);
    if (!swapResult) {
      return { success: false, jobId: null, historyId: null };
    }
    await this.usersService.updateCredits(req.user._id, req.user.videoCredits - toBeConsumedCredits);
    return { success: true, jobId: swapResult.jobId, historyId: swapResult.historyId };
  }

  @UseGuards(DevGuard, AuthGuard)
  @Get('/video/:jobId')
  async getVideoResult(@Req() req: RequestWithUser, @Param('jobId') jobId: string) {
    const result = await this.faceSwapService.getVideoResultV2(req.user._id, jobId);
    if (!result) {
      return { success: false, vidUrl: null, message: 'There is something wrong with the server', isLoading: false };
    }
    return result;
  }

  @UseGuards(AuthGuard, DevGuard)
  @Get('swap-history')
  async getUserSwapsHistory(@Req() req: RequestWithUser) {
    const swaps = await this.faceSwapService.getUserSwapsHistory(req.user._id);
    return {
      success: true,
      swaps,
    };
  }

  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Delete('/swap-history/:id')
  async deleteCreation(@Req() req: RequestWithUser, @Param('id') id: string) {
    const creations = await this.faceSwapService.deleteSwapHistoryItem(req.user._id, id);

    return { success: true, creations };
  }

  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Patch('/swap-history/:id')
  async addToHistory(@Req() req: RequestWithUser, @Param('id') id: string) {
    const creations = await this.faceSwapService.addToHistory(req.user._id, id);

    return { success: true, creations };
  }
}

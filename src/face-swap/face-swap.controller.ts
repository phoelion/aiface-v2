import { Controller, Post, ClassSerializerInterceptor, UseInterceptors, UploadedFiles, BadRequestException, Req, UseGuards, Param, Get, UploadedFile, Body } from '@nestjs/common';
import { FaceSwapService } from './face-swap.service';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { videoOptions } from './uploadImage.service';
import { ConfigService } from '@nestjs/config';
import { MULTER_OPTIONS_PUBLIC, PUBLIC_BASE_URL } from '../config/app-constants';
import { AuthGuard } from '../common/guards/auth.guard';
import { RequestWithUser } from '../common/interfaces/request-with-user';

import { DevGuard } from '../common/guards/dev.guard';

@Controller('face-swap')
@UseInterceptors(ClassSerializerInterceptor)
export class FaceSwapController {
  constructor(
    private readonly faceSwapService: FaceSwapService,
    private readonly configService: ConfigService
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

    const swapResult = await this.faceSwapService.photoSwap(files.firstImage[0], files.secondImage[0], req.user._id);
    const finalUrl = `${PUBLIC_BASE_URL}/${swapResult}`;
    return {
      success: true,
      message: 'photos swapped successfully',
      result: finalUrl,
    };
  }

  @Post('/template-photo-swap')
  @UseGuards(AuthGuard, DevGuard)
  @UseInterceptors(FileInterceptor('image', MULTER_OPTIONS_PUBLIC))
  async swapWithTemplatePhotos(@Req() req: RequestWithUser, @UploadedFile() image: Express.Multer.File, @Body('templateId') templateId: string) {
    if (!image) throw new BadRequestException('you must upload an image');

    const swapResult = await this.faceSwapService.templatePhotoSwap(image, templateId, req.user._id);
    const finalUrl = `${PUBLIC_BASE_URL}/${swapResult}`;
    return {
      success: true,
      message: 'photos swapped successfully',
      result: finalUrl,
    };
  }

  @Post('/template-video-swap')
  @UseGuards(AuthGuard, DevGuard)
  @UseInterceptors(FileInterceptor('image', MULTER_OPTIONS_PUBLIC))
  async swapWithTemplateVideos(@Req() req: RequestWithUser, @UploadedFile() image: Express.Multer.File, @Body('templateId') templateId: string) {
    if (!image) throw new BadRequestException('you must upload an image');

    const swapResult = await this.faceSwapService.templateVideoSwap(req.user._id, image, templateId);

    if (!swapResult) {
      return { success: false, jobId: null };
    }
    return { success: true, jobId: swapResult.jobId };
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

    const swapResult = await this.faceSwapService.videoSwapV2(req.user._id, files.image[0], files.video[0]);
    if (!swapResult) {
      return { success: false, jobId: null };
    }
    return { success: true, jobId: swapResult.jobId };
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
}

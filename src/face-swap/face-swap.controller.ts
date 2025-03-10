import { Controller, Post, ClassSerializerInterceptor, UseInterceptors, UploadedFiles, BadRequestException, Req, UseGuards, Body, Param, Get } from '@nestjs/common';
import { FaceSwapService } from './face-swap.service';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { multerOptions, videoOptions } from './uploadImage.service';
import { ConfigService } from '@nestjs/config';
import { MULTER_OPTIONS_PUBLIC } from '../config/app-constants';
import { AuthGuard } from '../common/guards/auth.guard';
import { RequestWithUser } from '../common/interfaces/request-with-user';
import { NotificationService } from '../notification/notification.service';
import { DevGuard } from '../common/guards/dev.guard';

@Controller('face-swap')
@UseInterceptors(ClassSerializerInterceptor)
export class FaceSwapController {
  constructor(
    private readonly faceSwapService: FaceSwapService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService
  ) {}

  @Post('/photo-swap')
  @UseGuards(AuthGuard, DevGuard)
  @UseInterceptors(FilesInterceptor('images', 2, MULTER_OPTIONS_PUBLIC))
  async swapPhotos(@Req() req: RequestWithUser, @UploadedFiles() images: Array<Express.Multer.File>) {
    const { user } = req;

    if (!images || images.length !== 2) throw new BadRequestException('you must upload images');

    const swapResult = await this.faceSwapService.photoSwap(images[0], images[1], user._id);
    const finalUrl = `${this.configService.get<string>('baseUrl')}/${swapResult}`;
    return {
      success: true,
      message: 'photos swapped successfully',
      result: finalUrl,
    };
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
    },
    @Body() body
  ) {
    let imageUrl, videoUrl;

    if (!files.video || !files.image || !files) {
      throw new BadRequestException('you must upload image and video');
    }

    imageUrl = `${this.configService.get<string>('BASE_URL')}/faceswap/${files.image[0].filename}`;
    videoUrl = `${this.configService.get<string>('BASE_URL')}/faceswap/${files.video[0].filename}`;

    const swapResult = await this.faceSwapService.videoSwapV2(req.user._id, files.image[0], files.video[0]);
    if (!swapResult) {
      return { success: false, jobId: null };
    }
    return { success: true, jobId: swapResult.jobId };
  }

  @UseGuards(DevGuard, JwtAuthenticationGuard)
  @Post('/video-test')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'video', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      videoOptions
    )
  )
  async uploadVideoTest(
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files: {
      image: Express.Multer.File[];
      video: Express.Multer.File[];
    },
    @Body() body
  ) {
    let imageUrl, videoUrl;
    // const vidFPs = await getVideoFPS(resolve(files.video[0].path));
    // const filename = files.video[0].filename.split('.')[0];
    // if (vidFPs > 49) {
    //   const result = await reduceFPS(resolve(files.video[0].path), resolve(files.video[0].destination, filename + '-reduced' + '.mp4'), 30);
    //   imageUrl = `${this.configService.get<string>('HTTPS_BASE_URL')}faceswap/${files.image[0].filename}`;
    //   videoUrl = `${this.configService.get<string>('HTTPS_BASE_URL')}faceswap/${filename + '-reduced' + '.mp4'}`;
    // } else {
    imageUrl = `${this.configService.get<string>('HTTPS_BASE_URL')}/faceswap/${files.image[0].filename}`;
    videoUrl = `${this.configService.get<string>('HTTPS_BASE_URL')}/faceswap/${files.video[0].filename}`;
    // }

    const swapResult = await this.faceSwapService.videoSwapTest(req.user.id, imageUrl, videoUrl);
    if (!swapResult) {
      return { success: false, jobId: null };
    }
    return { success: true, jobId: swapResult.jobId };
  }

  @UseGuards(DevGuard, JwtAuthenticationGuard)
  @Get('/video/:jobId')
  async getVideoResult(@Req() req: RequestWithUser, @Param('jobId') jobId: string) {
    const result = await this.faceSwapService.getVideoResultV2(req.user.id, jobId);
    if (!result) {
      return { success: false, vidUrl: null, message: 'There is something wrong with the server', isLoading: false };
    }
    return result;
  }

  @Post('/aiface')
  @UseGuards(JwtAuthenticationGuard)
  @UseInterceptors(FilesInterceptor('images', 1, multerOptions))
  async updateAiface(@Req() req: RequestWithUser, @UploadedFiles() images: Array<Express.Multer.File>) {
    const { user } = req;
    const { tempId } = req.body;

    if (!images || images.length !== 1) throw new BadRequestException('you must upload images');
    const fileNames = images.map((el) => {
      return el.filename;
    });

    const swapResult = await this.faceSwapService.updateAiface(fileNames, user.id, true, user.email, tempId);
    return {
      success: true,
      message: 'photos swapped successfully',
      result: swapResult,
    };
  }
}

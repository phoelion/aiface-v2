import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

import { TemplateService } from 'src/template/template.service';

import { extname, join } from 'path';

import { access } from 'fs/promises';
import * as fs from 'fs';
import { NotificationService } from '../notification/notification.service';
import { UsersService } from '../users/users.service';
import { NovitaService } from './novita.service';
import { MessagesEnum } from '../notification/enums/messages.enum';
import { SwapTypesEnum } from '../users/enums/swap-types.enum';
import { RequestStatusesEnum } from '../users/enums/request-statuses.enum';
import { audioExtractor, compressImage, newFpsReducer } from '../shared/utils/ffmpeg';
import { FPS } from '../config/app-constants';

const { getVideoDurationInSeconds } = require('get-video-duration');

@Injectable()
export class FaceSwapService {
  constructor(
    private readonly templateService: TemplateService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly userService: UsersService,
    private readonly novitaService: NovitaService
  ) {}

  private async photoSwapLogAndNotificationHandler(userId: string, firstImageName: string, secondImageName: string, status: RequestStatusesEnum, result: string, message?: string) {
    const toBeSendMessage =
      status === RequestStatusesEnum.SUCCESS ? MessagesEnum.SUCCESS_SWAP.replace('{{user}}', userId) : MessagesEnum.FAILED_SWAP.replace('{{user}}', userId).replace('{{reason}}', message);

    await this.notificationService.sendNotification(toBeSendMessage);
    await this.userService.createHistory(userId, null, null, firstImageName, secondImageName, result, SwapTypesEnum.IMAGE, status);
  }

  private async videoSwapLogAndNotificationHandler(
    userId: string,
    imageName: string,
    videoName: string,
    jobId: string,
    templateId: string,
    result: string,
    status: RequestStatusesEnum,
    message?: string
  ) {
    //TODO: handle messages
    let toBeSendMessage;
    if (status === RequestStatusesEnum.INIT) {
      toBeSendMessage = '';
    } else if (status === RequestStatusesEnum.SUCCESS) {
      toBeSendMessage = '';
    } else if (status === RequestStatusesEnum.FAILED) {
      toBeSendMessage = '';
    }

    await this.notificationService.sendNotification(toBeSendMessage);
    await this.userService.createHistory(userId, jobId, templateId, imageName, videoName, result, SwapTypesEnum.VIDEO, status);
  }

  private async checkFileExists(filePath: string) {
    try {
      await access(filePath);
      return true;
    } catch (err) {
      return false;
    }
  }

  private imageToBase64(filePath: string): string {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const base64String = imageBuffer.toString('base64');

      // Determine the image MIME type
      const extensionName = extname(filePath).toLowerCase();
      let mimeType: string;

      switch (extensionName) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.png':
          mimeType = 'image/png';
          break;
        case '.gif':
          mimeType = 'image/gif';
          break;
        case '.bmp':
          mimeType = 'image/bmp';
          break;
        case '.webp':
          mimeType = 'image/webp';
          break;
        default:
          throw new Error('Unsupported file type');
      }

      return `data:${mimeType};base64,${base64String}`; // Return complete data URL
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  }

  private async videoCreditCalculator(videoPath: string): Promise<number> {
    const duration = await getVideoDurationInSeconds(videoPath);
    let toBeConsumedCredits;
    if (duration < 10) {
      toBeConsumedCredits = 10;
    } else {
      toBeConsumedCredits = Math.ceil(duration);
    }
    return toBeConsumedCredits;
  }

  async photoSwap(sourceImage: Express.Multer.File, targetImage: Express.Multer.File, userId: string) {
    try {
      const user = await this.userService.getUser(userId);

      if (!user) throw new NotFoundException('user not found');

      const { data } = await axios.post(
        this.configService.get<string>('FACESWAP_URL'),
        {
          image_1: sourceImage.filename,
          image_2: targetImage.filename,
          watermark: 'false',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      if (data.success === 'false') {
        await this.photoSwapLogAndNotificationHandler(userId, sourceImage.filename, targetImage.filename, RequestStatusesEnum.FAILED, null, data.message);
        throw new BadRequestException(data.message ? data.message : '');
      } else {
        await this.photoSwapLogAndNotificationHandler(userId, sourceImage.filename, targetImage.filename, data.result, RequestStatusesEnum.SUCCESS);
        return data.result;
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        await this.photoSwapLogAndNotificationHandler(userId, sourceImage.filename, targetImage.filename, RequestStatusesEnum.FAILED, null, 'ECONNREFUSED');
        throw new InternalServerErrorException();
      }
      if (error.name === 'AxiosError') {
        await this.photoSwapLogAndNotificationHandler(userId, sourceImage.filename, targetImage.filename, RequestStatusesEnum.FAILED, null, 'AxiosError');
        throw new BadRequestException();
      }
      throw new BadRequestException(error);
    }
  }

  async getVideoResult(userId: string, jobId: string) {
    const user = await this.userService.findById(userId);
    if (!user.videoSwapIds.includes(jobId)) {
      return false;
    }
    const res = await getVideoResult(jobId);
    if (res && res.success && res.vidUrl !== null) {
      const externalFileName = res.vidUrl.split('/').at(-1);
      const dnPath = join(__dirname, '..', '..', 'aiface', 'faceswap', 'mastmoosir', externalFileName);
      const fileExists = await this.checkFileExists(dnPath);

      if (!fileExists) {
        Logger.log(`[+] Downloading: ${res.vidUrl}`);
        try {
          await downloadFile(res.vidUrl, dnPath);
        } catch (error) {
          console.log(error);
        }
      }

      const resPath = this.configService.get<string>('HTTPS_BASE_URL') + '/' + join('faceswap', 'mastmoosir', externalFileName);
      const videoDuration = await this.videoCreditCalculator(dnPath);
      const little = videoDuration % 10 > 0 ? 10 : 0;
      const toBeConsumedCredits = Math.floor(videoDuration / 10) * 10 + little;
      await this.userService.addResultVideoUrl(jobId, { resultVideo: resPath });
      await this.notificationService.messenger(Messages.successfulVideoSwap(`${user._id}`, user.videoSwapIds.length, toBeConsumedCredits));

      res.vidUrl = resPath;
    }
    if (!res || !res.success) {
      await this.notificationService.messenger(Messages.failedVideoSwap(`${user._id}`, user.try));
    }

    return res;
  }

  public async creditsCalculator(videoPath: string) {
    const duration = await getVideoDurationInSeconds(videoPath);

    return Math.round(duration);
  }

  async videoSwapV2(userId: string, imageFile: Express.Multer.File, videoFile: Express.Multer.File) {
    const imageUrl = `${this.configService.get<string>('baseUrl')}/${imageFile.filename}`;
    const videoUrl = `${this.configService.get<string>('baseUrl')}/${videoFile.filename}`;

    let result;
    result = await this.normalVideoSwap(imageFile, videoFile);

    //TODO: handle failed initial generates
    await this.videoSwapLogAndNotificationHandler(userId, imageFile.filename, videoFile.filename, result.jobId, null, null, RequestStatusesEnum.INIT);
    return { jobId: result.jobId };
  }

  async normalVideoSwap(sourceImage: Express.Multer.File, targetVideo: Express.Multer.File) {
    const videoName = targetVideo.filename;
    const imageName = sourceImage.filename;

    const videoPath = targetVideo.path;
    const audioOutputPath = join(targetVideo.destination, videoName.split('.')[0] + '.mp3');
    const reducedFPSVideo = join(targetVideo.destination, videoName.split('.')[0] + '_reduced' + '.mp4');
    const sourceImagePath = sourceImage.path;

    const resizedImageOutputPath = sourceImage.destination;

    const resizedImage = await compressImage(sourceImagePath, resizedImageOutputPath, imageName);
    const res = await newFpsReducer(videoPath, FPS, reducedFPSVideo);
    await audioExtractor(videoPath, audioOutputPath);

    fs.unlinkSync(videoPath);

    const videoAssetId = await this.novitaService.getVideoAssetId(reducedFPSVideo);
    const encoded = this.imageToBase64(join(resizedImageOutputPath, `${resizedImage}`));

    const { task_id: jobId } = await this.novitaService.getJobId(videoAssetId, encoded);
    return {
      jobId: jobId,
      videoName: videoName.split('.')[0],
    };
  }

  async getVideoResultV2(userId: string, jobId: string) {
    try {
      const user = await this.userService.getUser(userId);
      const prevResult = await this.userRequestModel.findOne({ jobId, user: userId }).populate('templateId');
      const videoName = user.videoSwaps.filter((el) => el.jobId === jobId);
      const res = await this.getResult(jobId, videoName[0].videoName);
      if (!res.isLoading && res.success) {
        const tmp = await this.userService.updateVideoStatus(userId, videoName[0].videoName);
        await this.userService.createUserRequest('video', userId, jobId, '', res.vidUrl, 'success');
        await this.notificationService.messenger(MessagesEnum.Swap_Result.replace('{{id}}', userId));
      }
      if (res.success === false && res.vidUrl === null) {
        await this.notificationService.messenger(MessagesEnum.Swap_Result_Error.replace('{{id}}', userId));
        await this.userService.createUserRequest('video', userId, jobId, JSON.stringify(res), res.vidUrl, 'failed');
      }
      return { ...res, videoName: videoName[0].videoName };
    } catch (error) {
      console.log(error);
      // throw new BadRequestException();
    }
  }

  async getResult(jobId: string, videoName: string): Promise<IVideoResult> {
    try {
      const result = await this.novitaService.getResult(jobId);

      // // step 1 : prepare raw video
      const resultName = 'result_' + videoName + '.mp4';
      if (result?.vidUrl !== null) {
        const dnPath = join(__dirname, '..', '..', 'aiface', 'faceswap', resultName);
        const fileExists = await this.checkFileExists(dnPath);

        if (!fileExists) {
          Logger.log(`[+] Downloading: ${result.vidUrl}`);
          try {
            await downloadFile(result.vidUrl, dnPath);
          } catch (error) {
            console.log(error);
          }
        }

        const finalName = 'final_' + resultName;
        let rawFilePath, audioPath;

        rawFilePath = join(__dirname, '..', '..', 'aiface', 'faceswap', resultName);
        audioPath = join(__dirname, '..', '..', 'aiface', 'faceswap', videoName + '.mp3');

        const outputPath = join(__dirname, '..', '..', 'aiface', 'faceswap', finalName);

        // step 2 : add audio to it
        const finalNameExists = await this.checkFileExists(outputPath);
        let finalResult;
        if (!finalNameExists) {
          finalResult = await videoAudioMerger(rawFilePath, audioPath, outputPath);
        }
        const resPath = this.configService.get<string>('HTTPS_BASE_URL') + '/' + join('faceswap', finalName);
        result.vidUrl = resPath;
      }
      return result;
    } catch (error) {
      console.log(error);
      return { success: false, vidUrl: null, message: 'There is something wrong with the server', isLoading: false };
    }
  }
}

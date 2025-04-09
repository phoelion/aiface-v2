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
import { audioExtractor, compressImage, imageToBase64, newFpsReducer, videoAudioMerger } from '../shared/utils/file.service';
import { FPS, LOADING_VIDEO_URL, PHOTO_TEMPLATES_BASE_PATH, PUBLIC_BASE_URL, VIDEO_TEMPLATES_BASE_PATH } from '../config/app-constants';
import { IVideoResult } from './interfaces/video-result';
import { downloadFile } from '../shared/utils/downloader';
import { TemplateTypeEnum } from '../template/enums/template-type.enum';
import * as path from 'node:path';
import { UserRequests } from 'src/users/schema/user-requests.schema';
import { IHistoryItem } from './interfaces/history-item.interface';
import { User } from 'src/users/schema/user.schema';

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

  private async photoSwapLogAndNotificationHandler(user: User, firstImageName: string, secondImageName: string, templateId = null, status: RequestStatusesEnum, result: string, message?: string) {
    const toBeSendMessage =
      status === RequestStatusesEnum.SUCCESS ? MessagesEnum.SUCCESS_SWAP.replace('{{user}}', user._id) : MessagesEnum.FAILED_SWAP.replace('{{user}}', user._id).replace('{{reason}}', message);
    console.log(user, user.autoAddToHistory);
    await this.notificationService.sendNotification(toBeSendMessage);
    return this.userService.createHistory(user._id, null, templateId, firstImageName, secondImageName, result, SwapTypesEnum.IMAGE, status, user.autoAddToHistory);
  }

  private async photoSwapLogAndNotificationHandlerWithUserId(
    userId: string,
    firstImageName: string,
    secondImageName: string,
    templateId = null,
    status: RequestStatusesEnum,
    result: string,
    message?: string
  ) {
    const user = await this.userService.getUser(userId);
    const toBeSendMessage =
      status === RequestStatusesEnum.SUCCESS ? MessagesEnum.SUCCESS_SWAP.replace('{{user}}', user._id) : MessagesEnum.FAILED_SWAP.replace('{{user}}', user._id).replace('{{reason}}', message);

    await this.notificationService.sendNotification(toBeSendMessage);

    await this.userService.createHistory(user._id, null, templateId, firstImageName, secondImageName, result, SwapTypesEnum.IMAGE, status, user.autoAddToHistory);
  }

  private async videoSwapLogAndNotificationHandler(user: User, imageName: string, videoName: string, jobId: string, templateId: string, result: string, status: RequestStatusesEnum, message?: string) {
    //TODO: handle messages
    let toBeSendMessage;
    if (status === RequestStatusesEnum.INIT) {
      toBeSendMessage = MessagesEnum.NORMAL_SWAP.replace('{{id}}', user._id);
    } else if (status === RequestStatusesEnum.SUCCESS) {
      toBeSendMessage = MessagesEnum.SWAP_RESULT.replace('{{id}}', user._id);
    } else if (status === RequestStatusesEnum.FAILED) {
      toBeSendMessage = toBeSendMessage = MessagesEnum.FAILED_SWAP.replace('{{user}}', user._id);
    }

    await this.notificationService.sendNotification(toBeSendMessage);
    return this.userService.createHistory(user._id, jobId, templateId, imageName, videoName, result, SwapTypesEnum.VIDEO, status, user.autoAddToHistory);
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
        case '.heic':
        case '.heif':
          mimeType = 'image/heic';
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

  private prepareFinalResult(vidUrl: string, message: string, jobId: string) {
    return {
      success: true,
      isLoading: false,
      vidUrl,
      message,
      jobId,
    };
  }

  base64ToImage(base64String: string, outputPath: string): void {
    try {
      // Extract base64 data (remove metadata like 'data:image/png;base64,')
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Write the buffer to a file
      fs.writeFileSync(outputPath, imageBuffer);

      console.log(`Image saved at ${outputPath}`);
    } catch (error) {
      console.error('Error converting Base64 to image:', error);
      throw error;
    }
  }

  async templatePhotoSwap(sourceImage: Express.Multer.File, templateId: string, userId: string) {
    try {
      const user = await this.userService.getUser(userId);

      if (!user) throw new NotFoundException('user not found');

      const template = await this.templateService.findTemplateById(templateId);

      if (!template || template.type !== TemplateTypeEnum.IMAGE.toString()) {
        throw new BadRequestException('Template is not valid');
      }

      const { data } = await axios.post(
        this.configService.get<string>('FACESWAP_URL'),
        {
          image_1: sourceImage.filename,
          image_2: template.file,
          directory: 'templates/photo',
          watermark: 'false',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      if (data.success === 'false') {
        await this.photoSwapLogAndNotificationHandler(user, sourceImage.filename, template.file, template.id, RequestStatusesEnum.FAILED, null, data.message);
        throw new BadRequestException(data.message ? data.message : '');
      } else {
        const history = await this.photoSwapLogAndNotificationHandler(user, sourceImage.filename, template.file, template.id, RequestStatusesEnum.SUCCESS, data.result);
        return {
          result: data.result,
          historyId: history.id,
        };
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        await this.photoSwapLogAndNotificationHandlerWithUserId(userId, sourceImage.filename, null, templateId, RequestStatusesEnum.FAILED, null, 'ECONNREFUSED');
        throw new InternalServerErrorException();
      }
      if (error.name === 'AxiosError') {
        await this.photoSwapLogAndNotificationHandlerWithUserId(userId, sourceImage.filename, null, templateId, RequestStatusesEnum.FAILED, null, 'AxiosError');
        throw new BadRequestException();
      }
      throw new BadRequestException(error);
    }
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
          directory: '',
          watermark: 'false',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (data.success === 'false') {
        await this.photoSwapLogAndNotificationHandler(user, sourceImage.filename, targetImage.filename, null, RequestStatusesEnum.FAILED, null, data.message);
        throw new BadRequestException(data.message ? data.message : '');
      } else {
        const history = await this.photoSwapLogAndNotificationHandler(user, sourceImage.filename, template.file, template.id, RequestStatusesEnum.SUCCESS, data.result);
        return {
          result: data.result,
          historyId: history.id,
        };
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        await this.photoSwapLogAndNotificationHandlerWithUserId(userId, sourceImage.filename, targetImage.filename, RequestStatusesEnum.FAILED, null, 'ECONNREFUSED');
        throw new InternalServerErrorException();
      }
      if (error.name === 'AxiosError') {
        await this.photoSwapLogAndNotificationHandlerWithUserId(userId, sourceImage.filename, targetImage.filename, RequestStatusesEnum.FAILED, null, 'AxiosError');
        throw new BadRequestException();
      }
      throw new BadRequestException(error);
    }
  }

  public async creditsCalculator(videoPath: string) {
    const duration = await getVideoDurationInSeconds(videoPath);

    return Math.round(duration);
  }

  async templateVideoSwap(userId: string, sourceImage: Express.Multer.File, templateId: string) {
    const user = await this.userService.getUser(userId);
    const template = await this.templateService.findTemplateById(templateId);

    if (!template || template.type !== TemplateTypeEnum.VIDEO.toString()) {
      throw new BadRequestException('Template is not valid');
    }
    const targetVideo = {
      filename: template.file,
      path: VIDEO_TEMPLATES_BASE_PATH + '/' + template.file,
      destination: VIDEO_TEMPLATES_BASE_PATH,
    };

    const videoName = targetVideo.filename;
    const imageName = sourceImage.filename;

    const videoPath = targetVideo.path;
    const audioOutputPath = join(__dirname, '..', '..', 'public', videoName.split('.')[0] + '.mp3');
    const reducedFPSVideo = join(__dirname, '..', '..', 'public', videoName.split('.')[0] + '_reduced' + '.mp4');
    const sourceImagePath = sourceImage.path;

    const resizedImageOutputPath = sourceImage.destination;

    const resizedImage = await compressImage(sourceImagePath, resizedImageOutputPath, imageName);
    const res = await newFpsReducer(videoPath, FPS, reducedFPSVideo);
    await audioExtractor(videoPath, audioOutputPath);

    const videoAssetId = await this.novitaService.getVideoAssetId(reducedFPSVideo);
    const encoded = this.imageToBase64(join(resizedImageOutputPath, `${resizedImage}`));

    const { task_id: jobId } = await this.novitaService.getJobId(videoAssetId, encoded);

    const history = await this.videoSwapLogAndNotificationHandler(user, sourceImage.filename, template.file, jobId, templateId, null, RequestStatusesEnum.INIT);
    return {
      jobId: jobId,
      videoName: videoName.split('.')[0],
      historyId: history.id,
    };
  }

  async videoSwapV2(userId: string, imageFile: Express.Multer.File, videoFile: Express.Multer.File) {
    let result;
    result = await this.normalVideoSwap(imageFile, videoFile);
    const user = await this.userService.getUser(userId);

    const history = await this.videoSwapLogAndNotificationHandler(user, imageFile.filename, videoFile.filename, result.jobId, null, null, RequestStatusesEnum.INIT);
    return {
      jobId: result.jobId,

      historyId: history.id,
    };
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
    let finalResult;
    const user = await this.userService.getUser(userId);
    const prevResult = await this.userService.getVideoResult(userId, jobId);

    if (!prevResult) throw new BadRequestException('user id or jobId is not valid');

    if (prevResult.result?.length > 0) {
      finalResult = this.prepareFinalResult(prevResult.result, 'Video is ready', prevResult.jobId);
    } else {
      const videoName = prevResult.secondFile.split('.')[0];
      const res = await this.prepareApiResult(jobId, videoName);

      if (!res.isLoading && res.success) {
        await this.userService.updateVideoStatus(userId, jobId, res.vidUrl, RequestStatusesEnum.SUCCESS);
        await this.notificationService.sendNotification(MessagesEnum.RESULT.replace('{{id}}', userId));
      }
      if (res.success === false && res.vidUrl === null) {
        await this.userService.updateVideoStatus(userId, jobId, res.vidUrl, RequestStatusesEnum.FAILED);
        await this.notificationService.sendNotification(MessagesEnum.FAILED_SWAP.replace('{{user}}', userId).replace('{{reason}}', res.error.reason));
      }
      finalResult = res;
    }
    delete finalResult['error'];
    return finalResult;
  }

  async prepareApiResult(jobId: string, videoName: string, error?): Promise<IVideoResult> {
    try {
      const result = await this.novitaService.getResult(jobId);

      const resultName = 'result_' + videoName + '.mp4';
      if (result?.vidUrl !== null) {
        const dnPath = join(__dirname, '..', '..', 'public', resultName);
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

        rawFilePath = join(__dirname, '..', '..', 'public', resultName);
        audioPath = join(__dirname, '..', '..', 'public', videoName + '.mp3');

        const outputPath = join(__dirname, '..', '..', 'public', finalName);

        // step 2 : add audio to it
        const finalNameExists = await this.checkFileExists(outputPath);

        if (!finalNameExists) {
          await videoAudioMerger(rawFilePath, audioPath, outputPath);
        }
        result.vidUrl = this.configService.get<string>('baseUrl') + '/' + join('public', finalName);
      }

      return result;
    } catch (error) {
      console.log(error);
      return {
        success: false,
        vidUrl: null,
        error: error,
        message: 'There is something wrong with the server',
        isLoading: false,
      };
    }
  }

  async prepareVideoHistory(history: UserRequests): Promise<IHistoryItem> {
    try {
      let res: IVideoResult;
      if (history.result !== null) {
        res = this.prepareFinalResult(history.result, 'video is ready', history.jobId);
      } else {
        res = await this.getVideoResultV2(history.user._id, history.jobId);

        if (res.success && res.isLoading) {
          res.vidUrl = LOADING_VIDEO_URL;
        }
      }
      let result: IHistoryItem = {
        id: history.id,
        resultUrl: res.vidUrl,
        message: res.message,
        type: history.type,
        isLoading: res.isLoading,
        success: res.success,
      };

      return result;
    } catch (error) {
      console.log(error);
    }
  }

  async prepareImageHistory(history: UserRequests): Promise<IHistoryItem> {
    const result: IHistoryItem = {
      id: history.id,
      resultUrl: `${PUBLIC_BASE_URL}/${history.result}`,
      message: 'image is ready',
      type: history.type,
      isLoading: false,
      success: history.status == RequestStatusesEnum.SUCCESS,
    };
    return result;
  }

  async getUserSwapsHistory(userId: string) {
    const histories = await this.userService.getUserSwaps(userId);

    let finalResults = [];

    for (let history of histories) {
      let result: IHistoryItem;
      if (history.type == SwapTypesEnum.VIDEO) result = await this.prepareVideoHistory(history);
      else if (history.type == SwapTypesEnum.IMAGE) result = await this.prepareImageHistory(history);

      finalResults.push(result);
    }

    return finalResults;
  }

  async deleteSwapHistoryItem(userId: string, id: string) {
    return this.userService.deleteUserHistoryItem(userId, id);
  }

  async addToHistory(userId: string, id: string) {
    return this.userService.addToHistory(userId, id);
  }
}

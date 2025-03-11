import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { createReadStream } from 'fs';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class NovitaService {
  private apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    // private readonly logger = new Logger(NovitaService.name)
    this.apiKey = this.configService.get<string>('NOVITA_API_KEY');
  }

  async getVideoAssetId(videoPath: string) {
    const url = this.configService.get<string>('NOVITA_VIDEO_ASSET_ID_URL');
    const videoData = createReadStream(videoPath);
    const { data } = await firstValueFrom(
      this.httpService.put(url, videoData).pipe(
        catchError((error: AxiosError) => {
          console.log(error.response.data);
          throw new InternalServerErrorException();
        })
      )
    );
    return data.assets_id;
  }

  async getJobId(videoAssetId: string, base64Image: string) {
    const url = this.configService.get<string>('NOVITA_VIDEO_MERGE_FACE');

    const requestData = {
      extra: {
        response_video_type: 'mp4',
      },
      request: {
        video_assets_id: videoAssetId,
        face_image_base64: base64Image,
      },
    };
    const { data } = await firstValueFrom(
      this.httpService.post(url, requestData, { headers: { Authorization: `Bearer ${this.apiKey}` } }).pipe(
        catchError((error: AxiosError) => {
          console.log(error.response.data);
          throw new InternalServerErrorException();
        })
      )
    );
    return data;
  }

  private resultResponseHandler(faceSwapStatus: string, vidUrl: string) {
    switch (faceSwapStatus) {
      case 'TASK_STATUS_QUEUED':
        return {
          success: true,
          isLoading: true,
          vidUrl: null,
          message: 'Video is in Queue',
        };

      case 'TASK_STATUS_PROCESSING':
        return {
          success: true,
          isLoading: true,
          vidUrl: null,
          message: 'Video is Processing',
        };
        break;
      case 'TASK_STATUS_SUCCEED':
        return {
          success: true,
          isLoading: false,
          vidUrl,
          message: 'Video is ready',
        };
      case 'TASK_STATUS_FAILED':
        return {
          success: false,
          isLoading: false,
          vidUrl: null,
          message: 'Video swap failed',
        };
    }
  }

  async getResult(jobId: string) {
    const url = this.configService.get<string>('NOVITA_VIDEO_RESULT');

    const { data } = await firstValueFrom(
      this.httpService.get(`${url}${jobId}`, { headers: { Authorization: `Bearer ${this.apiKey}` } }).pipe(
        catchError((error: AxiosError) => {
          throw error.response.data;
        })
      )
    );

    const finalResult = this.resultResponseHandler(data.task.status, data.videos[0]?.video_url);
    return finalResult;
  }
}

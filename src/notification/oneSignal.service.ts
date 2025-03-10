import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom } from 'rxjs';

@Injectable()
export class OneSignalService {
  private apiKey: string;
  private apiUrl: string;
  private appId: string;
  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.appId = this.configService.get<string>('ONE_SIGNAL_APP_ID');
    this.apiKey = this.configService.get<string>('ONE_SIGNAL_REST_API_KEY');
    this.apiUrl = this.configService.get<string>('ONE_SIGNAL_NOTIFICATION_URL');
  }

  async sendNotificationToSpecificUser(userId: string, message: string, title: string) {
    const { data } = await firstValueFrom(
      this.httpService
        .post(
          this.apiUrl,
          {
            app_id: this.appId,
            headings: { en: title },
            contents: { en: message },
            target_channel: 'push',
            include_external_user_ids: [userId],
          },
          { headers: { accept: 'application/json', 'content-type': 'application/json', Authorization: `Basic ${this.apiKey}` } }
        )
        .pipe(
          catchError((error: AxiosError) => {
            console.log(error.response.data);
            throw 'An error happened!';
          })
        )
    );
    return data;
  }
  async sendNotificationToAllSubscriptions(message: string, title: string) {
    const { data } = await firstValueFrom(
      this.httpService
        .post(
          this.apiUrl,
          {
            app_id: this.appId,
            headings: { en: title },
            contents: { en: message },
            target_channel: 'push',
            included_segments: ['HandySegments'],
          },
          { headers: { accept: 'application/json', 'content-type': 'application/json', Authorization: `Basic ${this.apiKey}` } }
        )
        .pipe(
          catchError((error: AxiosError) => {
            console.log(error.response.data);
            throw 'An error happened!';
          })
        )
    );
    console.log(data);
    return data;
  }
  async sendNotificationToListOfUsers(userIds: string[], message: string) {
    const { data } = await firstValueFrom(
      this.httpService
        .post(
          this.apiUrl,
          {
            app_id: this.appId,
            contents: { en: message },
            target_channel: 'push',
            include_external_user_ids: userIds,
          },
          { headers: { accept: 'application/json', 'content-type': 'application/json', Authorization: `Basic ${this.apiKey}` } }
        )
        .pipe(
          catchError((error: AxiosError) => {
            console.log(error.response.data);
            throw 'An error happened!';
          })
        )
    );
    return data;
  }
}

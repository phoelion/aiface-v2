import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context } from 'grammy';

@Injectable()
export class TelegramService {
  private bot: Bot<Context>;
  constructor(private readonly configService: ConfigService) {
    this.bot = new Bot<Context>(this.configService.get<string>('TELEGRAM_BOT_TOKEN'));
  }

  private addEnvironmentToMessage(message:string) {
    return message + '\n' + `#environment: ${this.configService.get<string>('NODE_ENV')}`;
  }

  public async messenger(message: string, threadId = this.configService.get<number>('DAILY_LOGS_THID')): Promise<number> {
    try {
      const messageWithEnvironment = this.addEnvironmentToMessage(message);
      const result = await this.bot.api.sendMessage(this.configService.get<string>('SUPERGROUP_ID'), messageWithEnvironment, { message_thread_id: threadId });
      Logger.log('Notification has been sent successfully');
      return result.message_id;
    } catch (error) {
      Logger.error(error);
    }
  }


  public async messageEditor(messageId: number, message: string, threadId = this.configService.get<number>('DAILY_LOGS_THID')) {
    const messageWithEnvironment = this.addEnvironmentToMessage(message);
    this.bot.api
      .editMessageText(this.configService.get<string>('SUPERGROUP_ID'), messageId, messageWithEnvironment)
      .then((res) => {
        Logger.log('Notification has been sent successfully');
      })
      .catch((error) => Logger.error(error));
  }
  public async sendPurchase(message: string, threadId = this.configService.get<number>('PURCHASE_THID')) {
    const messageWithEnvironment = this.addEnvironmentToMessage(message);
    this.bot.api
      .sendMessage(this.configService.get<string>('SUPERGROUP_ID'), messageWithEnvironment, { message_thread_id: threadId })
      .then((res) => {
        Logger.log('Notification has been sent successfully');
      })
      .catch((error) => Logger.error(error));
  }

  public async sendCrit(message: string): Promise<number> {
    try {
      const messageWithEnvironment = this.addEnvironmentToMessage(message) + '\n platform: IOS';
      const result = await this.bot.api.sendMessage(this.configService.get<string>('SUPERGROUP_ID'), messageWithEnvironment, {
        message_thread_id: this.configService.get<number>('CRITICAL_SITUATION_THID'),
      });
      Logger.log('Notification has been sent successfully');
      return result.message_id;
    } catch (error) {
      Logger.error(error);
    }
  }
  //
  public async senCriticalMessage(message: string) {
    const messageWithEnvironment = this.addEnvironmentToMessage(message);
    this.bot.api
      .sendMessage(this.configService.get<string>('SUPERGROUP_ID'), messageWithEnvironment, { message_thread_id: this.configService.get<number>('CRITICAL_SITUATION_THID') })
      .then((res) => {
        Logger.log('Notification has been sent successfully');
      })
      .catch((error) => Logger.error(error));
  }
  //
  public async sendTemp(message: string) {
    const messageWithEnvironment = this.addEnvironmentToMessage(message);
    this.bot.api
      .sendMessage(this.configService.get<string>('SUPERGROUP_ID'), messageWithEnvironment, { message_thread_id: this.configService.get<number>('TEMP_THID') })
      .then((res) => {
        Logger.log('Notification has been sent successfully');
      })
      .catch((error) => Logger.error(error));
  }
}

import { Injectable } from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';
import { MessagesEnum } from './enums/messages.enum';
import { OneSignalService } from './oneSignal.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly oneSignalService: OneSignalService,
    private readonly configService: ConfigService
  ) {}

  async sendNotification(message: string): Promise<number> {
    return this.telegramService.messenger(message);
  }

  async sendContactUs(message: string): Promise<number> {
    return this.telegramService.messenger(message, this.configService.get<number>('CONTACT_US_THID'));
  }

  async sendCriticalNotification(message: string): Promise<number> {
    return this.telegramService.sendCrit(message);
  }

  async editPrevNotification(messageId: number, message: string) {
    return this.telegramService.messageEditor(messageId, message);
  }

  async sendPurchase(userId, productId) {
    const generalMessage = MessagesEnum.PURCHASE.replace('{{id}}', userId).replace('{{plan}}', productId);
    const message = MessagesEnum.GENERAL_PURCHASE.replace('{{plan}}', productId);
    await this.telegramService.sendPurchase(message);
    await this.sendNotification(generalMessage);
  }

  async sendNotificationToListOfUsers(userIds: string[], message: string) {
    return this.oneSignalService.sendNotificationToListOfUsers(userIds, message);
  }
}

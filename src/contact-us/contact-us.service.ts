import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ContactUs } from './schema/contact-us.schema';
import { Model } from 'mongoose';
import { CreateContactUsDto } from './dtos/create-contact-us.dto';

import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';
import { MessagesEnum } from '../notification/enums/messages.enum';

@Injectable()
export class ContactUsService {
  constructor(
    @InjectModel(ContactUs.name) private contactUsModel: Model<ContactUs>,
    private configService: ConfigService,
    private readonly notificationService: NotificationService
  ) {}

  async create(user: string, createContactUsDto: CreateContactUsDto) {
    await this.notificationService.sendContactUs(MessagesEnum.CONTACT_US.replace('{{user}}', user).replace('{{message}}', createContactUsDto.message));

    return this.contactUsModel.create({ user, ...createContactUsDto });
  }

  async getAll(params?: ContactUs) {
    return this.contactUsModel.find(params);
  }
}

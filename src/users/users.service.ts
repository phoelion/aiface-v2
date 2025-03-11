import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { User } from './schema/user.schema';
import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationService } from 'src/notification/notification.service';
import { UserRequests } from './schema/user-requests.schema';
import { RequestStatusesEnum } from './enums/request-statuses.enum';
import { SwapTypesEnum } from './enums/swap-types.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(UserRequests.name) private userRequestsModel: Model<UserRequests>,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService
  ) {}

  async create(data: Partial<User>) {
    return this.userModel.create(data);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async findOne(params) {
    return this.userModel.findOne(params);
  }

  async findById(id: string, select?: string) {
    return this.userModel.findById(id).select(select);
  }

  async updateOne(id: string, data: any) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('user not found');
    return this.userModel.updateOne({ id }, data);
  }

  private prepareFinalResult(vidUrl: string, message: string) {
    return {
      success: true,
      isLoading: false,
      vidUrl,
      message,
    };
  }

  public async getUser(id: string): Promise<User> {
    return this.userModel.findById(id);
  }

  public async createHistory(userId: string, jobId: string, templateId: string, firstFile: string, secondFile: string, result: string, type: SwapTypesEnum, status: RequestStatusesEnum) {
    return this.userRequestsModel.create({
      user: userId,
      jobId,
      templateId,
      firstFile,
      secondFile,
      result,
      type,
      status,
    });
  }

  async getVideoResult(userId: string, jobId: string) {
    return this.userRequestsModel
      .findOne({
        jobId,
        user: userId,
        type: SwapTypesEnum.VIDEO,
      })
      .populate('templateId');
  }

  async updateVideoStatus(userId: string, jobId: string, result: string, status: RequestStatusesEnum) {
    await this.userRequestsModel.updateOne({ user: userId, jobId }, { result, status });
  }
}

import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from './schema/user.schema';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  public async getUser(id: string): Promise<UserDocument> {
    return this.userModel.findById(id);
  }
  public async getUserByUsername(username: string): Promise<UserDocument> {
    return this.userModel.findOne({ username });
  }

  public async createHistory(
    userId: string,
    jobId: string,
    templateId: string,
    firstFile: string,
    secondFile: string,
    result: string,
    type: SwapTypesEnum,
    status: RequestStatusesEnum,
    addedToUserHistory: boolean,
    thumbnailImage: string
  ) {
    return this.userRequestsModel.create({
      user: userId,
      jobId,
      templateId,
      firstFile,
      secondFile,
      result,
      type,
      status,
      addedToUserHistory,
      thumbnailImage,
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

  async getUserSwaps(userId: string): Promise<UserRequests[]> {
    return this.userRequestsModel.find({
      addedToUserHistory: true,
      user: userId,
    });
  }

  async toggleAddToHistory(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const updatedUser = await this.userModel.findByIdAndUpdate(userId, { autoAddToHistory: !user.autoAddToHistory }, { new: true });

    return updatedUser;
  }

  async deleteUserHistoryItem(userId: string, historyId: string) {
    return this.userRequestsModel.deleteOne({ user: userId, _id: historyId });
  }

  async addToHistory(userId: string, historyId: string) {
    return this.userRequestsModel.findOneAndUpdate({ user: userId, _id: historyId }, { addedToUserHistory: true });
  }

  async userCanTry(userId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user) return false;

    if (user.validSubscriptionDate > new Date()) {
      return true;
    }

    return false;
  }

  async updateCredits(userId: string, newCredits: number) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        credits: newCredits,
      },

      { new: true }
    );
  }
}

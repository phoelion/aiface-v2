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
    private notificationService: NotificationService
  ) {}

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
    try {
      let finalResult;
      const prevResult = await this.userRequestsModel
        .findOne({
          jobId,
          user: userId,
          type: SwapTypesEnum.VIDEO,
        })
        .populate('templateId');

      if (!prevResult) throw new BadRequestException('user id or jobId is not valid');

      if (prevResult.result !== null) {
        finalResult = this.prepareFinalResult(prevResult.result, 'Video Is Ready');
      } else {
        const user = await this.userModel.findById(userId);
        const videoName = prevResult.secondFile.split('.')[0];
        const isTemplate = prevResult.templateId && true;

        if (prevResult.templateId && prevResult.templateId.isFree) {
          finalResult = await this.swapperService.getMivoResult(jobId);
        } else {
          finalResult = await this.swapperService.getResult(jobId, videoName, isTemplate);
        }

        //TODO: update history

        if (finalResult && finalResult.vidUrl !== null) {
          prevResult.resultVideo = finalResult.vidUrl;
          prevResult.status = RequestStatuses.SUCCESS;
          await prevResult.save();
        }
      }

      if (finalResult && finalResult.success && !finalResult.isLoading)
        await this.notificationService.sendNotif(MessagesEnum.Swap_Result.replace('{{id}}', userId).replace('{{vidUrl}}', finalResult.vidUrl));
      if (!finalResult || (finalResult && !finalResult.success && !finalResult.isLoading)) await this.notificationService.sendNotif(MessagesEnum.Swap_Result_Error.replace('{{id}}', userId));
      return finalResult;
    } catch (error) {
      console.log(error);
    }
  }
}

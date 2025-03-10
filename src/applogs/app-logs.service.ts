import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AppLog } from './model/app-logs.schema';
import { Model } from 'mongoose';
import { BackLog, BackLogTypes } from './model/back-logs.schema';

@Injectable()
export class LogsService {
  constructor(
    @InjectModel(AppLog.name) private appLogModel: Model<AppLog>,
    @InjectModel(BackLog.name) private backLogModel: Model<BackLog>
  ) {}

  async createLog(userId: string, data: any, { userAgent, ip }) {
    try {
      let { logs, appVersion } = data;

      if (typeof logs === typeof '') {
        logs = JSON.parse(logs);
      }
      let docs = [];
      for (let doc of logs) {
        const keys = doc.log.split('_');
        docs.push({
          userId: userId,
          type: keys[0],
          subView: keys[1],
          screen: keys[2],
          action: keys[3],
          data: doc.data,
          timeStampInterval: doc.timeStampInterval,
          createdTimeStamp: doc.createdTimeStamp,
          appVersion,
          userAgent,
          ip,
        });
      }

      this.appLogModel.insertMany(docs);
      return true;
    } catch (error) {
      Logger.error(error);
      throw new InternalServerErrorException();
    }
  }
  async createBackLog(userId: string, logType: BackLogTypes, extraFields: any) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const isInsertedToday = await this.backLogModel.findOne({
      userId,
      logType,
      createdAt: {
        $gte: startOfToday,
        $lt: endOfToday,
      },
    });
    if (!isInsertedToday) {
      return this.backLogModel.create({ userId, logType, extraFields });
    }
    isInsertedToday.visitedTimes = isInsertedToday.visitedTimes + 1;
    return isInsertedToday.save();
  }

  async createSwapLog(userId: string, consumedCredits: number, isTemplate: boolean, jobId: string) {
    return this.backLogModel.create({
      userId,
      logType: BackLogTypes.NOVITA_VIDEO_SWAP,
      extraFields: {
        consumedCredits,
        isTemplate,
        jobId,
      },
    });
  }
}

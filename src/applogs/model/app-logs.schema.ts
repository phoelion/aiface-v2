import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type AppLogDocument = mongoose.HydratedDocument<AppLog>;

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class AppLog {
  @Prop()
  userId: string;
  @Prop()
  type: string;
  @Prop()
  subView: string;
  @Prop()
  screen: string;
  @Prop()
  action: string;
  @Prop()
  createdTimeStamp: number;
  @Prop()
  timeStampInterval: number;
  @Prop()
  appVersion: string;
  @Prop()
  userAgent: string;

  @Prop()
  data: string;
  @Prop()
  ip: string;
}

export const AppLogSchema = SchemaFactory.createForClass(AppLog);

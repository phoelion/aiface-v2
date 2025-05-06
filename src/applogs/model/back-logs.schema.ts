import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

export type BackLogDocument = HydratedDocument<BackLog>;

export enum BackLogTypes {
  RANDOM_CATEGORY_POSITIONS = 'RANDOM_CATEGORY_POSITIONS',
  NOVITA_VIDEO_SWAP = 'NOVITA_VIDEO_SWAP',
  APPLE_NOTIFICATION = 'APPLE_NOTIFICATION',
}

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class BackLog {
  @Prop({ enum: BackLogTypes, type: String })
  logType: BackLogTypes;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  userId: string;

  @Prop({ type: Object })
  extraFields: any;

  @Prop({ default: 1 })
  visitedTimes: number;

  @Prop()
  createdAt: number;
}

export const BackLogSchema = SchemaFactory.createForClass(BackLog);

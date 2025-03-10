import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { User } from './user.schema';
import { Template } from '../../template/model/templates.schema';
import { RequestStatusesEnum } from '../enums/request-statuses.enum';
import { SwapTypesEnum } from '../enums/swap-types.enum';

export type UserRequestsDocument = HydratedDocument<UserRequests>;

@Schema({ toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class UserRequests {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  user: User;

  @Prop({ type: Date, default: new Date() })
  createdAt: Date;

  @Prop({ type: String })
  jobId: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Template', default: null })
  templateId: Template;

  @Prop({ type: String })
  firstFile: string;

  @Prop({ type: String })
  secondFile: string;

  @Prop({ type: String, default: null })
  result: string;

  @Prop({ type: Boolean, default: true })
  addedToUserHistory: boolean;

  @Prop({ type: String, enum: SwapTypesEnum })
  type: SwapTypesEnum;

  @Prop({ type: String, enum: RequestStatusesEnum })
  status: string;

  @Prop()
  ip: string;

  id: string;
  _id: string;
}

export const UserRequestsSchema = SchemaFactory.createForClass(UserRequests);

UserRequestsSchema.set('toJSON', {
  transform: function (doc, ret, opt) {
    ret.id = ret._id;

    delete ret['__v'];
    delete ret['_id'];
    return ret;
  },
});

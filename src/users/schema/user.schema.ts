import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class User {
  @Prop({ max: 80, trim: true, type: String, unique: true, lowercase: true })
  username: string;

  @Prop({ default: true })
  autoAddToHistory: boolean;

  @Prop()
  oneSignalId: string;

  @Prop({ trim: true, type: String, unique: true })
  appAccountToken: string;

  @Prop({ enum: ['user', 'admin'], default: 'user' })
  role: string;

  @Prop({ type: Object })
  token: { token: string; expires: Date };

  @Prop({ default: 0 })
  videoCredits: number;

  @Prop({ default: new Date() })
  validSubscriptionDate: Date;

  @Prop({ default: true, select: false })
  active: boolean;
  id: string;
  _id: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', {
  transform: function (doc, ret, opt) {
    ret.id = ret._id;
    ret.hasSubscription = ret.validSubscriptionDate > new Date();
    delete ret['__v'];

    return ret;
  },
});

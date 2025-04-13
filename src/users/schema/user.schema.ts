import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class User {
  @Prop({ max: 80, trim: true, type: String, unique: true })
  username: string;

  @Prop({ default: true })
  autoAddToHistory: boolean;

  @Prop()
  oneSignalId: string;

  @Prop()
  appAccountToken: string;

  @Prop({ enum: ['user', 'admin'], default: 'user' })
  role: string;

  @Prop({ type: Object })
  token: { token: string; expires: Date };

  @Prop({ default: 400 })
  videoCredits: number;

  @Prop({ default: true, select: false })
  active: boolean;
  id: string;
  _id: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

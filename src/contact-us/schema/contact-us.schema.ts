import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId, SchemaTypes } from 'mongoose';

export type PlanDocument = HydratedDocument<ContactUs>;

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class ContactUs {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  user: string;

  @Prop({ type: String, required: true })
  message: string;
  id: string;
  _id: string;
}

export const ContactUsSchema = SchemaFactory.createForClass(ContactUs);
ContactUsSchema.set('toJSON', {
  transform: function (doc, ret, opt) {
    ret.id = ret._id;
    delete ret['__v'];
    delete ret['_id'];
    return ret;
  },
});

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Categories } from './category.enum';

export type TemplateDocument = mongoose.HydratedDocument<Template>;

@Schema({
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true,
})
export class Template {
  @Prop({ required: true, type: String })
  thumbnail: string;

  @Prop({ required: true, type: String })
  cover: string;

  @Prop({ required: true, type: String, unique: true })
  tempId: string;

  @Prop({ default: false, type: Boolean })
  isLiked: boolean;

  @Prop({ default: false, type: Boolean, select: false })
  isActive: boolean;

  @Prop({ default: false, type: Boolean })
  isFree: boolean;

  @Prop({ default: false, type: Boolean })
  isEventTemplate: boolean;

  @Prop({ default: 0, type: Number })
  try: number;

  @Prop({ type: Number })
  sortOrder: number;

  @Prop({ type: String, enum: Categories })
  category: Categories;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);

TemplateSchema.set('toJSON', {
  transform: function (doc, ret, opt) {
    ret.id = ret._id;
    delete ret['__v'];
    delete ret['_id'];
    delete ret['try'];
    delete ret['thumbnail'];
    delete ret['isEventTemplate'];
    ret.cover = `${process.env.BASE_URL}/templates/${ret.cover}`;
    return ret;
  },
});

TemplateSchema.set('toObject', {
  transform: function (doc, ret, opt) {
    ret.id = ret._id;
    delete ret['__v'];
    delete ret['_id'];
    delete ret['try'];
    delete ret['thumbnail'];
    delete ret['isEventTemplate'];
    ret.cover = `${process.env.BASE_URL}/templates/${ret.cover}`;
    return ret;
  },
});

TemplateSchema.set('toObject', {
  transform: function (doc, ret, opt) {
    ret.id = ret._id.toString();
    return ret;
  },
});

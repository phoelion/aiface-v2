import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Categories } from './category.enum';
import { TemplateTypeEnum } from '../enums/template-type.enum';
import { Category } from './category.schema';
import * as process from 'node:process';
import { PHOTO_TEMPLATES_BASE_URL, VIDEO_TEMPLATES_BASE_URL, VIDEO_TEMPLATES_POSTFIX } from '../../config/app-constants';

export type TemplateDocument = mongoose.HydratedDocument<Template>;

@Schema({
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true,
})
export class Template {
  @Prop({ required: true, type: String })
  thumbnail: string;

  @Prop({ type: String })
  file: string;

  @Prop({ type: String })
  fileLowRes: string;

  @Prop({ default: false, type: Boolean, select: false })
  isActive: boolean;

  @Prop({ default: false, type: Boolean })
  isFree: boolean;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ type: mongoose.SchemaTypes.ObjectId, ref: 'Category', required: true })
  categoryId: Category;

  @Prop({ type: String, enum: TemplateTypeEnum })
  type: TemplateTypeEnum;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);

TemplateSchema.set('toJSON', {
  transform: function (doc, ret, opt) {
    ret.id = ret._id;
    ret.thumbnailUrl = PHOTO_TEMPLATES_BASE_URL + ret.thumbnail;

    ret.thumbnailVideo = ret.type == TemplateTypeEnum.VIDEO ? VIDEO_TEMPLATES_BASE_URL + ret.file.split('.')[0] + VIDEO_TEMPLATES_POSTFIX : null;

    delete ret['__v'];
    delete ret['_id'];
    return ret;
  },
});

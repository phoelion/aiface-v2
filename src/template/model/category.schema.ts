import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, ObjectId } from 'mongoose';
import { CategoryTypeEnum } from '../enums/category-type.enum';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Category {
  @Prop({ unique: true })
  name: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: String, enum: CategoryTypeEnum })
  type: CategoryTypeEnum;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop()
  id: string;
  _id: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.set('toJSON', {
  transform: function (doc, ret, opt) {
    ret.id = ret._id;
    delete ret['__v'];
    delete ret['_id'];
    return ret;
  },
});

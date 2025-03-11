import { IsNotEmpty } from 'class-validator';
import { Prop } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Category } from '../model/category.schema';
import { TemplateTypeEnum } from '../enums/template-type.enum';

export class CreateTemplateDto {
  @IsNotEmpty()
  isActive: boolean;

  @IsNotEmpty()
  isFree: boolean;

  @IsNotEmpty()
  sortOrder: number;

  @IsNotEmpty()
  categoryId: Category;

  @IsNotEmpty()
  type: TemplateTypeEnum;
}

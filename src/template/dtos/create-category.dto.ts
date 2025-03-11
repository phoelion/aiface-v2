import { IsNotEmpty } from 'class-validator';

export class CreateCategoryDto {
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  isActive: boolean;
  @IsNotEmpty()
  sortOrder: number;
}

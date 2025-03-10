import { IsNotEmpty, IsString } from 'class-validator';
import { Categories } from '../model/category.enum';

export class CreateMultiTemplatesDto {
  @IsNotEmpty()
  file: Express.Multer.File;

  @IsNotEmpty()
  @IsString()
  category: Categories;
}

export default CreateMultiTemplatesDto;

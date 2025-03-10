import { IsNotEmpty } from 'class-validator';

export class createTemplateDto {
  @IsNotEmpty()
  thumbnail: string;

  @IsNotEmpty()
  cover: string;

  @IsNotEmpty()
  tempId: string;

  categoryId?: string;
}

export default createTemplateDto;

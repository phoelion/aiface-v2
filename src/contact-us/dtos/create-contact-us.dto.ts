import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContactUsDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message: string;
}

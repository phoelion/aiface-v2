import { IsNotEmpty } from 'class-validator';

export class SignupDto {
  @IsNotEmpty()
  username: string;
}

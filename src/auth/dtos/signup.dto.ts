import { IsNotEmpty } from 'class-validator';

export class SignupDto {
  @IsNotEmpty()
  username: string;

  @IsNotEmpty()
  appAccountToken: string;
}

import { IsNotEmpty, IsString } from 'class-validator';

export class AppleNotificationDto {
  @IsString()
  @IsNotEmpty()
  signedPayload: string;
}
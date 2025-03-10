import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class SetFeatureDto {
  @IsString()
  @IsNotEmpty()
  featureName: string;

  @IsBoolean()
  @IsNotEmpty()
  featureValue: boolean;
}

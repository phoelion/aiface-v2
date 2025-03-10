import { ApiProperty } from '@nestjs/swagger';

export class SetAppConstantsDto {
  @ApiProperty()
  appConstantName: string;
  appConstantValue: any;
}

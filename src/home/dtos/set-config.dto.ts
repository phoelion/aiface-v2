import { ApiProperty } from '@nestjs/swagger';

export class SetConfigDto {
  @ApiProperty({ example: { homeIcon: 'home.png' } })
  icons?: { [key: string]: string };

  @ApiProperty()
  texts?: { [key: string]: string };

  @ApiProperty()
  appConstants?: { [key: string]: any };

  @ApiProperty()
  features?: { [key: string]: boolean };
}

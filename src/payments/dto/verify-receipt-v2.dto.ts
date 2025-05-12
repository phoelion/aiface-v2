import { IsNumber, IsString, Max, Min } from 'class-validator';

export class VerifyReceiptV2Dto {
  extraData: object;

  @IsString()
  productId: string;
}

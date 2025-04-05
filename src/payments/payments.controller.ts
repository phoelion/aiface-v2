import { Controller, HttpCode, Post, Req } from '@nestjs/common';

@Controller('payments')
export class PaymentsController {
  @HttpCode(200)
  @Post('/webhooks/apple-notifications')
  async appleNotificationHandler(@Req() req: Request) {
    console.log(req.body);
  }
}

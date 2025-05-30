import { BadRequestException, Body, Controller, HttpCode, Logger, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AppleNotificationDto } from './dto/apple-notification.dto';
import { AppleNotificationsService } from './apple-notifications.service';
import { RequestWithUser } from 'src/common/interfaces/request-with-user';
import { PaymentsService } from './payments.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { VerifyReceiptV2Dto } from './dto/verify-receipt-v2.dto';
import { Payment } from './schema/payment.schema';
import { InAppProductIds } from './enum/in-app-productIds.enum';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(
    private readonly appleNotificationsService: AppleNotificationsService,
    private readonly paymentService: PaymentsService
  ) {}

  @Post('/webhooks/apple-notifications') // Endpoint path: /apple/notifications/v2
  @HttpCode(200) // Respond 200 OK immediately upon successful receipt *and start* of processing
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async handleV2Notification(@Body() notificationDto: AppleNotificationDto): Promise<void> {
    this.logger.log(`Received POST request on /webhooks/apple-notifications`);
    try {
      this.appleNotificationsService.handleNotification(notificationDto.signedPayload);
      this.logger.log(`Processing initiated for notification.`);
      // If handleNotification completes without throwing, NestJS sends 200 OK.
    } catch (error) {
      this.logger.error(`Error in handleV2Notification controller: ${error.message}`, error.stack);
    }
  }

  @UseGuards(AuthGuard)
  @Post('/verify-receipt')
  async verifyReceipt(@Req() req: RequestWithUser, @Body('receipt') receipt: string) {
    try {
      const verificationResult = await this.paymentService.getTransactionHistoryFromReceipt(req.user._id, receipt);
      return {
        success: true,
        message: 'Receipt verified successfully',
      };
    } catch (error) {
      this.logger.error(`Error verifying receipt: ${error.message}`, error.stack);
      throw new BadRequestException('Receipt verification failed');
    }
  }

  @UseGuards(AuthGuard)
  @Post('/verify-receipt-v2')
  async verifyReceiptV2(@Req() req: RequestWithUser, @Body() body: VerifyReceiptV2Dto) {
    if (Object.values(InAppProductIds).includes(body.productId as InAppProductIds) === false) {
      throw new BadRequestException('invalid product Id');
    }

    const data = await this.paymentService.verifyReceiptV2(req.user._id, body.productId as InAppProductIds, body.extraData);
    return {
      success: true,
      message: 'Receipt verified successfully',
      data,
    };
  }

  @UseGuards(AuthGuard)
  @Post('/restore')
  async restore(@Req() req: RequestWithUser, @Body('receipt') receipt: string) {
    try {
      const verificationResult = await this.paymentService.restoreSubscriptions(req.user._id, receipt);
      return {
        success: true,
        message: 'Restored subscriptions successfully',
      };
    } catch (error) {
      this.logger.error(`Error verifying receipt: ${error.message}`, error.stack);
      throw new BadRequestException('Receipt verification failed');
    }
  }

  @Post('aaaaaaaa')
  async aaaa(@Body('data') data) {
    return this.paymentService.aaaa(data);
  }
}

import { Body, Controller, HttpCode, Logger, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AppleNotificationDto } from './dto/apple-notification.dto';
import { AppleNotificationsService } from './apple-notifications.service';
import { RequestWithUser } from 'src/common/interfaces/request-with-user';
import { PaymentsService } from './payments.service';
import { AuthGuard } from 'src/common/guards/auth.guard';

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
    // Intentionally void return. NestJS handles the 200 OK response.
    // The service handles the async processing. If the service throws *before*
    // acknowledging (e.g., during verification), NestJS default error handling
    // might return 4xx or 5xx. If it throws *after* verification during
    // internal processing, the service should ideally log the error but allow
    // the controller to finish and send 200 OK to Apple.
    this.logger.log(`Received POST request on /webhooks/apple-notifications`);
    try {
      // No await here if processing should happen in background after 200 OK is sent
      // Use await if you need processing to complete before sending response (risks Apple timeout)
      // Recommended: Acknowledge quickly, process reliably (queues, background jobs)
      // For this example, we await, but keep processing logic fast or move to queue.
      await this.appleNotificationsService.handleNotification(notificationDto.signedPayload);
      this.logger.log(`Processing initiated for notification.`);
      // If handleNotification completes without throwing, NestJS sends 200 OK.
    } catch (error) {
      // Log the error from the service if it bubbles up
      this.logger.error(`Error in handleV2Notification controller: ${error.message}`, error.stack);
      // Re-throw the error so NestJS default exception filter handles it
      // (e.g., returns 400 for BadRequestException, 500 for InternalServerErrorException)
      throw error;
    }
  }

  @UseGuards(AuthGuard)
  @Post('/verify-receipt')
  async verifyReceipt(@Req() req: RequestWithUser, @Body('receipt') receipt: string) {
    const verificationResult = await this.paymentService.getTransactionHistoryFromReceipt(req.user._id, receipt);
    return {
      success: true,
      verificationResult,
    };
  }
}

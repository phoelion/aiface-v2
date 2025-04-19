import { Injectable, Logger, InternalServerErrorException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Environment, NotificationTypeV2, SignedDataVerifier, VerificationException, ResponseBodyV2DecodedPayload } from '@apple/app-store-server-library';
import { UsersService } from 'src/users/users.service';
import { Payment, PaymentStatus, ProductIds } from './schema/payment.schema';
import { PaymentsService } from './payments.service';
import { NotificationService } from 'src/notification/notification.service';

type NotificationPayload = ResponseBodyV2DecodedPayload;
type DecodedSignedTransaction = any;
type DecodedSignedRenewalInfo = any;

@Injectable()
export class AppleNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(AppleNotificationsService.name);
  private verifier: SignedDataVerifier | undefined;
  private processedNotifications = new Set<string>();
  private environment: Environment;
  private bundleId: string;
  private readonly appAppleId: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly paymentService: PaymentsService,
    private readonly notificationService: NotificationService
  ) {
    this.bundleId = this.configService.getOrThrow<string>('APPLE_BUNDLE_ID');
    this.appAppleId = this.configService.getOrThrow<string>('APP_APPLE_ID') as unknown as number;
    const envString = this.configService.getOrThrow<string>('APPLE_ENVIRONMENT');
    this.environment = this.configService.get<string>('APPLE_ENVIRONMENT').toLowerCase() === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;

    if (!this.configService.get<string>('APPLE_ISSUER_ID')) throw new Error('Missing APPLE_ISSUER_ID config');
    if (!this.configService.get<string>('APPLE_KEY_ID')) throw new Error('Missing APPLE_KEY_ID config');
    if (!this.configService.get<string>('APPLE_PRIVATE_KEY_PATH')) throw new Error('Missing APPLE_PRIVATE_KEY_PATH config');
  }

  async onModuleInit() {
    this.logger.log(`Initializing Apple Service for environment: ${this.environment}`);
    try {
      const issuerId = this.configService.getOrThrow<string>('APPLE_ISSUER_ID');
      const keyId = this.configService.getOrThrow<string>('APPLE_KEY_ID');
      const privateKeyPath = this.configService.getOrThrow<string>('APPLE_PRIVATE_KEY_PATH');
      const absolutePath = join(process.cwd(), privateKeyPath);

      this.logger.log(`Reading private key from: ${absolutePath}`);
      const privateKey = readFileSync(absolutePath, 'utf8');

      const appleRootCAs = [];
      const certsPath = join(process.cwd(), 'certs');
      const cerFiles = readdirSync(certsPath).filter((file) => file.endsWith('.cer'));

      for (const cerFile of cerFiles) {
        const certPath = join(certsPath, cerFile);
        const certData = readFileSync(certPath);
        appleRootCAs.push(certData);
      }

      if (appleRootCAs.length === 0) {
        this.logger.warn('No .cer files found in certs directory');
      } else {
        this.logger.log(`Loaded ${appleRootCAs.length} Apple root CA certificates`);
      }

      this.verifier = new SignedDataVerifier(appleRootCAs, true, this.environment, this.bundleId, this.appAppleId);
      this.logger.log('Apple SignedDataVerifier initialized successfully.');
    } catch (error) {
      this.logger.error(`Failed to initialize Apple SignedDataVerifier: ${error.message}`, error.stack);
      this.verifier = undefined;
      throw new InternalServerErrorException(`Failed to initialize Apple Service: ${error.message}`);
    }
  }

  async handleNotification(signedPayload: string): Promise<void> {
    this.logger.log('Received Apple S2S v2 Notification');

    if (!this.verifier) {
      this.logger.error('Apple verifier is not initialized');
      throw new InternalServerErrorException('Apple service not initialized');
    }

    let notificationPayload: NotificationPayload | null = null;

    try {
      notificationPayload = await this.verifier.verifyAndDecodeNotification(signedPayload);
      this.logger.debug(`Verification successful. Type: ${notificationPayload.notificationType}, Subtype: ${notificationPayload.subtype}`);

      if (this.processedNotifications.has(notificationPayload.notificationUUID)) {
        this.logger.warn(`Duplicate notification UUID: ${notificationPayload.notificationUUID}`);
        return;
      }

      await this.processDecodedNotification(notificationPayload);
      this.processedNotifications.add(notificationPayload.notificationUUID);

      this.logger.log(`Processed notification UUID: ${notificationPayload.notificationUUID}`);
    } catch (error) {
      const notificationUUID = notificationPayload?.notificationUUID || 'N/A';
      this.logger.error(`Error processing notification (UUID: ${notificationUUID}): ${error.message}`, error.stack);

      if (error instanceof VerificationException) {
        this.logger.debug(signedPayload);
        this.logger.warn(`Verification failed for notification (UUID: ${notificationUUID}): ${error.message}`);
        throw new BadRequestException(`Notification verification failed: ${error.message}`);
      }

      throw new InternalServerErrorException(`Internal error processing notification (UUID: ${notificationUUID}): ${error.message}`);
    }
  }

  private async processDecodedNotification(payload: NotificationPayload): Promise<void> {
    const { notificationType, subtype, notificationUUID, data } = payload;
    const environment = data.environment;
    const transactionInfo: DecodedSignedTransaction | undefined = await this.verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
    const renewalInfo: DecodedSignedRenewalInfo | undefined = await this.verifier.verifyAndDecodeRenewalInfo(data.signedRenewalInfo);

    const transactionId = transactionInfo?.transactionId;
    const originalTransactionId = transactionInfo?.originalTransactionId || renewalInfo?.originalTransactionId;
    const productId = transactionInfo?.productId || renewalInfo?.productId;
    const appAccountToken = transactionInfo?.appAccountToken;

    this.logger.log(
      `Processing: UUID=${notificationUUID}, Type=${notificationType}, Subtype=${subtype}, Env=${environment}, OrigTxID=${originalTransactionId}, ProdID=${productId}, UserToken=${appAccountToken || 'N/A'}`
    );

    try {
      switch (notificationType) {
        case NotificationTypeV2.SUBSCRIBED:
          await this.initialSubscriptionHandler(notificationUUID, notificationType, subtype, environment, originalTransactionId, productId, appAccountToken, transactionInfo, renewalInfo);
          break;

        case NotificationTypeV2.DID_RENEW:
          await this.renewSubscriptionHandler(notificationUUID, notificationType, subtype, environment, originalTransactionId, productId, appAccountToken, transactionInfo, renewalInfo);
          break;

        case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF:
          await this.changeSubscriptionHandler(notificationUUID, notificationType, subtype, environment, originalTransactionId, productId, appAccountToken, transactionInfo, renewalInfo);
          break;

        case NotificationTypeV2.EXPIRED:
        case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
          await this.expireSubscriptionHandler(notificationUUID, notificationType, subtype, environment, originalTransactionId, productId, appAccountToken, transactionInfo, renewalInfo);
          break;

        default:
          this.logger.warn(`Unhandled notification type: ${notificationType} (Subtype: ${subtype}) for UUID: ${notificationUUID}`);
          break;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
      this.logger.log(`Finished processing UUID: ${notificationUUID}`);
    } catch (processingError) {
      this.logger.error(`Error processing notification UUID ${notificationUUID}: ${processingError.message}`, processingError.stack);
      throw processingError;
    }
  }

  private subscriptionDateCalculator(productId: ProductIds, time = new Date()): Date {
    const result = new Date(time);

    switch (productId) {
      case ProductIds.ANNUAL:
        result.setFullYear(result.getFullYear() + 1);
        return result;

      case ProductIds.WEEKLY:
      case ProductIds.WEEKLY_FAMILY:
        result.setDate(result.getDate() + 7);
        return result;

      default:
        console.log(`Unsupported product ID: ${productId}`);
        result.setFullYear(result.getFullYear() - 1);
        return result;
    }
  }

  private async initialSubscriptionHandler(
    notificationUUID: string,
    notificationType: string,
    subtype: string,
    environment: string,
    originalTransactionId: string,
    productId: string,
    appAccountToken: string,
    transactionInfo: DecodedSignedTransaction,
    renewalInfo: DecodedSignedRenewalInfo
  ) {
    const user = await this.userService.getUserByUsername(appAccountToken);
    const payment = this.createPaymentObject(notificationType, subtype, environment, originalTransactionId, productId, user._id, transactionInfo, renewalInfo, PaymentStatus.COMPLETED);
    await this.paymentService.createPayment(payment);

    user.validSubscriptionDate = this.subscriptionDateCalculator(productId as ProductIds);
    await user.save();
  }

  private async renewSubscriptionHandler(
    notificationUUID: string,
    notificationType: string,
    subtype: string,
    environment: string,
    originalTransactionId: string,
    productId: string,
    appAccountToken: string,
    transactionInfo: DecodedSignedTransaction,
    renewalInfo: DecodedSignedRenewalInfo
  ) {
    const user = await this.userService.getUserByUsername(appAccountToken);
    const payment = this.createPaymentObject(notificationType, subtype, environment, originalTransactionId, productId, user._id, transactionInfo, renewalInfo, PaymentStatus.RENEWED);
    await this.paymentService.createPayment(payment);

    user.validSubscriptionDate = this.subscriptionDateCalculator(productId as ProductIds, user.validSubscriptionDate);
    await user.save();

    const renewalUser = await this.userService.getUserByUsername(renewalInfo.appAccountToken);
    if (renewalUser) {
      renewalUser.validSubscriptionDate = this.subscriptionDateCalculator(productId as ProductIds, renewalUser.validSubscriptionDate);
      await renewalUser.save();
    }
  }

  private async expireSubscriptionHandler(
    notificationUUID: string,
    notificationType: string,
    subtype: string,
    environment: string,
    originalTransactionId: string,
    productId: string,
    appAccountToken: string,
    transactionInfo: DecodedSignedTransaction,
    renewalInfo: DecodedSignedRenewalInfo
  ) {
    const user = await this.userService.getUserByUsername(appAccountToken);
    const payment = this.createPaymentObject(notificationType, subtype, environment, originalTransactionId, productId, user._id, transactionInfo, renewalInfo, PaymentStatus.EXPIRED);
    await this.paymentService.createPayment(payment);

    user.validSubscriptionDate = new Date();
    await user.save();
  }

  private async changeSubscriptionHandler(
    notificationUUID: string,
    notificationType: string,
    subtype: string,
    environment: string,
    originalTransactionId: string,
    productId: string,
    appAccountToken: string,
    transactionInfo: DecodedSignedTransaction,
    renewalInfo: DecodedSignedRenewalInfo
  ) {
    // const user = await this.userService.getUserByUsername(appAccountToken);
    // const payment = this.createPaymentObject(notificationType, subtype, environment, originalTransactionId, productId, user._id, transactionInfo, renewalInfo, PaymentStatus.COMPLETED);
    // await this.paymentService.createPayment(payment);
    // user.validSubscriptionDate = this.subscriptionDateCalculator(renewalInfo.autoRenewProductId as ProductIds, user.validSubscriptionDate);
    // await user.save();
    // const renewalUser = await this.userService.getUserByUsername(renewalInfo.appAccountToken);
    // if (renewalUser) {
    //   renewalUser.validSubscriptionDate = this.subscriptionDateCalculator(productId as ProductIds, renewalUser.validSubscriptionDate);
    //   await renewalUser.save();
    // }
  }

  private createPaymentObject(
    notificationType: string,
    subtype: string,
    environment: string,
    originalTransactionId: string,
    productId: string,
    userId: string,
    transactionInfo: DecodedSignedTransaction,
    renewalInfo: DecodedSignedRenewalInfo,
    status: PaymentStatus
  ): Payment {
    const payment = new Payment();
    payment.notificationSubtype = subtype;
    payment.appleRenewalInfo = renewalInfo;
    payment.appleTransactionInfo = transactionInfo;
    payment.userId = userId;
    payment.notificationType = notificationType;
    payment.transactionId = originalTransactionId;
    payment.productId = productId;
    payment.environment = environment;
    payment.amount = transactionInfo.price;
    payment.currency = transactionInfo.currency;
    payment.status = status;
    return payment;
  }
}

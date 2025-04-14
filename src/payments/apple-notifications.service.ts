import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  OnModuleInit, // Import OnModuleInit for async setup
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  AppStoreServerAPIClient,
  Environment,
  NotificationTypeV2, // Enum for notification types
  Subtype, // Enum for subtypes
  SignedDataVerifier, // Class for verification
  VerificationException, // Specific error type from the library
  ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library'; // Import necessary components
import { UsersService } from 'src/users/users.service';
import { Payment, PaymentStatus, ProductIds } from './schema/payment.schema';
import { PaymentsService } from './payments.service';

// Define interfaces based on the actual response structure
type NotificationPayload = ResponseBodyV2DecodedPayload;
type DecodedSignedTransaction = any;
type DecodedSignedRenewalInfo = any;

@Injectable()
export class AppleNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(AppleNotificationsService.name);
  private verifier: SignedDataVerifier | undefined;
  // Optional: Client for making other API calls if needed later
  // private apiClient: AppStoreServerAPIClient | undefined;
  private processedNotifications = new Set<string>(); // Use Redis/DB in production
  private environment: Environment;
  private bundleId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly paymentService: PaymentsService
  ) {
    // Get required config values immediately
    this.bundleId = this.configService.getOrThrow<string>('APPLE_BUNDLE_ID');
    const envString = this.configService.getOrThrow<string>('APPLE_ENVIRONMENT');
    this.environment = envString === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX;

    // Basic validation
    if (!this.configService.get<string>('APPLE_ISSUER_ID')) throw new Error('Missing APPLE_ISSUER_ID config');
    if (!this.configService.get<string>('APPLE_KEY_ID')) throw new Error('Missing APPLE_KEY_ID config');
    if (!this.configService.get<string>('APPLE_PRIVATE_KEY_PATH')) throw new Error('Missing APPLE_PRIVATE_KEY_PATH config');
  }

  // Use OnModuleInit for async initialization like reading the key file
  async onModuleInit() {
    this.logger.log(`Initializing Apple Service for environment: ${this.environment}`);
    try {
      const issuerId = this.configService.getOrThrow<string>('APPLE_ISSUER_ID');
      const keyId = this.configService.getOrThrow<string>('APPLE_KEY_ID');
      const privateKeyPath = this.configService.getOrThrow<string>('APPLE_PRIVATE_KEY_PATH');
      const absolutePath = join(process.cwd(), privateKeyPath); // Ensure path is absolute or relative to CWD

      this.logger.log(`Reading private key from: ${absolutePath}`);
      const privateKey = readFileSync(absolutePath, 'utf8'); // Read key as string

      // Fetch Apple's public keys for verification.
      // The library handles fetching and caching Apple's public keys automatically.
      // We just need to provide our credentials and the environment.
      const appleRootCAs = [];
      const certsPath = join(process.cwd(), 'certs');

      // Get list of all .cer files in certs directory
      const cerFiles = readdirSync(certsPath).filter((file) => file.endsWith('.cer'));

      // Read each .cer file and add to array
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

      this.verifier = new SignedDataVerifier(appleRootCAs, true, this.environment, this.bundleId);

      // Optional: Initialize the API client if you need other App Store Server API calls
      // this.apiClient = new AppStoreServerAPIClient(privateKey, keyId, issuerId, this.bundleId, this.environment);

      this.logger.log('Apple SignedDataVerifier initialized successfully.');
    } catch (error) {
      this.logger.error(`Failed to initialize Apple SignedDataVerifier: ${error.message}`, error.stack);
      // Prevent the service from being used if initialization fails
      this.verifier = undefined;
      throw new InternalServerErrorException(`Failed to initialize Apple Service: ${error.message}`);
    }
  }

  /**
   * Main handler for incoming Apple S2S V2 notifications.
   */
  async handleNotification(signedPayload: string): Promise<void> {
    this.logger.log('Received Apple S2S v2 Notification (using official library)');

    if (!this.verifier) {
      this.logger.error('Apple verifier is not initialized. Cannot process notification.');
      throw new InternalServerErrorException('Apple service not initialized.');
    }

    let notificationPayload: NotificationPayload | null = null;

    try {
      // 1. Verify the notification using the library's verifier
      // This handles JWS verification, certificate chain validation, and decoding.
      this.logger.debug('Attempting to verify and decode notification...');

      notificationPayload = await this.verifier.verifyAndDecodeNotification(signedPayload);

      this.logger.debug(`Verification successful. Notification Type: ${notificationPayload.notificationType}, Subtype: ${notificationPayload.subtype}`);

      // 2. Check for duplicate notifications (Idempotency)
      if (this.processedNotifications.has(notificationPayload.notificationUUID)) {
        this.logger.warn(`Received duplicate notification UUID: ${notificationPayload.notificationUUID}. Ignoring.`);
        return; // Acknowledge Apple but don't process again
      }

      // 3. Process the notification using the decoded payload from the library
      // The library provides typed access to transactionInfo and renewalInfo
      await this.processDecodedNotification(notificationPayload);

      // 4. Mark notification as processed *after* successful processing
      this.processedNotifications.add(notificationPayload.notificationUUID);

      this.logger.log(
        `Successfully processed notification UUID: ${notificationPayload.notificationUUID}, Type: ${notificationPayload.notificationType}, Subtype: ${notificationPayload.subtype || 'N/A'}`
      );
    } catch (error) {
      const notificationUUID = notificationPayload?.notificationUUID || 'N/A'; // Get UUID if decoding started
      this.logger.error(`Error processing Apple notification (UUID: ${notificationUUID}): ${error.message}`, error.stack);

      // Handle specific verification errors from the library
      if (error instanceof VerificationException) {
        this.logger.warn(`Verification failed for notification (UUID: ${notificationUUID}): ${error.message}`);
        // VerificationException usually means the payload is invalid/tampered/expired
        throw new BadRequestException(`Notification verification failed: ${error.message}`);
      }

      // Handle other errors (e.g., internal processing errors)
      // Consider if internal errors should still result in 200 OK to Apple
      throw new InternalServerErrorException(`Internal error processing notification (UUID: ${notificationUUID}): ${error.message}`);
    }
  }

  /**
   * Processes the verified and decoded notification data provided by the Apple library.
   * Update your application state (database, user entitlements) here.
   */
  private async processDecodedNotification(
    payload: NotificationPayload // Use the type from the library
  ): Promise<void> {
    // Extract data using types/enums from the library
    const { notificationType, subtype, notificationUUID, data } = payload;
    const environment = data.environment; // Library maps this
    // Access decoded info directly if available (library handles decoding)
    const transactionInfo: DecodedSignedTransaction | undefined = await this.verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
    const renewalInfo: DecodedSignedRenewalInfo | undefined = await this.verifier.verifyAndDecodeRenewalInfo(data.signedRenewalInfo);
    console.log('transactionInfo', transactionInfo);
    console.log('renewalInfo', renewalInfo);
    const transactionId = transactionInfo?.transactionId;
    const originalTransactionId = transactionInfo?.originalTransactionId || renewalInfo?.originalTransactionId;
    const productId = transactionInfo?.productId || renewalInfo?.productId;
    const appAccountToken = transactionInfo?.appAccountToken; // Your user identifier

    this.logger.log(
      `Processing: UUID=${notificationUUID}, Type=${notificationType}, Subtype=${subtype}, Env=${environment}, OrigTxID=${originalTransactionId}, ProdID=${productId}, UserToken=${appAccountToken || 'N/A'}`
    );

    // **IMPORTANT**: Implement your actual business logic here.
    // Use NotificationTypeV2 and Subtype enums from the library for comparisons.
    try {
      switch (notificationType) {
        case NotificationTypeV2.SUBSCRIBED:
          this.logger.log(`Handling SUBSCRIBED event for ${originalTransactionId}`);
          if (!transactionInfo?.expiresDate) {
            this.logger.warn(`SUBSCRIBED event for ${originalTransactionId} missing expiresDate.`);
          }
          await this.initialSubscriptionHandler(notificationUUID, notificationType, subtype, environment, originalTransactionId, productId, appAccountToken, transactionInfo, renewalInfo);

          break;

        case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF:
          this.logger.log(`Handling SUBSCRIBED event for ${originalTransactionId}`);
          if (!transactionInfo?.expiresDate) {
            this.logger.warn(`SUBSCRIBED event for ${originalTransactionId} missing expiresDate.`);
          }
          await this.changeSubscriptionHandler(notificationUUID, notificationType, subtype, environment, originalTransactionId, productId, appAccountToken, transactionInfo, renewalInfo);

          break;

          break;

        case NotificationTypeV2.DID_RENEW:
          this.logger.log(`Handling DID_RENEW event for ${originalTransactionId}`);
          if (!transactionInfo?.expiresDate) {
            this.logger.warn(`DID_RENEW event for ${originalTransactionId} missing expiresDate.`);
          }
          // Example: await this.subscriptionService.updateExpiry(originalTransactionId, transactionInfo.expiresDate, appAccountToken);
          break;

        case NotificationTypeV2.EXPIRED:
          this.logger.log(`Handling EXPIRED event for ${originalTransactionId}`);
          // Example: await this.subscriptionService.revokeAccess(originalTransactionId, 'EXPIRED', subtype, appAccountToken);
          break;

        case NotificationTypeV2.DID_FAIL_TO_RENEW:
          this.logger.log(`Handling DID_FAIL_TO_RENEW event for ${originalTransactionId}`);
          // Example: await this.subscriptionService.updateStatus(originalTransactionId, 'BILLING_ISSUE', subtype, appAccountToken);
          break;

        case NotificationTypeV2.GRACE_PERIOD_EXPIRED:
          this.logger.log(`Handling GRACE_PERIOD_EXPIRED event for ${originalTransactionId}`);
          // Example: await this.subscriptionService.revokeAccess(originalTransactionId, 'GRACE_PERIOD_EXPIRED', subtype, appAccountToken);
          break;

        case NotificationTypeV2.PRICE_INCREASE: // Note: Library might use different casing or enum name
          this.logger.log(`Handling PRICE_INCREASE event for ${originalTransactionId}`);
          // Example: await this.subscriptionService.notifyPriceIncrease(originalTransactionId, renewalInfo, appAccountToken);
          break;

        case NotificationTypeV2.REFUND:
          this.logger.log(`Handling REFUND event for ${transactionId} (Original: ${originalTransactionId})`);
          // Example: await this.subscriptionService.processRefund(transactionId, originalTransactionId, appAccountToken);
          break;

        case NotificationTypeV2.CONSUMPTION_REQUEST:
          this.logger.log(`Handling CONSUMPTION_REQUEST for ${transactionId}`);
          // Example: await this.iapService.creditConsumable(transactionId, appAccountToken);
          break;

        case NotificationTypeV2.RENEWAL_EXTENDED:
          this.logger.log(`Handling RENEWAL_EXTENDED for ${originalTransactionId}`);
          // Example: await this.subscriptionService.updateRenewalDate(originalTransactionId, renewalInfo.renewalDate);
          break;

        case NotificationTypeV2.REVOKE:
          this.logger.log(`Handling REVOKE for ${originalTransactionId}`);
          // Example: await this.subscriptionService.revokeAccess(originalTransactionId, 'REVOKED', subtype, appAccountToken);
          break;

        // Add other notification types from NotificationTypeV2 enum as needed
        // e.g., OFFER_REDEEMED, RENEWAL_EXTENSION, TEST

        default:
          // Use exhaustive check if possible or log unhandled types
          this.logger.warn(`Received unhandled notification type: ${notificationType} (Subtype: ${subtype}) for UUID: ${notificationUUID}`);
          break;
      }

      // Simulate async DB operation
      await new Promise((resolve) => setTimeout(resolve, 50)); // Replace with actual async logic

      this.logger.log(`Finished processing logic for UUID: ${notificationUUID}`);
    } catch (processingError) {
      this.logger.error(`Error during internal processing of notification UUID ${notificationUUID}: ${processingError.message}`, processingError.stack);
      // Rethrow to be caught by the main handler in handleNotification
      throw processingError;
    }
  }

  private subscriptionDateCalculator(productId: ProductIds): Date {
    const currentTime = new Date();
    const result = new Date(currentTime);

    switch (productId) {
      case ProductIds.ANNUAL:
        result.setFullYear(result.getFullYear() + 1);
        return result;

      case ProductIds.WEEKLY:
        result.setDate(result.getDate() + 7);
        return result;

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
    const user = await this.userService.getUserByUsername(appAccountToken.toUpperCase());
    //handle payment creation
    const payment = new Payment();
    payment.notificationSubtype = subtype;
    payment.appleRenewalInfo = renewalInfo;
    payment.appleTransactionInfo = transactionInfo;
    payment.userId = user._id;
    payment.notificationType = notificationType;
    payment.transactionId = originalTransactionId;
    payment.productId = productId;
    payment.environment = environment;
    payment.amount = transactionInfo.price;
    payment.currency = transactionInfo.currency;
    payment.status = PaymentStatus.COMPLETED;
    const paymentDocument = await this.paymentService.createPayment(payment);

    //handle user grants
    user.validSubscriptionDate = this.subscriptionDateCalculator(productId as ProductIds);
    await user.save();

    console.log(payment, user);
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
    const user = await this.userService.getUserByUsername(appAccountToken.toUpperCase());

    const payment = new Payment();
    payment.notificationSubtype = subtype;
    payment.appleRenewalInfo = renewalInfo;
    payment.appleTransactionInfo = transactionInfo;
    payment.userId = user._id;
    payment.notificationType = notificationType;
    payment.transactionId = originalTransactionId;
    payment.productId = productId;
    payment.environment = environment;
    payment.amount = transactionInfo.price;
    payment.currency = transactionInfo.currency;
    payment.status = PaymentStatus.COMPLETED;

    if (subtype && subtype === 'DOWNGRADE') {
    } else if (subtype && subtype === 'UPGRADE') {
    }

    //handle payment creation

    const paymentDocument = await this.paymentService.createPayment(payment);
    //handle user grants
    user.validSubscriptionDate = this.subscriptionDateCalculator(productId as ProductIds);
    await user.save();

    console.log(payment, user);
  }
}

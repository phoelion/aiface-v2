import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UsersService } from 'src/users/users.service';
import { Payment, PaymentStatus, ProductIds } from './schema/payment.schema';
import {
  AppStoreServerAPIClient,
  Environment,
  GetTransactionHistoryVersion,
  ReceiptUtility,
  Order,
  ProductType,
  HistoryResponse,
  TransactionHistoryRequest,
  SignedDataVerifier,
} from '@apple/app-store-server-library';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { InAppProductIds } from './enum/in-app-productIds.enum';
import { NotificationService } from 'src/notification/notification.service';
import { LogsService } from 'src/applogs/app-logs.service';
import { BackLogTypes } from 'src/applogs/model/back-logs.schema';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private client: AppStoreServerAPIClient;
  private verifier: SignedDataVerifier;
  private readonly issuerId: string;
  private readonly keyId: string;
  private readonly bundleId: string;
  private readonly privateKeyPath: string;
  private readonly environment: Environment;
  private readonly appAppleId: number;

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel,
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
    private readonly notificationService: NotificationService,
    private readonly logService: LogsService
  ) {
    this.bundleId = this.configService.getOrThrow<string>('APPLE_BUNDLE_ID');
    this.appAppleId = 1632392310;
    this.keyId = this.configService.getOrThrow<string>('APPLE_KEY_ID');
    this.issuerId = this.configService.getOrThrow<string>('APPLE_ISSUER_ID');
    this.privateKeyPath = this.configService.getOrThrow<string>('APPLE_PRIVATE_KEY_PATH');
    this.environment = this.configService.get<string>('APPLE_ENVIRONMENT').toLowerCase() === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;
  }

  async onModuleInit() {
    try {
      const absolutePath = join(process.cwd(), this.privateKeyPath);
      this.logger.log(`Reading private key from: ${absolutePath}`);
      const privateKey = readFileSync(absolutePath, 'utf8');

      const appleRootCAs = this.loadAppleRootCAs();
      this.client = new AppStoreServerAPIClient(privateKey, this.keyId, this.issuerId, this.bundleId, this.environment);

      this.verifier = new SignedDataVerifier(appleRootCAs, true, this.environment, this.bundleId, this.appAppleId);

      this.logger.log('Apple services initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Apple services: ${error.message}`, error.stack);
      this.client = undefined;
      throw new InternalServerErrorException(`Failed to initialize Apple services: ${error.message}`);
    }
  }

  private loadAppleRootCAs(): Buffer[] {
    const certsPath = join(process.cwd(), 'certs');
    const cerFiles = readdirSync(certsPath).filter((file) => file.endsWith('.cer'));
    const appleRootCAs = cerFiles.map((cerFile) => {
      const certPath = join(certsPath, cerFile);
      return readFileSync(certPath);
    });

    if (appleRootCAs.length === 0) {
      this.logger.warn('No .cer files found in certs directory');
    } else {
      this.logger.log(`Loaded ${appleRootCAs.length} Apple root CA certificates`);
    }

    return appleRootCAs;
  }

  public async createPayment(payment: Payment) {
    const paymentDocument = await this.paymentModel.create(payment);

    return paymentDocument;
  }

  private creditCalculator(productId: InAppProductIds): number {
    const credits = {
      [InAppProductIds.BASE]: 20,
      [InAppProductIds.PRO]: 100,
      [InAppProductIds.PREMIUM]: 200,
      [InAppProductIds.SPRING_OFFER]: 500,
      [InAppProductIds.VIDEO_100_OFFER]: 100,
    };
    return credits[productId] || 0;
  }

  async getTransactionHistoryFromReceipt(userId: string, appReceipt: string): Promise<any[]> {
    const receiptUtil = new ReceiptUtility();
    const user = await this.userService.getUser(userId);
    const transactionId = receiptUtil.extractTransactionIdFromAppReceipt(appReceipt);

    if (!transactionId) {
      this.logger.warn('No transaction ID found in the receipt');
      return [];
    }

    const transactionHistoryRequest: TransactionHistoryRequest = {
      sort: Order.DESCENDING,
      revoked: false,
      productTypes: [ProductType.CONSUMABLE],
    };

    const decodedNotif = await this.verifier.verifyAndDecodeTransaction((await this.client.getTransactionInfo(transactionId)).signedTransactionInfo);

    await this.logService.createBackLog(userId, BackLogTypes.APPLE_NOTIFICATION, decodedNotif);

    const decodedTransactions = await this.fetchAndProcessTransactions(transactionId, transactionHistoryRequest, userId, user);
    return decodedTransactions;
  }

  async restoreSubscriptions(userId: string, appReceipt: string): Promise<any[]> {
    const receiptUtil = new ReceiptUtility();
    const user = await this.userService.getUser(userId);
    const transactionId = receiptUtil.extractTransactionIdFromAppReceipt(appReceipt);

    if (!transactionId) {
      this.logger.warn('No transaction ID found in the receipt');
      return [];
    }

    const transactionHistoryRequest: TransactionHistoryRequest = {
      sort: Order.DESCENDING,
      revoked: false,
      productTypes: [ProductType.AUTO_RENEWABLE],
    };

    const decodedTransactions = await this.fetchAndProcessTransactionsForRestore(transactionId, transactionHistoryRequest, userId, user);
    return decodedTransactions;
  }

  private async fetchAndProcessTransactionsForRestore(transactionId: string, request: TransactionHistoryRequest, userId: string, user: any): Promise<any[]> {
    let response: HistoryResponse | null = null;
    let decodedTransactions = [];

    do {
      const revisionToken = response?.revision ?? null;
      response = await this.client.getTransactionHistory(transactionId, revisionToken, request, GetTransactionHistoryVersion.V2);

      for (const transaction of response?.signedTransactions ?? []) {
        const decodedTransaction = await this.verifier.verifyAndDecodeTransaction(transaction);

        decodedTransactions.push(decodedTransaction);
      }
    } while (response?.hasMore);
    const latestTransaction = decodedTransactions.reduce((latest, current) => {
      return new Date(current.expiresDate) > new Date(latest.expiresDate) ? current : latest;
    });
    await this.processTransactionForRestore(latestTransaction, userId, user);
    return decodedTransactions;
  }

  private async fetchAndProcessTransactions(transactionId: string, request: TransactionHistoryRequest, userId: string, user: any): Promise<any[]> {
    let response: HistoryResponse | null = null;
    let decodedTransactions = [];

    do {
      const revisionToken = response?.revision ?? null;
      response = await this.client.getTransactionHistory(transactionId, revisionToken, request, GetTransactionHistoryVersion.V2);

      for (const transaction of response?.signedTransactions ?? []) {
        const decodedTransaction = await this.verifier.verifyAndDecodeTransaction(transaction);
        decodedTransactions.push(decodedTransaction);
      }
    } while (response?.hasMore);

    console.log('decodedTransactions.length', decodedTransactions.length);

    console.log(decodedTransactions);

    for (let transaction of decodedTransactions) {
      await this.processTransaction(transaction, userId, user, true);
    }

    return decodedTransactions;
  }

  private async processTransactionForRestore(transaction: any, userId: string, user: any): Promise<void> {
    const existingTransaction = await this.paymentModel.findOne({
      transactionId: transaction.originalTransactionId,
    });

    if (existingTransaction) {
      const subscriptionDate = this.subscriptionDateCalculator(transaction.productId, transaction.purchaseDate);
      user.validSubscriptionDate = subscriptionDate;
      await user.save();
      this.logger.log(`Transaction ${transaction.originalTransactionId} already exists`);
      return;
    }

    const payment = new Payment();
    payment.appleTransactionInfo = transaction;
    payment.userId = userId;
    payment.transactionId = transaction.originalTransactionId;
    payment.productId = transaction.productId;
    payment.environment = transaction.environment;
    payment.amount = transaction.price;
    payment.currency = transaction.currency;
    payment.status = PaymentStatus.COMPLETED;

    await this.createPayment(payment);

    const subscriptionDate = this.subscriptionDateCalculator(transaction.productId, transaction.purchaseDate);
    user.validSubscriptionDate = subscriptionDate;
    await user.save();
  }
  private async processTransaction(transaction: any, userId: string, user: any, isLastTransaction: boolean): Promise<void> {
    const existingTransaction = await this.paymentModel.findOne({
      transactionId: transaction.originalTransactionId,
      userId: userId,
    });

    if (existingTransaction) {
      this.logger.log(`Transaction ${transaction.originalTransactionId} already exists`);
      return;
    }

    const payment = new Payment();
    payment.appleTransactionInfo = transaction;
    payment.userId = userId;
    payment.transactionId = transaction.originalTransactionId;
    payment.productId = transaction.productId;
    payment.environment = transaction.environment;
    payment.amount = transaction.price;
    payment.currency = transaction.currency;
    payment.status = PaymentStatus.COMPLETED;

    await this.createPayment(payment);

    if (isLastTransaction) {
      const credits = this.creditCalculator(transaction.productId);
      user.videoCredits = credits + user.videoCredits;
      await user.save();
      await this.notificationService.sendPurchase(payment.userId, payment.productId);
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

  async verifyReceiptV2(userId: string, productId: InAppProductIds, extraData: object) {
    const user = await this.userService.getUser(userId);

    if (!user) {
      throw new BadRequestException('user not found');
    }

    user.videoCredits = user.videoCredits + this.creditCalculator(productId);

    const payment = new Payment();
    payment.extraData = extraData;
    payment.userId = userId;
    payment.transactionId = userId;
    payment.productId = productId;
    payment.environment = this.configService.get<string>('APPLE_ENVIRONMENT');
    payment.amount = 0;
    payment.currency = 'V2Currency';
    payment.status = PaymentStatus.COMPLETED;

    await this.createPayment(payment);

    await this.notificationService.sendPurchase(payment.userId, payment.productId);
    return user.save();
  }
  async aaaa(data) {
    // const a =
    // const b = await a.verifyAndDecodeNotification(data);
    // console.log();
    // //@ts-ignore
    // const c = a.verifyAndDecodeTransaction(b.data.signedTransactionInfo);
    // return c;
  }
}

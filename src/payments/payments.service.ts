import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
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
    private readonly notificationService: NotificationService
  ) {
    this.bundleId = this.configService.getOrThrow<string>('APPLE_BUNDLE_ID');
    this.appAppleId = this.configService.getOrThrow<string>('APP_APPLE_ID') as unknown as number;
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
    await this.notificationService.sendPurchase(payment.userId, payment.productId);
    return paymentDocument;
  }

  private async creditCalculator(productId: InAppProductIds): Promise<number> {
    const credits = {
      [InAppProductIds.BASE]: 20,
      [InAppProductIds.PRO]: 100,
      [InAppProductIds.PREMIUM]: 200,
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
        await this.processTransaction(decodedTransaction, userId, user);
      }
    } while (response?.hasMore);

    return decodedTransactions;
  }

  private async processTransactionForRestore(transaction: any, userId: string, user: any): Promise<void> {
    const existingTransaction = await this.paymentModel.findOne({
      transactionId: transaction.transactionId,
    });

    if (existingTransaction) {
      const subscriptionDate = this.subscriptionDateCalculator(transaction.productId, transaction.purchaseDate);
      console.log('validSubscriptionDate', subscriptionDate);
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
    console.log(transaction);
    const subscriptionDate = this.subscriptionDateCalculator(transaction.productId, transaction.purchaseDate);

    user.validSubscriptionDate = subscriptionDate;

    console.log('validSubscriptionDateINIT', subscriptionDate);
    user.validSubscriptionDate = subscriptionDate;
    await user.save();
  }
  private async processTransaction(transaction: any, userId: string, user: any): Promise<void> {
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

    const calculatedCredits = await this.creditCalculator(transaction.productId);
    user.videoCredits = user.videoCredits + calculatedCredits;
    await user.save();
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
  async aaaa(data) {
    // const a =
    // const b = await a.verifyAndDecodeNotification(data);
    // console.log();
    // //@ts-ignore
    // const c = a.verifyAndDecodeTransaction(b.data.signedTransactionInfo);
    // return c;
  }
}

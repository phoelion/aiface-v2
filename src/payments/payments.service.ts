import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UsersService } from 'src/users/users.service';
import { Payment, PaymentStatus } from './schema/payment.schema';
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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private client: AppStoreServerAPIClient;
  private readonly issuerId;
  private readonly keyId;
  private readonly bundleId;
  private readonly privateKeyPath;
  private readonly environment;
  private verifier: SignedDataVerifier;
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel,
    private readonly configService: ConfigService,
    private readonly userService: UsersService
  ) {
    this.bundleId = this.configService.getOrThrow<string>('APPLE_BUNDLE_ID');
    this.keyId = this.configService.getOrThrow<string>('APPLE_KEY_ID');
    const envString = this.configService.getOrThrow<string>('APPLE_ENVIRONMENT');
    this.environment = envString === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX;
    this.issuerId = this.configService.getOrThrow<string>('APPLE_ISSUER_ID');
    this.issuerId = this.configService.getOrThrow<string>('APPLE_ISSUER_ID');
    this.privateKeyPath = this.configService.getOrThrow<string>('APPLE_PRIVATE_KEY_PATH');
  }
  async onModuleInit() {
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
      this.client = new AppStoreServerAPIClient(privateKey, this.keyId, this.issuerId, this.bundleId, this.environment);

      this.verifier = new SignedDataVerifier(appleRootCAs, true, this.environment, this.bundleId);
      this.logger.log('Apple SignedDataVerifier initialized successfully.');
    } catch (error) {
      this.logger.error(`Failed to initialize Apple SignedDataVerifier: ${error.message}`, error.stack);

      this.client = undefined;
      throw new InternalServerErrorException(`Failed to initialize Apple Service: ${error.message}`);
    }
  }

  public async createPayment(payment: Payment) {
    return this.paymentModel.create(payment);
  }

  public async verifyReceipt(receipt: string) {}

  private async creditCalculator(productId: InAppProductIds) {
    switch (productId) {
      case InAppProductIds.BASE:
        return 20;
      case InAppProductIds.PRO:
        return 100;
      case InAppProductIds.PREMIUM:
        return 200;

      default:
        return 0;
    }
  }

  async getTransactionHistoryFromReceipt(userId: string, appReceipt: string): Promise<string[]> {
    const receiptUtil = new ReceiptUtility();
    const user = await this.userService.getUser(userId);
    const transactionId = receiptUtil.extractTransactionIdFromAppReceipt(appReceipt);

    if (!transactionId) {
      this.logger.warn('No transaction ID found in the receipt.');
      return [];
    }

    const transactionHistoryRequest: TransactionHistoryRequest = {
      sort: Order.DESCENDING,
      revoked: false,
      productTypes: [ProductType.CONSUMABLE],
    };

    let response: HistoryResponse | null = null;
    let transactions: string[] = [];
    let decodedTransactions = [];
    do {
      const revisionToken = response?.revision ?? null;

      response = await this.client.getTransactionHistory(transactionId, revisionToken, transactionHistoryRequest, GetTransactionHistoryVersion.V2);

      for (const transaction of response?.signedTransactions ?? []) {
        const decodedTransaction = await this.verifier.verifyAndDecodeTransaction(transaction);
        decodedTransactions.push(decodedTransaction);
      }

      if (response?.signedTransactions) {
        transactions = transactions.concat(response.signedTransactions);
      }
    } while (response?.hasMore);

    for (const transaction of decodedTransactions) {
      var previousTransaction = await this.paymentModel.findOne({ transactionId: transaction.originalTransactionId, userId: userId });
      if (previousTransaction) {
        this.logger.log(`Transaction ${transaction.originalTransactionId} already exists.`);
        continue;
      } else {
        const payment = new Payment();
        payment.appleTransactionInfo = transaction;
        payment.userId = userId;

        payment.transactionId = transaction.originalTransactionId;
        payment.productId = transaction.productId;
        payment.environment = transaction.environment;
        payment.amount = transaction.price;
        payment.currency = transaction.currency;
        payment.status = PaymentStatus.COMPLETED;
        const paymentDocument = await this.createPayment(payment);

        const calculatedCredits = await this.creditCalculator(transaction.productId);
        user.videoCredits = user.videoCredits + calculatedCredits;
        await user.save();
      }
    }

    return decodedTransactions;
  }
}

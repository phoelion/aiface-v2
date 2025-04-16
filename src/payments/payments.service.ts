import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UsersService } from 'src/users/users.service';
import { Payment } from './schema/payment.schema';
import { AppStoreServerAPIClient, Environment, GetTransactionHistoryVersion, ReceiptUtility, Order, ProductType, HistoryResponse, TransactionHistoryRequest } from '@apple/app-store-server-library';
import { ConfigService } from '@nestjs/config';
import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private client: AppStoreServerAPIClient;
  private readonly issuerId;
  private readonly keyId;
  private readonly bundleId;
  private readonly privateKeyPath;
  private readonly environment;
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

  async getTransactionHistoryFromReceipt(appReceipt: string): Promise<string[]> {
    const receiptUtil = new ReceiptUtility();
    const transactionId = receiptUtil.extractTransactionIdFromAppReceipt(appReceipt);

    if (!transactionId) {
      this.logger.warn('No transaction ID found in the receipt.');
      return [];
    }

    const transactionHistoryRequest: TransactionHistoryRequest = {
      sort: Order.ASCENDING,
      revoked: false,
      productTypes: [ProductType.AUTO_RENEWABLE],
    };

    let response: HistoryResponse | null = null;
    let transactions: string[] = [];

    do {
      const revisionToken = response?.revision ?? null;

      response = await this.client.getTransactionHistory(transactionId, revisionToken, transactionHistoryRequest, GetTransactionHistoryVersion.V2);

      if (response?.signedTransactions) {
        transactions = transactions.concat(response.signedTransactions);
      }
    } while (response?.hasMore);
    console.log(transactions);
    return transactions;
  }
}

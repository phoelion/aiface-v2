import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  CREDIT_CARD = 'credit_card',
  BANK_TRANSFER = 'bank_transfer',
}

// Apple-specific transaction data
export interface AppleTransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  webOrderLineItemId: string;
  bundleId: string;
  productId: string;
  subscriptionGroupIdentifier: string;
  purchaseDate: Date;
  originalPurchaseDate: Date;
  expiresDate?: Date;
  quantity: number;
  type: string;
  inAppOwnershipType: string;
  signedDate: Date;
  environment: string;
  appAccountToken?: string;
}

// Apple-specific renewal data
export interface AppleRenewalInfo {
  autoRenewProductId: string;
  autoRenewStatus: boolean;
  expirationIntent?: number;
  gracePeriodExpiresDate?: Date;
  isInBillingRetryPeriod?: boolean;
  offerIdentifier?: string;
  offerType?: number;
  originalTransactionId: string;
  priceIncreaseStatus?: number;
  productId: string;
  recentSubscriptionStartDate: Date;
  renewalDate?: Date;
  signedDate: Date;
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop({ required: true, enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Prop({ required: true })
  transactionId: string;

  @Prop()
  originalTransactionId?: string;

  @Prop()
  productId?: string;

  @Prop()
  description?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;

  @Prop()
  errorMessage?: string;

  @Prop()
  completedAt?: Date;

  @Prop()
  refundedAt?: Date;

  // Apple-specific fields
  @Prop({ type: MongooseSchema.Types.Mixed })
  appleTransactionInfo?: AppleTransactionInfo;

  @Prop({ type: MongooseSchema.Types.Mixed })
  appleRenewalInfo?: AppleRenewalInfo;

  @Prop()
  environment?: string; // 'Production' or 'Sandbox'

  @Prop()
  notificationType?: string;

  @Prop()
  notificationSubtype?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Indexes
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ transactionId: 1 }, { unique: true });
PaymentSchema.index({ originalTransactionId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ createdAt: 1 });
PaymentSchema.index({ 'appleTransactionInfo.expiresDate': 1 });
PaymentSchema.index({ 'appleRenewalInfo.renewalDate': 1 });

import mongoose, { Document, Schema } from 'mongoose';

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type WithdrawalPayoutMethodType = 'bank_transfer' | 'paypal';

export interface IWithdrawalRequest extends Document {
  id: string;
  tutorId: string;
  amount: number;
  payoutMethodType: WithdrawalPayoutMethodType;
  payoutMethodDetails: string;
  status: WithdrawalStatus;
  requestedAt: Date;
  processedAt?: Date;
  note?: string;
}

const WithdrawalRequestSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    tutorId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    payoutMethodType: {
      type: String,
      required: true,
      enum: ['bank_transfer', 'paypal'],
      default: 'bank_transfer',
    },
    payoutMethodDetails: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected', 'paid'],
      default: 'pending',
      index: true,
    },
    requestedAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date },
    note: { type: String },
  },
  {
    timestamps: true,
  }
);

WithdrawalRequestSchema.index({ tutorId: 1, status: 1, requestedAt: -1 });

export const WithdrawalRequest = mongoose.model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema);

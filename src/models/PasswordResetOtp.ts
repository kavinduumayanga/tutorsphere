import mongoose, { Document, Schema } from 'mongoose';

export interface IPasswordResetOtp extends Document {
  id: string;
  userId: string;
  email: string;
  otpHash: string;
  expiresAt: Date;
  verifiedAt?: Date;
  usedAt?: Date;
  replacedAt?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  failedAttempts: number;
  lastSentAt: Date;
}

const PasswordResetOtpSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verifiedAt: { type: Date },
    usedAt: { type: Date },
    replacedAt: { type: Date },
    resetTokenHash: { type: String },
    resetTokenExpiresAt: { type: Date },
    failedAttempts: { type: Number, required: true, default: 0 },
    lastSentAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

PasswordResetOtpSchema.index({ email: 1, createdAt: -1 });
PasswordResetOtpSchema.index({ userId: 1, createdAt: -1 });
PasswordResetOtpSchema.index({ expiresAt: 1 });
PasswordResetOtpSchema.index({ resetTokenExpiresAt: 1 });

export const PasswordResetOtp = mongoose.model<IPasswordResetOtp>('PasswordResetOtp', PasswordResetOtpSchema);

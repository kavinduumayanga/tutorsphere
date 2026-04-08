import mongoose, { Document, Schema } from 'mongoose';

export interface ICourseCoupon extends Document {
  id: string;
  courseId: string;
  code: string;
  discountPercentage: number;
  isActive: boolean;
  expiresAt?: Date;
  usageLimit?: number;
  usageCount: number;
}

const normalizeCouponCode = (value: unknown): string => {
  return String(value || '').trim().toUpperCase();
};

const CourseCouponSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    courseId: { type: String, required: true, index: true },
    code: {
      type: String,
      required: true,
      set: normalizeCouponCode,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    isActive: { type: Boolean, required: true, default: true },
    expiresAt: { type: Date },
    usageLimit: { type: Number, min: 1 },
    usageCount: { type: Number, required: true, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

CourseCouponSchema.index({ courseId: 1, code: 1 }, { unique: true });
CourseCouponSchema.index({ courseId: 1, isActive: 1, expiresAt: 1 });

export const CourseCoupon = mongoose.model<ICourseCoupon>('CourseCoupon', CourseCouponSchema);

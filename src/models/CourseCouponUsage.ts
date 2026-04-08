import mongoose, { Document, Schema } from 'mongoose';

export interface ICourseCouponUsage extends Document {
  id: string;
  userId: string;
  courseId: string;
  couponCode: string;
  enrollmentId?: string;
  usedAt: Date;
}

const normalizeCouponCode = (value: unknown): string => {
  return String(value || '').trim().toUpperCase();
};

const CourseCouponUsageSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    couponCode: {
      type: String,
      required: true,
      set: normalizeCouponCode,
      index: true,
    },
    enrollmentId: { type: String },
    usedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
  }
);

CourseCouponUsageSchema.index({ userId: 1, courseId: 1, couponCode: 1 }, { unique: true });

export const CourseCouponUsage = mongoose.model<ICourseCouponUsage>('CourseCouponUsage', CourseCouponUsageSchema);

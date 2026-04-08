import mongoose, { Document, Schema } from 'mongoose';

export interface ICourseEnrollment extends Document {
  id: string;
  courseId: string;
  studentId: string;
  completedModuleIds: string[];
  progress: number;
  enrolledAt: Date;
  completedAt?: Date;
  certificateId?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  paymentReference?: string;
  paidAt?: Date;
  amountPaid?: number;
  originalPrice?: number;
  couponCode?: string;
  discountAmount?: number;
  finalPaidAmount?: number;
}

const CourseEnrollmentSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    courseId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    completedModuleIds: [{ type: String }],
    progress: { type: Number, required: true, default: 0, min: 0, max: 100 },
    enrolledAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    certificateId: { type: String },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentReference: { type: String },
    paidAt: { type: Date },
    amountPaid: { type: Number, min: 0, default: 0 },
    originalPrice: { type: Number, min: 0, default: 0 },
    couponCode: { type: String },
    discountAmount: { type: Number, min: 0, default: 0 },
    finalPaidAmount: { type: Number, min: 0, default: 0 },
  },
  {
    timestamps: true,
  }
);

CourseEnrollmentSchema.index({ courseId: 1, studentId: 1 }, { unique: true });

export const CourseEnrollment = mongoose.model<ICourseEnrollment>('CourseEnrollment', CourseEnrollmentSchema);

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
  },
  {
    timestamps: true,
  }
);

CourseEnrollmentSchema.index({ courseId: 1, studentId: 1 }, { unique: true });

export const CourseEnrollment = mongoose.model<ICourseEnrollment>('CourseEnrollment', CourseEnrollmentSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  id: string;
  tutorId: string;
  studentId: string;
  sessionId?: string;
  studentName: string;
  rating: number;
  comment: string;
  date: string;
}

const ReviewSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  tutorId: { type: String, required: true },
  studentId: { type: String, required: true },
  sessionId: { type: String },
  studentName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  date: { type: String, required: true }
}, {
  timestamps: true
});

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
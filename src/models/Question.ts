import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestion extends Document {
  id: string;
  studentId: string;
  text: string;
  subject: string;
  answer?: string;
  timestamp: number;
}

const QuestionSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  text: { type: String, required: true },
  subject: { type: String, required: true },
  answer: { type: String },
  timestamp: { type: Number, required: true }
}, {
  timestamps: true
});

export const Question = mongoose.model<IQuestion>('Question', QuestionSchema);
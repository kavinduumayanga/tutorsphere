import mongoose, { Document, Schema } from 'mongoose';

export interface IQuiz extends Document {
  id: string;
  subject: string;
  questions: {
    question: string;
    options: string[];
    correctAnswer: number;
  }[];
}

const QuizSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  questions: [{
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true, min: 0 }
  }]
}, {
  timestamps: true
});

export const Quiz = mongoose.model<IQuiz>('Quiz', QuizSchema);
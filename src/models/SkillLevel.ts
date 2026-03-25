import mongoose, { Document, Schema } from 'mongoose';

export interface ISkillLevel extends Document {
  id: string;
  studentId: string;
  subject: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Master';
  progress: number; // 0-100
}

const SkillLevelSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  subject: { type: String, required: true },
  level: { type: String, required: true, enum: ['Beginner', 'Intermediate', 'Advanced', 'Master'] },
  progress: { type: Number, required: true, min: 0, max: 100 }
}, {
  timestamps: true
});

export const SkillLevel = mongoose.model<ISkillLevel>('SkillLevel', SkillLevelSchema);
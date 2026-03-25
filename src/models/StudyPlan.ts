import mongoose, { Document, Schema } from 'mongoose';

export interface IStudyPlan extends Document {
  id: string;
  studentId: string;
  weeklyGoalHours: number;
  completedHours: number;
  recommendations: string[];
  schedule: {
    day: string;
    topic: string;
  }[];
}

const StudyPlanSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  weeklyGoalHours: { type: Number, required: true },
  completedHours: { type: Number, required: true, default: 0 },
  recommendations: [{ type: String }],
  schedule: [{
    day: { type: String, required: true },
    topic: { type: String, required: true }
  }]
}, {
  timestamps: true
});

export const StudyPlan = mongoose.model<IStudyPlan>('StudyPlan', StudyPlanSchema);
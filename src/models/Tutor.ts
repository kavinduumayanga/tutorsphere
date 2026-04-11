import mongoose, { Document, Schema } from 'mongoose';

export interface ITutor extends Document {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'tutor' | 'admin';
  qualifications: string;
  subjects: string[];
  teachingLevel: 'School' | 'University' | 'School and University';
  pricePerHour: number;
  rating: number;
  reviewCount: number;
  bio: string;
  availability: {
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    isBooked: boolean;
  }[];
  isVerified: boolean;
  avatar?: string;
}

const TutorSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, required: true, enum: ['student', 'tutor', 'admin'], default: 'tutor' },
  qualifications: { type: String, required: true },
  subjects: [{ type: String, required: true }],
  teachingLevel: { type: String, required: true, enum: ['School', 'University', 'School and University'] },
  pricePerHour: { type: Number, required: true },
  rating: { type: Number, required: true, min: 0, max: 5, default: 0 },
  reviewCount: { type: Number, required: true, default: 0 },
  bio: { type: String, default: '' },
  availability: [{
    id: { type: String, required: true },
    day: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isBooked: { type: Boolean, required: true, default: false }
  }],
  isVerified: { type: Boolean, required: true, default: false },
  avatar: { type: String }
}, {
  timestamps: true
});

export const Tutor = mongoose.model<ITutor>('Tutor', TutorSchema);
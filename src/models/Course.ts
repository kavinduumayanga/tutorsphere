import mongoose, { Document, Schema } from 'mongoose';

export interface ICourse extends Document {
  id: string;
  tutorId: string;
  title: string;
  subject: string;
  description: string;
  price: number;
  thumbnail: string;
  modules: {
    id: string;
    title: string;
    videoUrl: string;
    resources: string[];
  }[];
  enrolledStudents: string[];
}

const CourseSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  tutorId: { type: String, required: true },
  title: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  thumbnail: { type: String, required: true },
  modules: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    videoUrl: { type: String, required: true },
    resources: [{ type: String }]
  }],
  enrolledStudents: [{ type: String }]
}, {
  timestamps: true
});

export const Course = mongoose.model<ICourse>('Course', CourseSchema);
import mongoose, { Document, Schema } from 'mongoose';

export interface ICourse extends Document {
  id: string;
  tutorId: string;
  title: string;
  subject: string;
  description: string;
  isFree: boolean;
  price: number;
  thumbnail: string;
  thumbnailBlobName?: string;
  thumbnailMimeType?: string;
  thumbnailSize?: number;
  modules: {
    id: string;
    title: string;
    videoUrl: string;
    videoBlobName?: string;
    videoMimeType?: string;
    videoSize?: number;
    resources: {
      name: string;
      url: string;
      blobName?: string;
      mimeType?: string;
      size?: number;
    }[];
  }[];
  enrolledStudents: string[];
}

const CourseSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  tutorId: { type: String, required: true },
  title: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  isFree: { type: Boolean, required: true, default: false },
  price: { type: Number, required: true },
  thumbnail: { type: String, required: true },
  thumbnailBlobName: { type: String },
  thumbnailMimeType: { type: String },
  thumbnailSize: { type: Number },
  modules: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    videoUrl: { type: String, required: true },
    videoBlobName: { type: String },
    videoMimeType: { type: String },
    videoSize: { type: Number },
    // Keep mixed for backward compatibility with legacy string[] data.
    resources: [{ type: Schema.Types.Mixed }]
  }],
  enrolledStudents: [{ type: String }]
}, {
  timestamps: true
});

export const Course = mongoose.model<ICourse>('Course', CourseSchema);
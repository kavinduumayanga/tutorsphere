import mongoose, { Document, Schema } from 'mongoose';

export interface IResource extends Document {
  id: string;
  tutorId?: string;
  title: string;
  type: 'Paper' | 'Article' | 'Note';
  subject: string;
  url: string;
  blobName?: string;
  mimeType?: string;
  size?: number;
  description?: string;
  isFree: boolean;
  downloadCount: number;
}

const ResourceSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true },
  tutorId: { type: String },
  title: { type: String, required: true },
  type: { type: String, required: true, enum: ['Paper', 'Article', 'Note'] },
  subject: { type: String, required: true },
  url: { type: String, required: true },
  blobName: { type: String },
  mimeType: { type: String },
  size: { type: Number },
  description: { type: String },
  isFree: { type: Boolean, required: true, default: true },
  downloadCount: { type: Number, required: true, default: 0, min: 0 }
}, {
  timestamps: true
});

export const Resource = mongoose.model<IResource>('Resource', ResourceSchema);